import { describe, expect, it } from 'vitest'
import { anon } from './helpers.ts'

describe('GET /api/health', () => {
  it('reports ok and the database state', async () => {
    const res = await anon.get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, db: 'connected' })
  })

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await anon.get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })
})
