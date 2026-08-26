import 'dotenv/config'
import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import helmet from 'helmet'
import { authRouter } from './routes/auth.js'
import { healthRouter } from './routes/health.js'
import { peopleRouter } from './routes/people.js'
import { bicyclesRouter } from './routes/bicycles.js'
import { transactionsRouter } from './routes/transactions.js'
import { registrationsRouter } from './routes/registrations.js'
import { adminRouter } from './routes/admin.js'
import { syncRouter } from './routes/sync.js'

export const app = express()
const allowedOrigins = [process.env.WEB_ORIGIN, process.env.APP_ORIGIN].filter((origin): origin is string => Boolean(origin))
app.use(helmet())
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false, credentials: true }))
app.use(express.json({ limit: '256kb' }))
app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/people', peopleRouter)
app.use('/api/bicycles', bicyclesRouter)
app.use('/api/transactions', transactionsRouter)
app.use('/api/registrations', registrationsRouter)
app.use('/api/admin', adminRouter)
app.use('/api/sync', syncRouter)

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error?.name === 'ZodError') return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.issues } })
  console.error(error instanceof Error ? error.message : 'Unhandled API error')
  const status = typeof error?.status === 'number' && error.status >= 400 && error.status < 600 ? error.status : 500
  response.status(status).json({ error: { code: error?.code ?? 'INTERNAL_ERROR', message: status === 500 ? 'Internal server error' : error.message } })
}
app.use(errorHandler)