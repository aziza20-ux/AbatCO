import { Router } from 'express'
import { asyncRoute } from '../errors.js'
import { requireAuth } from '../middleware/auth.js'
import { sync } from '../controllers/syncController.js'

export const syncRouter = Router()
syncRouter.use(requireAuth)
syncRouter.post('/', asyncRoute(sync))
