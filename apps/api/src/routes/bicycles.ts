import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { bicycleHandlers } from '../controllers/bicyclesController.js'

export const bicyclesRouter = Router()
bicyclesRouter.use(requireAuth)
bicyclesRouter.get('/', bicycleHandlers.listBicycles)
bicyclesRouter.get('/:id', bicycleHandlers.getBicycle)
bicyclesRouter.post('/', bicycleHandlers.createBicycle)
bicyclesRouter.patch('/:id', bicycleHandlers.updateBicycle)
