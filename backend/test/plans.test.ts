import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app, createProfile } from './helpers.ts'

const plan = { exercise: 'elbow_flexion', side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg: 140 }

describe('plans', () => {
  it('GET /api/profiles/:id/plan is 404 before a plan is assigned', async () => {
    const id = await createProfile()
    const res = await request(app).get(`/api/profiles/${id}/plan`)
    expect(res.status).toBe(404)
  })

  it('PUT /api/profiles/:id/plan sets the active plan', async () => {
    const id = await createProfile()
    const put = await request(app).put(`/api/profiles/${id}/plan`).send(plan)
    expect(put.status).toBe(201)
    expect(put.body).toMatchObject({ ...plan, profileId: id, active: true })
    expect(typeof put.body.id).toBe('string')

    const get = await request(app).get(`/api/profiles/${id}/plan`)
    expect(get.status).toBe(200)
    expect(get.body.id).toBe(put.body.id)
  })

  it('PUT again replaces the active plan and keeps the old one in history', async () => {
    const id = await createProfile()
    const first = await request(app).put(`/api/profiles/${id}/plan`).send(plan)
    const second = await request(app).put(`/api/profiles/${id}/plan`).send({ ...plan, reps: 10 })
    expect(second.status).toBe(201)

    const active = await request(app).get(`/api/profiles/${id}/plan`)
    expect(active.body.id).toBe(second.body.id)
    expect(active.body.reps).toBe(10)

    const history = await request(app).get(`/api/profiles/${id}/plans`)
    expect(history.status).toBe(200)
    expect(history.body).toHaveLength(2)
    expect(history.body.filter((p: { active: boolean }) => p.active)).toHaveLength(1)
    expect(history.body.find((p: { id: string }) => p.id === first.body.id).active).toBe(false)
  })

  it('PATCH /api/profiles/:id/plan updates part of the active plan', async () => {
    const id = await createProfile()
    await request(app).put(`/api/profiles/${id}/plan`).send(plan)
    const res = await request(app).patch(`/api/profiles/${id}/plan`).send({ reps: 12, restSeconds: 60 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ...plan, reps: 12, restSeconds: 60, active: true })
  })

  it('validates bodies and profile ids', async () => {
    const id = await createProfile()
    expect((await request(app).put(`/api/profiles/${id}/plan`).send({ ...plan, reps: 0 })).status).toBe(400)
    expect((await request(app).patch(`/api/profiles/${id}/plan`).send({ reps: 12 })).status).toBe(404)
    expect((await request(app).put('/api/profiles/64b64b64b64b64b64b64b64b/plan').send(plan)).status).toBe(404)
    expect((await request(app).put('/api/profiles/bad/plan').send(plan)).status).toBe(404)
  })
})
