import type { Response } from 'express'
import { z } from 'zod'
import { audit } from '../audit.js'
import { asyncRoute } from '../errors.js'
import { prisma } from '../prisma.js'
import type { AuthRequest } from '../middleware/auth.js'

const input = z.object({ bicycleId: z.string().cuid(), ownerId: z.string().cuid(), clientOperationId: z.string().min(8).max(120) })
export async function createRegistration(request: AuthRequest, response: Response) { const body = input.parse(request.body); const existing = await prisma.syncOperation.findUnique({ where: { clientOperationId: body.clientOperationId } }); if (existing?.status === 'APPLIED' && existing.entityId) return response.json({ data: await prisma.registration.findUnique({ where: { id: existing.entityId } }), idempotent: true }); const registration = await prisma.$transaction(async (tx) => { const created = await tx.registration.create({ data: { bicycleId: body.bicycleId, ownerId: body.ownerId, recordingAgentId: request.user!.id } }); await tx.bicycle.update({ where: { id: body.bicycleId }, data: { currentOwnerId: body.ownerId } }); await tx.syncOperation.upsert({ where: { clientOperationId: body.clientOperationId }, create: { clientOperationId: body.clientOperationId, userId: request.user!.id, entity: 'Registration', entityId: created.id, payload: request.body, status: 'APPLIED' }, update: { entityId: created.id, status: 'APPLIED' } }); await tx.auditLog.create({ data: { userId: request.user!.id, action: 'BICYCLE_REGISTERED', entity: 'Registration', entityId: created.id, metadata: { bicycleId: body.bicycleId, ownerId: body.ownerId } } }); return created }); await audit(request.user!.id, 'REGISTRATION_CONFIRMED', 'Registration', registration.id); return response.status(201).json({ data: registration }) }
export const registrationHandlers = { createRegistration: asyncRoute(createRegistration) }
