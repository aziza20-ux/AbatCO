import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { registrationHandlers } from '../controllers/registrationsController.js'

export const registrationsRouter = Router()
registrationsRouter.use(requireAuth)
registrationsRouter.post('/', registrationHandlers.createRegistration)
