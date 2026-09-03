import crypto from 'node:crypto'
import type { Response } from 'express'
import { z } from 'zod'
import { bcrypt } from '../auth.js'
import { audit } from '../audit.js'
import { jsonValue } from '../json.js'
import { prisma, type PrismaTx } from '../prisma.js'
import type { AuthRequest } from '../middleware/auth.js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function createTransactionId() {
  return `TXN-${Array.from(crypto.randomBytes(8), (b) => alphabet[b % alphabet.length]).join('')}`
}

export async function dashboard(_request: AuthRequest, response: Response) { const [bicycles, agents, transactions, flags, priceTotals] = await Promise.all([prisma.bicycle.count(), prisma.user.count({ where: { role: 'AGENT', isActive: true } }), prisma.transaction.count(), prisma.transaction.count({ where: { flagStatus: { in: ['FLAGGED', 'CONFLICTED'] } } }), prisma.transaction.aggregate({ _sum: { price: true, serviceFee: true } })]); return response.json({ data: { bicycles, activeAgents: agents, transactions, flags, totalBicyclePrice: Number(priceTotals._sum.price ?? 0), totalServiceFee: Number(priceTotals._sum.serviceFee ?? 0) } }) }
export async function listAgents(request: AuthRequest, response: Response) { const query = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query); const agents = await prisma.user.findMany({ where: { role: 'AGENT' }, skip: (query.page - 1) * query.limit, take: query.limit, select: { id: true, email: true, name: true, phone: true, isActive: true, permissions: true, createdAt: true, _count: { select: { transactions: true } } }, orderBy: { name: 'asc' } }); return response.json({ data: agents }) }
export async function createAgent(request: AuthRequest, response: Response) { const input = z.object({ name: z.string().trim().min(1).max(160), email: z.string().email(), phone: z.string().trim().max(40).optional(), password: z.string().min(12).max(200) }).parse(request.body); const user = await prisma.user.create({ data: { name: input.name, email: input.email.toLowerCase(), phone: input.phone, passwordHash: await bcrypt.hash(input.password, 12), role: 'AGENT', permissions: { canRegister: true, canTransfer: true } }, select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, permissions: true } }); await audit(request.user!.id, 'AGENT_CREATED', 'User', user.id); return response.status(201).json({ data: user }) }
export async function updateAgent(request: AuthRequest, response: Response) { const input = z.object({ name: z.string().trim().min(1).max(160).optional(), email: z.string().email().optional(), phone: z.string().trim().max(40).optional() }).parse(request.body); const agent = await prisma.user.findUnique({ where: { id: String(request.params.id) } }); if (!agent || agent.role !== 'AGENT') return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } }); const data: Record<string, unknown> = {}; if (input.name) data.name = input.name; if (input.email) data.email = input.email.toLowerCase(); if (input.phone !== undefined) data.phone = input.phone || null; const updated = await prisma.user.update({ where: { id: agent.id }, data, select: { id: true, name: true, email: true, phone: true, isActive: true, permissions: true, createdAt: true, _count: { select: { transactions: true } } } }); await audit(request.user!.id, 'AGENT_UPDATED', 'User', agent.id, { fields: Object.keys(data) }); return response.json({ data: updated }) }
export async function revokeAgent(request: AuthRequest, response: Response) { const user = await prisma.user.update({ where: { id: String(request.params.id) }, data: { isActive: false }, select: { id: true, isActive: true } }); await audit(request.user!.id, 'AGENT_REVOKED', 'User', user.id); return response.json({ data: user }) }
export async function reinstateAgent(request: AuthRequest, response: Response) { const user = await prisma.user.update({ where: { id: String(request.params.id) }, data: { isActive: true }, select: { id: true, isActive: true } }); await audit(request.user!.id, 'AGENT_REINSTATED', 'User', user.id); return response.json({ data: user }) }
export async function reviewTransaction(request: AuthRequest, response: Response) { const input = z.object({ status: z.enum(['REVIEWED', 'FLAGGED']), notes: z.string().trim().max(1000).optional() }).parse(request.body); const transaction = await prisma.transaction.update({ where: { id: String(request.params.id) }, data: { flagStatus: input.status, adminReviewedById: request.user!.id, adminReviewedAt: new Date(), adminReviewNotes: input.notes } }); await audit(request.user!.id, 'ADMIN_REVIEWED_TRANSACTION', 'Transaction', transaction.id, { status: input.status }); return response.json({ data: transaction }) }
export async function conflicts(_request: AuthRequest, response: Response) { const data = await prisma.syncOperation.findMany({ where: { status: 'CONFLICTED' }, orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { id: true, name: true, email: true } } } }); return response.json({ data }) }

