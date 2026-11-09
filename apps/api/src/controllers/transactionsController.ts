import crypto from 'node:crypto'
import type { Response } from 'express'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma, type PrismaTx } from '../prisma.js'
import { jsonValue } from '../json.js'
import { audit } from '../audit.js'
import type { AuthRequest } from '../middleware/auth.js'

const input = z.object({ bicycleId: z.string().cuid(), sellerId: z.string().cuid().optional(), buyerId: z.string().cuid(), type: z.enum(['SALE', 'TRANSFER']), price: z.number().nonnegative().optional(), serviceFee: z.number().nonnegative().optional(), reason: z.string().trim().max(1000).optional(), location: z.string().trim().max(300).optional(), transactionDate: z.coerce.date().optional(), flagReason: z.string().trim().max(1000).optional(), agentNote: z.string().trim().max(1000).optional(), expectedOwnerId: z.string().cuid().optional(), clientOperationId: z.string().min(8).max(120) }).superRefine((value, ctx) => { if (value.type === 'SALE' && value.price === undefined) ctx.addIssue({ code: 'custom', path: ['price'], message: 'Sale price is required for a sale' }); if (value.type === 'TRANSFER' && value.price !== undefined) ctx.addIssue({ code: 'custom', path: ['price'], message: 'Transfer cannot include a sale price' }) })
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function createTransactionId() { return `TXN-${Array.from(crypto.randomBytes(8), (byte) => alphabet[byte % alphabet.length]).join('')}` }

export async function flagTransaction(request: AuthRequest, response: Response) {
  const user = await prisma.user.findUnique({ where: { id: request.user!.id }, select: { permissions: true } })
  const perms = (user?.permissions ?? {}) as Record<string, boolean>
  if (!perms.canFlag) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Flag permission required' } })
  const input = z.object({ flagReason: z.string().trim().min(1).max(1000).optional() }).parse(request.body)
  const transaction = await prisma.transaction.update({ where: { id: String(request.params.id) }, data: { flagStatus: 'FLAGGED', flagReason: input.flagReason ?? null } })
  await audit(request.user!.id, 'TRANSACTION_FLAGGED', 'Transaction', transaction.id, { flagReason: input.flagReason })
  return response.json({ data: transaction })
}

export async function agentReviewTransaction(request: AuthRequest, response: Response) {
  const user = await prisma.user.findUnique({ where: { id: request.user!.id }, select: { permissions: true } })
  const perms = (user?.permissions ?? {}) as Record<string, boolean>
  if (!perms.canOverride) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Override permission required' } })
  const transaction = await prisma.transaction.update({ where: { id: String(request.params.id) }, data: { flagStatus: 'REVIEWED' } })
  await audit(request.user!.id, 'TRANSACTION_REVIEWED', 'Transaction', transaction.id)
  return response.json({ data: transaction })
}

export async function listTransactions(request: AuthRequest, response: Response) {
  const query = z.object({ q: z.string().max(100).optional(), flagStatus: z.enum(['NONE', 'FLAGGED', 'REVIEWED', 'CONFLICTED']).optional(), type: z.enum(['SALE', 'TRANSFER']).optional(), agentId: z.string().cuid().optional(), personId: z.string().cuid().optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query)
  const where: Prisma.TransactionWhereInput = { ...(query.flagStatus ? { flagStatus: query.flagStatus } : {}), ...(query.type ? { type: query.type } : {}), ...(query.agentId ? { recordingAgentId: query.agentId } : {}), ...(query.personId ? { OR: [{ sellerId: query.personId }, { buyerId: query.personId }] } : query.q ? { OR: [{ transactionId: { contains: query.q, mode: 'insensitive' } }, { bicycle: { frameNumber: { contains: query.q, mode: 'insensitive' } } }] } : {}) }
  const data = await prisma.transaction.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { transactionDate: 'desc' }, select: { id: true, transactionId: true, type: true, price: true, serviceFee: true, reason: true, location: true, transactionDate: true, flagStatus: true, flagReason: true, ownershipStatus: true, bicycle: { select: { id: true, frameNumber: true, brand: true, model: true } }, seller: { select: { id: true, name: true, nationalId: true, phone: true, cell: true, sector: true, village: true, nationalIdPhotoUrl: true } }, buyer: { select: { id: true, name: true, nationalId: true, phone: true, cell: true, sector: true, village: true, nationalIdPhotoUrl: true } }, recordingAgent: { select: { id: true, name: true } } } })
  return response.json({ data })
}

export async function getTransaction(request: AuthRequest, response: Response) {
  const where: Prisma.TransactionWhereInput = { OR: [{ id: String(request.params.id) }, { transactionId: String(request.params.id) }] }
  const data = await prisma.transaction.findFirst({ where, select: { id: true, transactionId: true, type: true, price: true, serviceFee: true, reason: true, location: true, transactionDate: true, flagStatus: true, flagReason: true, agentNote: true, adminReviewNotes: true, ownershipStatus: true, bicycle: { include: { currentOwner: true } }, seller: true, buyer: true, recordingAgent: { select: { id: true, name: true } } } })
  if (!data) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } })
  return response.json({ data })
}

