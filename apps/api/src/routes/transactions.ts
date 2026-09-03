import { Router } from 'express'
import { asyncRoute } from '../errors.js'
import { requireAuth } from '../middleware/auth.js'
import { createTransaction, editTransaction, flagTransaction, agentReviewTransaction, getTransaction, listTransactions } from '../controllers/transactionsController.js'

export const transactionsRouter = Router()
transactionsRouter.use(requireAuth)
transactionsRouter.get('/', asyncRoute(listTransactions))
transactionsRouter.get('/:id', asyncRoute(getTransaction))
transactionsRouter.patch('/:id/flag', asyncRoute(flagTransaction))
transactionsRouter.patch('/:id/review', asyncRoute(agentReviewTransaction))
transactionsRouter.patch('/:id', asyncRoute(editTransaction))
transactionsRouter.post('/', asyncRoute(createTransaction))
