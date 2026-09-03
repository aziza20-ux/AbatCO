import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { prisma, type PrismaTx } from './prisma.js'

const refreshDays = 30
const accessDays = 7

function jwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters')
  return secret
}

function refreshHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function accessToken(user: { id: string; role: 'ADMIN' | 'AGENT' }) {
  return jwt.sign({ role: user.role }, jwtSecret(), { subject: user.id, expiresIn: `${accessDays}d` })
}

export async function issueRefreshToken(userId: string) {
  const raw = crypto.randomBytes(48).toString('base64url')
  const sessionExpiresAt = new Date(Date.now() + refreshDays * 86400000)
  await prisma.refreshToken.create({ data: { tokenHash: refreshHash(raw), userId, expiresAt: sessionExpiresAt, sessionExpiresAt } })
  return raw
}

export async function rotateRefreshToken(raw: string) {
  const token = await prisma.refreshToken.findUnique({ where: { tokenHash: refreshHash(raw) }, include: { user: true } })
  if (!token || token.revokedAt || token.expiresAt <= new Date() || !token.user.isActive) throw new Error('Invalid refresh token')
  if (token.sessionExpiresAt <= new Date()) throw new Error('Session expired')
  const replacement = crypto.randomBytes(48).toString('base64url')
  const newExpiresAt = new Date(Math.min(Date.now() + refreshDays * 86400000, token.sessionExpiresAt.getTime()))
  await prisma.$transaction(async (tx: PrismaTx) => {
    await tx.refreshToken.update({ where: { id: token.id }, data: { revokedAt: new Date(), replacedById: refreshHash(replacement) } })
    await tx.refreshToken.create({ data: { tokenHash: refreshHash(replacement), userId: token.userId, expiresAt: newExpiresAt, sessionExpiresAt: token.sessionExpiresAt } })
  })
  return { user: token.user, refreshToken: replacement }
}

export async function revokeRefreshToken(raw: string) {
  await prisma.refreshToken.updateMany({ where: { tokenHash: refreshHash(raw), revokedAt: null }, data: { revokedAt: new Date() } })
}

export { bcrypt }
