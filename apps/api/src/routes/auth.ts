import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma.js'

export const authRouter = Router()

authRouter.post('/login', async (request, response, next) => {
  try {
    const { email, password } = request.body as { email?: string; password?: string }
    if (!email || !password) return response.status(400).json({ error: 'Email and password are required' })
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return response.status(401).json({ error: 'Invalid credentials' })
    const token = jwt.sign({ role: user.role }, process.env.JWT_SECRET as string, { subject: user.id, expiresIn: '8h' })
    return response.json({ token })
  } catch (error) {
    return next(error)
  }
})