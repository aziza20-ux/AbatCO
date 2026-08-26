import { Router } from 'express'
import { asyncRoute } from '../errors.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { exportTransactionDocx } from '../controllers/exportController.js'
import { exportTransactionsXlsx } from '../controllers/xlsxController.js'

export const exportsRouter = Router()
exportsRouter.use(requireAuth)

// xlsx must be registered before :id to avoid being matched as a param
exportsRouter.get('/transactions/xlsx', requireRole('ADMIN'), asyncRoute(exportTransactionsXlsx))
exportsRouter.get('/transactions/:id/docx', asyncRoute(exportTransactionDocx))
