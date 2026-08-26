import type { Response } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma.js'
import type { AuthRequest } from '../middleware/auth.js'

export async function listAuditLogs(request: AuthRequest, response: Response) {
  const query = z.object({ entity: z.string().max(60).optional(), entityId: z.string().max(60).optional(), userId: z.string().cuid().optional(), action: z.string().max(80).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query)
  const where: Prisma.AuditLogWhereInput = { ...(query.entity ? { entity: query.entity } : {}), ...(query.entityId ? { entityId: query.entityId } : {}), ...(query.userId ? { userId: query.userId } : {}), ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}) }
  const data = await prisma.auditLog.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { timestamp: 'desc' }, include: { user: { select: { id: true, name: true, email: true } } } })
  return response.json({ data })
}
