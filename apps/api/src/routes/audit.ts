import { Router } from 'express'
import { asyncRoute } from '../errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { listAuditLogs } from '../controllers/auditController.js'

export const auditRouter = Router()
auditRouter.use(requireAuth, requireRole('ADMIN'))
auditRouter.get('/', asyncRoute(listAuditLogs))
