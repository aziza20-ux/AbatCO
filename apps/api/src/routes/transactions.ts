import { Router } from 'express'
import { asyncRoute } from '../errors.js'
import { requireAuth } from '../middleware/auth.js'
import { createTransaction, editTransaction, getTransaction, listTransactions } from '../controllers/transactionsController.js'

export const transactionsRouter = Router()
transactionsRouter.use(requireAuth)
transactionsRouter.get('/', asyncRoute(listTransactions))
transactionsRouter.get('/:id', asyncRoute(getTransaction))
transactionsRouter.patch('/:id', asyncRoute(editTransaction))
transactionsRouter.post('/', asyncRoute(createTransaction))
