import crypto from 'node:crypto'
import type { Response } from 'express'
import { z } from 'zod'
import { jsonValue } from '../json.js'
import { prisma } from '../prisma.js'
import type { AuthRequest } from '../middleware/auth.js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function createTransactionId() {
  return `TXN-${Array.from(crypto.randomBytes(8), (b) => alphabet[b % alphabet.length]).join('')}`
}

const personShape = z.object({
  name: z.string().trim().min(1).max(160),
  nationalId: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional(),
  cell: z.string().trim().max(80).optional(),
  sector: z.string().trim().max(120).optional(),
  village: z.string().trim().max(120).optional(),
})

const bicycleShape = z.object({
  frameNumber: z.string().trim().min(1).max(100),
  brand: z.string().trim().max(100).optional(),
  model: z.string().trim().max(100).optional(),
  color: z.string().trim().max(80).optional(),
  distinguishingFeatures: z.string().trim().max(1000).optional(),
})

const rawTransactionPayload = z.object({
  _raw: z.object({
    type: z.enum(['SALE', 'TRANSFER']),
    bicycle: bicycleShape,
    seller: personShape.optional(),
    buyer: personShape,
    price: z.number().nonnegative().optional(),
    serviceFee: z.number().nonnegative().optional(),
    reason: z.string().trim().max(1000).optional(),
  }),
})

const rawRegistrationPayload = z.object({
  _raw: z.object({
    bicycle: bicycleShape,
    person: personShape,
  }),
})

const transactionPayload = z.object({
  bicycleId: z.string().cuid(),
  sellerId: z.string().cuid().optional(),
  buyerId: z.string().cuid(),
  type: z.enum(['SALE', 'TRANSFER']),
  price: z.number().nonnegative().optional(),
  serviceFee: z.number().nonnegative().optional(),
  reason: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(300).optional(),
  transactionDate: z.coerce.date().optional(),
  flagReason: z.string().trim().max(1000).optional(),
  agentNote: z.string().trim().max(1000).optional(),
  expectedOwnerId: z.string().cuid().optional(),
})

const registrationPayload = z.object({
  bicycleId: z.string().cuid(),
  ownerId: z.string().cuid(),
})

async function resolvePersonId(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], data: z.infer<typeof personShape>): Promise<string> {
  const existing = await tx.person.findUnique({ where: { nationalId: data.nationalId } })
  if (existing) return existing.id
  const created = await tx.person.create({ data })
  return created.id
}

async function resolveBicycleId(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], data: z.infer<typeof bicycleShape>): Promise<string> {
  const existing = await tx.bicycle.findUnique({ where: { frameNumber: data.frameNumber } })
  if (existing) return existing.id
  const created = await tx.bicycle.create({ data })
  return created.id
}

const operation = z.object({
  clientOperationId: z.string().min(8).max(120),
  entity: z.enum(['Transaction', 'Registration']),
  payload: z.unknown(),
})

async function applyTransaction(
  clientOperationId: string,
  userId: string,
  rawPayload: unknown,
): Promise<{ status: string; entityId?: string | null; conflictReason?: string }> {
  // resolve natural-key offline payload into CUIDs first
  const rawParse = rawTransactionPayload.safeParse(rawPayload)
  if (rawParse.success) {
    const r = rawParse.data._raw
    const resolved = await prisma.$transaction(async (tx) => {
      const [bicycleId, buyerId, sellerId] = await Promise.all([
        resolveBicycleId(tx, r.bicycle),
        resolvePersonId(tx, r.buyer),
        r.seller ? resolvePersonId(tx, r.seller) : Promise.resolve(undefined),
      ])
      return { bicycleId, buyerId, sellerId, type: r.type, price: r.price, serviceFee: r.serviceFee, reason: r.reason }
    })
    rawPayload = resolved
  }

  const parse = transactionPayload.safeParse(rawPayload)
  if (!parse.success) return { status: 'VALIDATION_ERROR', conflictReason: parse.error.issues.map((i) => i.message).join('; ') }
  const body = parse.data

  if (body.type === 'SALE' && body.price === undefined) return { status: 'VALIDATION_ERROR', conflictReason: 'Sale price is required for a sale' }
  if (body.type === 'TRANSFER' && body.price !== undefined) return { status: 'VALIDATION_ERROR', conflictReason: 'Transfer cannot include a sale price' }

  const result = await prisma.$transaction(async (tx) => {
    const bicycle = await tx.bicycle.findUnique({ where: { id: body.bicycleId } })
    if (!bicycle) return { status: 'VALIDATION_ERROR', conflictReason: 'Bicycle not found' }

    if (body.expectedOwnerId && body.expectedOwnerId !== bicycle.currentOwnerId) {
      await tx.syncOperation.upsert({
        where: { clientOperationId },
        create: { clientOperationId, userId, entity: 'Transaction', entityId: body.bicycleId, payload: jsonValue(rawPayload), status: 'CONFLICTED', conflictReason: 'Bicycle ownership changed while this operation was offline' },
        update: { status: 'CONFLICTED', conflictReason: 'Bicycle ownership changed while this operation was offline' },
      })
      return { status: 'CONFLICT', conflictReason: 'Bicycle ownership changed while this operation was offline' }
    }

    const mismatch = Boolean(body.sellerId && bicycle.currentOwnerId && body.sellerId !== bicycle.currentOwnerId)
    if (mismatch && !body.reason) return { status: 'VALIDATION_ERROR', conflictReason: 'A reason is required when seller differs from current owner' }

    const created = await tx.transaction.create({
      data: {
        transactionId: createTransactionId(),
        type: body.type,
        bicycleId: body.bicycleId,
        sellerId: body.sellerId,
        buyerId: body.buyerId,
        recordingAgentId: userId,
        price: body.price,
        serviceFee: body.serviceFee,
        reason: body.reason,
        location: body.location,
        transactionDate: body.transactionDate,
        flagStatus: mismatch ? 'FLAGGED' : 'NONE',
        flagReason: mismatch ? (body.flagReason ?? 'Seller does not match current owner') : undefined,
        agentNote: body.agentNote,
      },
    })
    await tx.bicycle.update({ where: { id: bicycle.id }, data: { currentOwnerId: body.buyerId } })
    await tx.syncOperation.upsert({
      where: { clientOperationId },
      create: { clientOperationId, userId, entity: 'Transaction', entityId: created.id, payload: jsonValue(rawPayload), status: 'APPLIED' },
      update: { entityId: created.id, status: 'APPLIED' },
    })
    await tx.auditLog.create({
      data: { userId, action: mismatch ? 'FLAGGED_TRANSACTION_CREATED' : 'TRANSACTION_CREATED', entity: 'Transaction', entityId: created.id, metadata: { transactionId: created.transactionId, bicycleId: body.bicycleId, mismatch, source: 'sync' } },
    })
    return { status: 'SYNCED', entityId: created.id }
  })
  return result
}

