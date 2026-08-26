import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export type AuthUser = { id: string; role: 'ADMIN' | 'AGENT' }
export type AuthRequest = Request & { user?: AuthUser }

export function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const header = request.header('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return response.status(401).json({ error: 'Authentication required' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload
    if (typeof payload.sub !== 'string' || (payload.role !== 'ADMIN' && payload.role !== 'AGENT')) throw new Error('Invalid claims')
    request.user = { id: payload.sub, role: payload.role }
    return next()
  } catch {
    return response.status(401).json({ error: 'Invalid authentication token' })
  }
}

export function requireRole(...roles: AuthUser['role'][]) {
  return (request: AuthRequest, response: Response, next: NextFunction) => {
    if (!request.user || !roles.includes(request.user.role)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    return next()
  }
}