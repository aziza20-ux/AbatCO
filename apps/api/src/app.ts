import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { authRouter } from './routes/auth.js'
import { healthRouter } from './routes/health.js'

export const app = express()
const allowedOrigins = [process.env.WEB_ORIGIN, process.env.APP_ORIGIN].filter((origin): origin is string => Boolean(origin))
app.use(cors({ origin: allowedOrigins }))
app.use(express.json())
app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Internal server error' })
}
app.use(errorHandler)