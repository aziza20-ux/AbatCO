import type { Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { accessToken, bcrypt, issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from '../auth.js'
import { audit } from '../audit.js'
import { prisma } from '../prisma.js'
import type { AuthRequest } from '../middleware/auth.js'

const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) })
export const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
const cookieOptions = 'HttpOnly; Path=/api/auth; SameSite=Lax'
const refreshValue = (request: Request) => request.header('x-refresh-token') ?? request.header('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('refresh_token='))?.slice('refresh_token='.length)

export async function login(request: Request, response: Response) {
  const input = credentials.parse(request.body)
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })
  if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) return response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } })
  const refreshToken = await issueRefreshToken(user.id)
  await audit(user.id, 'LOGIN', 'User', user.id)
  response.setHeader('Set-Cookie', `refresh_token=${refreshToken}; ${cookieOptions}`)
  return response.json({ data: { token: accessToken(user), user: { id: user.id, name: user.name, role: user.role } } })
}

export async function refresh(request: Request, response: Response) {
  const raw = refreshValue(request)
  if (!raw) return response.status(401).json({ error: { code: 'REFRESH_REQUIRED', message: 'Refresh token required' } })
  let result
  try {
    result = await rotateRefreshToken(raw)
  } catch {
    return response.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or revoked refresh token' } })
  }
  response.setHeader('Set-Cookie', `refresh_token=${result.refreshToken}; ${cookieOptions}`)
  return response.json({ data: { token: accessToken(result.user) } })
}

export async function logout(request: AuthRequest, response: Response) {
  const raw = refreshValue(request)
  if (raw) await revokeRefreshToken(raw)
  if (request.user) await audit(request.user.id, 'LOGOUT', 'User', request.user.id)
  response.setHeader('Set-Cookie', 'refresh_token=; Max-Age=0; HttpOnly; Path=/api/auth; SameSite=Lax')
  return response.status(204).send()
}