// ownershipStatus is intentionally excluded — editing must never change ownership state
const editInput = z.object({
  price: z.number().nonnegative().optional(),
  serviceFee: z.number().nonnegative().optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  transactionDate: z.coerce.date().optional(),
  flagReason: z.string().trim().max(1000).optional(),
  agentNote: z.string().trim().max(1000).optional(),
  bicycle: z.object({
    id: z.string().cuid(),
    frameNumber: z.string().trim().min(1).max(100),
    brand: z.string().trim().max(100).nullable().optional(),
    model: z.string().trim().max(100).nullable().optional(),
    color: z.string().trim().max(80).nullable().optional(),
    distinguishingFeatures: z.string().trim().max(1000).nullable().optional(),
  }).optional(),
  seller: z.object({
    id: z.string().cuid(),
    name: z.string().trim().min(1).max(160),
    nationalId: z.string().trim().min(1).max(80),
    phone: z.string().trim().max(40).nullable().optional(),
    cell: z.string().trim().max(80).nullable().optional(),
    sector: z.string().trim().max(120).nullable().optional(),
    village: z.string().trim().max(120).nullable().optional(),
    nationalIdPhotoUrl: z.string().url().max(1000).nullable().optional(),
  }).nullable().optional(),
  buyer: z.object({
    id: z.string().cuid(),
    name: z.string().trim().min(1).max(160),
    nationalId: z.string().trim().min(1).max(80),
    phone: z.string().trim().max(40).nullable().optional(),
    cell: z.string().trim().max(80).nullable().optional(),
    sector: z.string().trim().max(120).nullable().optional(),
    village: z.string().trim().max(120).nullable().optional(),
    nationalIdPhotoUrl: z.string().url().max(1000).nullable().optional(),
  }).nullable().optional(),
}).strict()

export async function editTransaction(request: AuthRequest, response: Response) {
  const inputData = editInput.parse(request.body)
  const where: Prisma.TransactionWhereInput = { OR: [{ id: String(request.params.id) }, { transactionId: String(request.params.id) }] }
  const existing = await prisma.transaction.findFirst({ where, select: { id: true, bicycleId: true, sellerId: true, buyerId: true, bicycle: { select: { currentOwnerId: true } } } })
  if (!existing) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } })
  const sellerId = inputData.seller?.id ?? existing.sellerId
  const sellerChanged = sellerId !== existing.sellerId
  if (sellerChanged && sellerId && existing.bicycle.currentOwnerId && sellerId !== existing.bicycle.currentOwnerId && !inputData.reason?.trim()) {
    return response.status(422).json({ error: { code: 'OWNER_MISMATCH_REASON_REQUIRED', message: 'A reason is required when seller differs from current owner' } })
  }
  const updated = await prisma.$transaction(async (tx) => {
    const bicycleInput = inputData.bicycle
    const partyUpdates = [
      ['seller', inputData.seller, existing.sellerId],
      ['buyer', inputData.buyer, existing.buyerId],
    ] as const
    for (const [party, personInput, existingPersonId] of partyUpdates) {
      if (personInput === undefined) continue
      if (personInput === null) {
        if (existingPersonId !== null) throw Object.assign(new Error(`Transaction ${party} cannot remove its party`), { status: 400 })
        continue
      }
      if (personInput.id !== existingPersonId) throw Object.assign(new Error(`Transaction ${party} cannot change its party relationship`), { status: 400 })
      await tx.person.update({ where: { id: personInput.id }, data: { name: personInput.name, nationalId: personInput.nationalId, phone: personInput.phone, cell: personInput.cell, sector: personInput.sector, village: personInput.village, nationalIdPhotoUrl: personInput.nationalIdPhotoUrl } })
    }
    if (bicycleInput) {
      if (bicycleInput.id !== existing.bicycleId) {
        throw Object.assign(new Error('Transaction bicycle cannot be changed'), { status: 400 })
      }
      await tx.bicycle.update({ where: { id: bicycleInput.id }, data: { frameNumber: bicycleInput.frameNumber, brand: bicycleInput.brand, model: bicycleInput.model, color: bicycleInput.color, distinguishingFeatures: bicycleInput.distinguishingFeatures } })
    }
    const { bicycle: _bicycle, seller: _seller, buyer: _buyer, ...transactionData } = inputData
    return tx.transaction.update({ where: { id: existing.id }, data: transactionData, select: { id: true, transactionId: true, type: true, price: true, serviceFee: true, reason: true, location: true, transactionDate: true, flagStatus: true, flagReason: true, agentNote: true, adminReviewNotes: true, ownershipStatus: true, bicycle: { include: { currentOwner: true } }, seller: true, buyer: true, recordingAgent: { select: { id: true, name: true } } } })
  })
  await audit(request.user!.id, 'TRANSACTION_UPDATED', 'Transaction', updated.id, { transactionId: updated.transactionId, fields: Object.keys(inputData) })
  return response.json({ data: updated })
}

