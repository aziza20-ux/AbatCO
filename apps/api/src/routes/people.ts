import { Router } from 'express'
import { asyncRoute } from '../errors.js'
import { requireAuth } from '../middleware/auth.js'
import { createPerson, getPerson, listPeople } from '../controllers/peopleController.js'

export const peopleRouter = Router()
peopleRouter.use(requireAuth)
peopleRouter.get('/', asyncRoute(listPeople))
peopleRouter.get('/:id', asyncRoute(getPerson))
peopleRouter.post('/', asyncRoute(createPerson))
