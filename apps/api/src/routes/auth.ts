import { Router } from 'express'
import { asyncRoute } from '../errors.js'
import { requireAuth } from '../middleware/auth.js'
import { login, loginLimit, logout, refresh, changePassword } from '../controllers/authController.js'

export const authRouter = Router()
authRouter.post('/login', loginLimit, asyncRoute(login))
authRouter.post('/refresh', loginLimit, asyncRoute(refresh))
authRouter.post('/logout', requireAuth, asyncRoute(logout))
authRouter.patch('/password', requireAuth, asyncRoute(changePassword))