export async function resolveConflict(request: AuthRequest, response: Response) {
  const { id } = request.params
  const input = z.object({
    resolution: z.enum(['ACCEPT', 'REJECT']),
    adminNote: z.string().trim().max(1000).optional(),
  }).parse(request.body)

  const operation = await prisma.syncOperation.findUnique({ where: { id: String(id) } })
  if (!operation) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conflict not found' } })
  if (operation.status !== 'CONFLICTED') return response.status(409).json({ error: { code: 'NOT_CONFLICTED', message: 'Operation is not in CONFLICTED state' } })

  if (input.resolution === 'REJECT') {
    await prisma.syncOperation.update({ where: { id: operation.id }, data: { status: 'PENDING', conflictReason: `REJECTED by admin: ${input.adminNote ?? 'no note'}` } })
    await audit(request.user!.id, 'CONFLICT_REJECTED', 'SyncOperation', operation.id, { clientOperationId: operation.clientOperationId, adminNote: input.adminNote })
    return response.json({ data: { resolution: 'REJECTED', operationId: operation.id } })
  }

  // ACCEPT — apply the preserved offline operation atomically
  const payload = operation.payload as Record<string, unknown>

  if (operation.entity === 'Transaction') {
    const bicycleId = payload.bicycleId as string | undefined
    const buyerId = payload.buyerId as string | undefined
    const sellerId = payload.sellerId as string | undefined
    const type = payload.type as 'SALE' | 'TRANSFER' | undefined
    if (!bicycleId || !buyerId || !type) return response.status(422).json({ error: { code: 'INVALID_PAYLOAD', message: 'Preserved payload is missing required fields' } })

    const created = await prisma.$transaction(async (tx: PrismaTx) => {
      const bicycle = await tx.bicycle.findUnique({ where: { id: bicycleId } })
      if (!bicycle) throw Object.assign(new Error('Bicycle not found'), { status: 404 })
      const mismatch = Boolean(sellerId && bicycle.currentOwnerId && sellerId !== bicycle.currentOwnerId)
      const transaction = await tx.transaction.create({
        data: {
          transactionId: createTransactionId(),
          type,
          bicycleId,
          sellerId: sellerId ?? undefined,
          buyerId,
          recordingAgentId: operation.userId,
          price: typeof payload.price === 'number' ? payload.price : undefined,
          serviceFee: typeof payload.serviceFee === 'number' ? payload.serviceFee : undefined,
          reason: typeof payload.reason === 'string' ? payload.reason : undefined,
          location: typeof payload.location === 'string' ? payload.location : undefined,
          flagStatus: mismatch ? 'REVIEWED' : 'NONE',
          flagReason: mismatch ? 'Conflict accepted by admin' : undefined,
          agentNote: typeof payload.agentNote === 'string' ? payload.agentNote : undefined,
          adminReviewedById: request.user!.id,
          adminReviewedAt: new Date(),
          adminReviewNotes: input.adminNote,
        },
      })
      await tx.bicycle.update({ where: { id: bicycleId }, data: { currentOwnerId: buyerId } })
      await tx.syncOperation.update({ where: { id: operation.id }, data: { status: 'APPLIED', entityId: transaction.id } })
      await tx.auditLog.create({
        data: { userId: request.user!.id, action: 'CONFLICT_ACCEPTED', entity: 'Transaction', entityId: transaction.id, metadata: jsonValue({ clientOperationId: operation.clientOperationId, adminNote: input.adminNote, transactionId: transaction.transactionId }) },
      })
      return transaction
    })
    return response.json({ data: { resolution: 'ACCEPTED', transaction: { id: created.id, transactionId: created.transactionId } } })
  }

  if (operation.entity === 'Registration') {
    const bicycleId = payload.bicycleId as string | undefined
    const ownerId = payload.ownerId as string | undefined
    if (!bicycleId || !ownerId) return response.status(422).json({ error: { code: 'INVALID_PAYLOAD', message: 'Preserved payload is missing required fields' } })

    const created = await prisma.$transaction(async (tx: PrismaTx) => {
      const registration = await tx.registration.create({ data: { bicycleId, ownerId, recordingAgentId: operation.userId } })
      await tx.bicycle.update({ where: { id: bicycleId }, data: { currentOwnerId: ownerId } })
      await tx.syncOperation.update({ where: { id: operation.id }, data: { status: 'APPLIED', entityId: registration.id } })
      await tx.auditLog.create({
        data: { userId: request.user!.id, action: 'CONFLICT_ACCEPTED', entity: 'Registration', entityId: registration.id, metadata: jsonValue({ clientOperationId: operation.clientOperationId, adminNote: input.adminNote }) },
      })
      return registration
    })
    return response.json({ data: { resolution: 'ACCEPTED', registration: { id: created.id } } })
  }

  return response.status(422).json({ error: { code: 'UNSUPPORTED_ENTITY', message: 'Cannot resolve this entity type' } })
}

export async function updateAgentPermissions(request: AuthRequest, response: Response) {
  const input = z.object({
    canRegister: z.boolean().optional(),
    canTransfer: z.boolean().optional(),
    canFlag: z.boolean().optional(),
    canOverride: z.boolean().optional(),
  }).parse(request.body)
  const agent = await prisma.user.findUnique({ where: { id: String(request.params.id) } })
  if (!agent || agent.role !== 'AGENT') return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } })
  const current = (agent.permissions ?? {}) as Record<string, boolean>
  const merged = { ...current, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) }
  const updated = await prisma.user.update({ where: { id: agent.id }, data: { permissions: merged }, select: { id: true, permissions: true } })
  await audit(request.user!.id, 'AGENT_PERMISSIONS_UPDATED', 'User', agent.id, { permissions: merged })
  return response.json({ data: updated })
}

export const adminHandlers = { dashboard, listAgents, createAgent, updateAgent, revokeAgent, reinstateAgent, reviewTransaction, conflicts, resolveConflict, updateAgentPermissions }
