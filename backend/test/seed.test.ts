import request from 'supertest'
import { createApp } from '../src/app.ts'
import { describe, expect, it } from 'vitest'
import { signup } from './helpers.ts'

describe('POST /api/dev/seed', () => {
  it('creates a demo profile with weeks of demo sessions and an active plan', async () => {
    const c = await signup()
    const res = await c.post('/api/dev/seed')
    expect(res.status).toBe(201)
    expect(typeof res.body.profileId).toBe('string')
    expect(res.body.sessions).toBeGreaterThanOrEqual(30)

    const sessions = await c.get(`/api/profiles/${res.body.profileId}/sessions`)
    expect(sessions.body).toHaveLength(res.body.sessions)
    expect(sessions.body.every((s: { demo: boolean }) => s.demo)).toBe(true)

    const plan = await c.get(`/api/profiles/${res.body.profileId}/plan`)
    expect(plan.status).toBe(200)
  })

  it('is idempotent: seeding twice reuses the demo profile', async () => {
    const c = await signup()
    const a = await c.post('/api/dev/seed')
    const b = await c.post('/api/dev/seed')
    expect(b.status).toBe(200)
    expect(b.body.profileId).toBe(a.body.profileId)
    expect(b.body.sessions).toBe(a.body.sessions)
    expect((await c.get('/api/profiles')).body).toHaveLength(1)
  })

  it('is not mounted when dev routes are disabled', async () => {
    const c = await signup()
    const prod = createApp({ allowDevRoutes: false })
    const res = await request(prod).post('/api/dev/seed').set('Authorization', `Bearer ${c.token}`)
    expect(res.status).toBe(404)
  })
})
