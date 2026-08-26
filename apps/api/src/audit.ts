import { prisma } from './prisma.js'
import { jsonValue } from './json.js'

export async function audit(userId: string, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) {
  await prisma.auditLog.create({ data: { userId, action, entity, entityId, metadata: metadata ? jsonValue(metadata) : undefined } })
}
