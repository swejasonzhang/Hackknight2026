import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'

describe('while MongoDB is unreachable', () => {
  const app = createApp({ allowDevRoutes: true, isDbConnected: () => false })

  it('health still answers and reports the database as disconnected', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, db: 'disconnected' })
  })

  it('data routes fail fast with 503 instead of hanging', async () => {
    const signup = await request(app).post('/api/auth/signup').send({ name: 'Ada', email: 'ada@example.com', password: 'correct horse battery' })
    expect(signup.status).toBe(503)
    expect(signup.body.error).toBe('Database unavailable')
    const profiles = await request(app).get('/api/profiles').set('x-api-key', process.env.CV_API_KEY ?? '')
    expect(profiles.status).toBe(503)
  })
})