async function applyRegistration(
  clientOperationId: string,
  userId: string,
  rawPayload: unknown,
): Promise<{ status: string; entityId?: string | null; conflictReason?: string }> {
  // resolve natural-key offline payload into CUIDs first
  const rawParse = rawRegistrationPayload.safeParse(rawPayload)
  if (rawParse.success) {
    const r = rawParse.data._raw
    const resolved = await prisma.$transaction(async (tx) => {
      const [bicycleId, ownerId] = await Promise.all([
        resolveBicycleId(tx, r.bicycle),
        resolvePersonId(tx, r.person),
      ])
      return { bicycleId, ownerId }
    })
    rawPayload = resolved
  }

  const parse = registrationPayload.safeParse(rawPayload)
  if (!parse.success) return { status: 'VALIDATION_ERROR', conflictReason: parse.error.issues.map((i) => i.message).join('; ') }
  const body = parse.data

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.registration.create({ data: { bicycleId: body.bicycleId, ownerId: body.ownerId, recordingAgentId: userId } })
    await tx.bicycle.update({ where: { id: body.bicycleId }, data: { currentOwnerId: body.ownerId } })
    await tx.syncOperation.upsert({
      where: { clientOperationId },
      create: { clientOperationId, userId, entity: 'Registration', entityId: created.id, payload: jsonValue(rawPayload), status: 'APPLIED' },
      update: { entityId: created.id, status: 'APPLIED' },
    })
    await tx.auditLog.create({
      data: { userId, action: 'BICYCLE_REGISTERED', entity: 'Registration', entityId: created.id, metadata: { bicycleId: body.bicycleId, ownerId: body.ownerId, source: 'sync' } },
    })
    return { status: 'SYNCED', entityId: created.id }
  })
  return result
}

export async function sync(request: AuthRequest, response: Response) {
  const body = z.object({ operations: z.array(operation).min(1).max(50) }).parse(request.body)
  const results = []

  for (const item of body.operations) {
    // Check idempotency first
    const existing = await prisma.syncOperation.findUnique({ where: { clientOperationId: item.clientOperationId } })
    if (existing) {
      results.push({
        clientOperationId: item.clientOperationId,
        status: existing.status === 'APPLIED' ? 'ALREADY_SYNCED' : existing.status === 'CONFLICTED' ? 'CONFLICT' : existing.status,
        entityId: existing.entityId,
        conflictReason: existing.conflictReason,
        preserved: existing.status === 'CONFLICTED',
      })
      continue
    }

    // Check authorization — agents can only submit their own operations
    // (userId is always set from the JWT, so this is enforced implicitly)

    let result: { status: string; entityId?: string | null; conflictReason?: string }
    try {
      if (item.entity === 'Transaction') {
        result = await applyTransaction(item.clientOperationId, request.user!.id, item.payload)
      } else {
        result = await applyRegistration(item.clientOperationId, request.user!.id, item.payload)
      }
    } catch (error) {
      // Record as failed so client knows — do not leave untracked
      await prisma.syncOperation.create({
        data: { clientOperationId: item.clientOperationId, userId: request.user!.id, entity: item.entity, payload: jsonValue(item.payload), status: 'PENDING', conflictReason: error instanceof Error ? error.message : 'Unknown error' },
      }).catch(() => undefined) // ignore if already exists from a race
      result = { status: 'FAILED', conflictReason: error instanceof Error ? error.message : 'Unknown error' }
    }

    results.push({ clientOperationId: item.clientOperationId, ...result, preserved: result.status === 'CONFLICT' })
  }

  return response.json({ data: { results } })
}