export async function deleteTransaction(request: AuthRequest, response: Response) {
  const transaction = await prisma.transaction.findFirst({
    where: { OR: [{ id: String(request.params.id) }, { transactionId: String(request.params.id) }] },
    select: { id: true, bicycleId: true, sellerId: true, ownershipStatus: true, transactionId: true },
  })
  if (!transaction) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Transaction not found' } })
  await prisma.$transaction(async (tx) => {
    if (transaction.ownershipStatus === 'ACTIVE') {
      await tx.bicycle.update({ where: { id: transaction.bicycleId }, data: { currentOwnerId: transaction.sellerId } })
    }
    await tx.transaction.delete({ where: { id: transaction.id } })
  })
  await audit(request.user!.id, 'TRANSACTION_DELETED', 'Transaction', transaction.id, { transactionId: transaction.transactionId })
  return response.status(204).send()
}

export async function createTransaction(request: AuthRequest, response: Response) {
  const body = input.parse({ ...request.body, clientOperationId: request.header('x-client-operation-id') ?? request.body.clientOperationId })
  const previous = await prisma.syncOperation.findUnique({ where: { clientOperationId: body.clientOperationId } })
  if (previous?.status === 'APPLIED' && previous.entityId) return response.json({ data: await prisma.transaction.findUnique({ where: { id: previous.entityId } }), idempotent: true })
  if (previous?.status === 'CONFLICTED') return response.status(409).json({ error: { code: 'CONFLICTED', message: previous.conflictReason ?? 'Operation is conflicted', operationId: previous.clientOperationId, preserved: true } })
  const result = await prisma.$transaction(async (tx: PrismaTx) => {
    const bicycle = await tx.bicycle.findUnique({ where: { id: body.bicycleId } })
    if (!bicycle) throw Object.assign(new Error('Bicycle not found'), { status: 404 })
    if (body.expectedOwnerId && body.expectedOwnerId !== bicycle.currentOwnerId) {
      await tx.syncOperation.create({ data: { clientOperationId: body.clientOperationId, userId: request.user!.id, entity: 'Transaction', entityId: body.bicycleId, payload: jsonValue(request.body), status: 'CONFLICTED', conflictReason: 'Bicycle ownership changed while this operation was offline' } })
      return { conflict: true, currentOwnerId: bicycle.currentOwnerId }
    }
    const mismatch = Boolean(body.sellerId && bicycle.currentOwnerId && body.sellerId !== bicycle.currentOwnerId)
    if (mismatch && !body.reason) throw Object.assign(new Error('A reason is required when seller differs from current owner'), { status: 422, code: 'OWNER_MISMATCH_REASON_REQUIRED' })
    // Mark any existing ACTIVE ownership transaction for this bicycle as HISTORICAL
    await tx.transaction.updateMany({ where: { bicycleId: body.bicycleId, ownershipStatus: 'ACTIVE' }, data: { ownershipStatus: 'HISTORICAL' } })
    const created = await tx.transaction.create({ data: { transactionId: createTransactionId(), type: body.type, bicycleId: body.bicycleId, sellerId: body.sellerId, buyerId: body.buyerId, recordingAgentId: request.user!.id, price: body.price, serviceFee: body.serviceFee, reason: body.reason, location: body.location, transactionDate: body.transactionDate, flagStatus: mismatch ? 'FLAGGED' : 'NONE', flagReason: mismatch ? body.flagReason ?? 'Seller does not match current owner' : undefined, agentNote: body.agentNote, ownershipStatus: 'ACTIVE' } })
    await tx.bicycle.update({ where: { id: bicycle.id }, data: { currentOwnerId: body.buyerId } })
    await tx.syncOperation.upsert({ where: { clientOperationId: body.clientOperationId }, create: { clientOperationId: body.clientOperationId, userId: request.user!.id, entity: 'Transaction', entityId: created.id, payload: jsonValue(request.body), status: 'APPLIED' }, update: { entityId: created.id, status: 'APPLIED' } })
    await tx.auditLog.create({ data: { userId: request.user!.id, action: mismatch ? 'FLAGGED_TRANSACTION_CREATED' : 'TRANSACTION_CREATED', entity: 'Transaction', entityId: created.id, metadata: { transactionId: created.transactionId, bicycleId: body.bicycleId, mismatch } } })
    return { created }
  })
  if ('conflict' in result && result.conflict) return response.status(409).json({ error: { code: 'CONFLICTED', message: 'Bicycle ownership changed; operation preserved for admin review', currentOwnerId: result.currentOwnerId, preserved: true } })
  return response.status(201).json({ data: result.created })
}
