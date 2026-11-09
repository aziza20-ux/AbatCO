import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from './app.js'

describe('GET /api/health', () => {
  it('confirms the API is running without requiring the database', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})

describe('authentication rate limiting', () => {
  it('returns retry information when the login limit is exceeded', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: '' })
    }

    const response = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: '' })

    expect(response.status).toBe(429)
    expect(response.headers['retry-after']).toMatch(/^\d+$/)
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0)
    expect(Number(response.headers['retry-after'])).toBeLessThanOrEqual(60)
    expect(response.body.error).toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Too many requests',
    })
    expect(response.body.error.retryAfterSeconds).toEqual(expect.any(Number))
    expect(response.body.error.retryAfterSeconds).toBeLessThanOrEqual(60)
  })
})