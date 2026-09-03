import type { Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { accessToken, bcrypt, issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from '../auth.js'
import { audit } from '../audit.js'
import { prisma } from '../prisma.js'
import type { AuthRequest } from '../middleware/auth.js'
import { sendOtpEmail } from '../mailer.js'

const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) })
export const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
const cookieMaxAge = 30 * 24 * 60 * 60
const cookieOptions = `HttpOnly; Path=/api/auth; SameSite=Lax; Max-Age=${cookieMaxAge}`
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

export async function changePassword(request: AuthRequest, response: Response) {
  const input = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(200) }).parse(request.body)
  const user = await prisma.user.findUnique({ where: { id: request.user!.id } })
  if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) return response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' } })
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(input.newPassword, 12) } })
  await audit(user.id, 'PASSWORD_CHANGED', 'User', user.id)
  return response.status(204).send()
}

export async function logout(request: AuthRequest, response: Response) {
  const raw = refreshValue(request)
  if (raw) await revokeRefreshToken(raw)
  if (request.user) await audit(request.user.id, 'LOGOUT', 'User', request.user.id)
  response.setHeader('Set-Cookie', 'refresh_token=; Max-Age=0; HttpOnly; Path=/api/auth; SameSite=Lax')
  return response.status(204).send()
}

export async function forgotPassword(request: Request, response: Response) {
  const { email } = z.object({ email: z.string().email() }).parse(request.body)
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  // Always return 204 to avoid email enumeration
  if (!user || !user.isActive) return response.status(204).send()
  if (user.resetOtpSentAt && Date.now() - user.resetOtpSentAt.getTime() < 30_000)
    return response.status(429).json({ error: { code: 'RESEND_TOO_SOON', message: 'Please wait 30 seconds before requesting a new code' } })
  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const hash = await bcrypt.hash(otp, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { resetOtp: hash, resetOtpExpiry: new Date(Date.now() + 15 * 60 * 1000), resetOtpSentAt: new Date() },
  })
  await sendOtpEmail(user.email, user.name, otp)
  await audit(user.id, 'PASSWORD_RESET_REQUESTED', 'User', user.id)
  return response.status(204).send()
}

export async function resetPassword(request: Request, response: Response) {
  const { email, otp, newPassword } = z.object({
    email: z.string().email(),
    otp: z.string().length(6),
    newPassword: z.string().min(12).max(200),
  }).parse(request.body)
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !user.resetOtp || !user.resetOtpExpiry) return response.status(400).json({ error: { code: 'INVALID_OTP', message: 'Invalid or expired code' } })
  if (user.resetOtpExpiry < new Date()) return response.status(400).json({ error: { code: 'OTP_EXPIRED', message: 'Code has expired' } })
  if (!(await bcrypt.compare(otp, user.resetOtp))) return response.status(400).json({ error: { code: 'INVALID_OTP', message: 'Invalid or expired code' } })
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12), resetOtp: null, resetOtpExpiry: null },
  })
  await audit(user.id, 'PASSWORD_RESET', 'User', user.id)
  return response.status(204).send()
}
