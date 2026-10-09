import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { app } from './helpers.ts'

describe('POST /api/dev/seed', () => {
  it('creates a demo profile with weeks of demo sessions and an active plan', async () => {
    const res = await request(app).post('/api/dev/seed')
    expect(res.status).toBe(201)
    expect(typeof res.body.profileId).toBe('string')
    expect(res.body.sessions).toBeGreaterThanOrEqual(30)

    const sessions = await request(app).get(`/api/profiles/${res.body.profileId}/sessions`)
    expect(sessions.body).toHaveLength(res.body.sessions)
    expect(sessions.body.every((s: { demo: boolean }) => s.demo)).toBe(true)

    const plan = await request(app).get(`/api/profiles/${res.body.profileId}/plan`)
    expect(plan.status).toBe(200)
  })

  it('is idempotent: seeding twice reuses the demo profile', async () => {
    const a = await request(app).post('/api/dev/seed')
    const b = await request(app).post('/api/dev/seed')
    expect(b.status).toBe(200)
    expect(b.body.profileId).toBe(a.body.profileId)
    expect(b.body.sessions).toBe(a.body.sessions)
    expect((await request(app).get('/api/profiles')).body).toHaveLength(1)
  })

  it('is not mounted when dev routes are disabled', async () => {
    const prod = createApp({ allowDevRoutes: false })
    expect((await request(prod).post('/api/dev/seed')).status).toBe(404)
  })
})
