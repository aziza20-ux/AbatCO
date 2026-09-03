import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { registrationHandlers } from '../controllers/registrationsController.js'

export const registrationsRouter = Router()
registrationsRouter.use(requireAuth)
registrationsRouter.get('/', registrationHandlers.listRegistrations)
registrationsRouter.post('/', registrationHandlers.createRegistration)
registrationsRouter.patch('/:id', registrationHandlers.updateRegistration)
