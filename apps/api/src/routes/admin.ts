import { Router } from 'express'
import { asyncRoute } from '../errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { adminHandlers } from '../controllers/adminController.js'

export const adminRouter = Router()
adminRouter.use(requireAuth, requireRole('ADMIN'))
adminRouter.get('/dashboard', asyncRoute(adminHandlers.dashboard))
adminRouter.get('/agents', asyncRoute(adminHandlers.listAgents))
adminRouter.post('/agents', asyncRoute(adminHandlers.createAgent))
adminRouter.patch('/agents/:id/revoke', asyncRoute(adminHandlers.revokeAgent))
adminRouter.patch('/agents/:id/reinstate', asyncRoute(adminHandlers.reinstateAgent))
adminRouter.patch('/agents/:id/permissions', asyncRoute(adminHandlers.updateAgentPermissions))
adminRouter.patch('/transactions/:id/review', asyncRoute(adminHandlers.reviewTransaction))
adminRouter.get('/conflicts', asyncRoute(adminHandlers.conflicts))
adminRouter.post('/conflicts/:id/resolve', asyncRoute(adminHandlers.resolveConflict))
