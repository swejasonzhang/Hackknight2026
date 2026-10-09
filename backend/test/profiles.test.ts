import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from './helpers.ts'

describe('profiles', () => {
  it('POST /api/profiles creates a profile and returns it with an id', async () => {
    const res = await request(app).post('/api/profiles').send({ name: '  Ada Lovelace ', email: 'ada@example.com' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' })
    expect(typeof res.body.id).toBe('string')
    expect(typeof res.body.createdAt).toBe('number')
    expect(res.body._id).toBeUndefined()
  })

  it('POST /api/profiles rejects an invalid body with 400 and zod issues', async () => {
    const res = await request(app).post('/api/profiles').send({ name: '', email: 'nope' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid request')
    expect(Array.isArray(res.body.issues)).toBe(true)
  })

  it('GET /api/profiles lists profiles, newest first', async () => {
    await request(app).post('/api/profiles').send({ name: 'First' })
    await request(app).post('/api/profiles').send({ name: 'Second' })
    const res = await request(app).get('/api/profiles')
    expect(res.status).toBe(200)
    expect(res.body.map((p: { name: string }) => p.name)).toEqual(['Second', 'First'])
  })

  it('GET /api/profiles/:id returns one profile, 404 for unknown or malformed ids', async () => {
    const created = await request(app).post('/api/profiles').send({ name: 'Grace' })
    const ok = await request(app).get(`/api/profiles/${created.body.id}`)
    expect(ok.status).toBe(200)
    expect(ok.body.name).toBe('Grace')

    const unknown = await request(app).get('/api/profiles/64b64b64b64b64b64b64b64b')
    expect(unknown.status).toBe(404)
    const malformed = await request(app).get('/api/profiles/not-an-id')
    expect(malformed.status).toBe(404)
  })
})
