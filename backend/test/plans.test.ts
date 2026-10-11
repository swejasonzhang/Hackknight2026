import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { Plan } from '../src/models/Plan.ts'
import { Program } from '../src/models/Program.ts'
import { createProfile, signup } from './helpers.ts'

const plan = { exercise: 'elbow_flexion', side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg: 140 }

describe('plans', () => {
  it('serves a goal saved before its movement\'s range was narrowed inside the range it has now', async () => {
    const c = await signup()
    const id = await createProfile(c)
    // A front raise's goal from when it ran to 135°; its end is 110° now.
    await Plan.collection.insertOne({ profileId: new mongoose.Types.ObjectId(id), exercise: 'front_raise', side: 'right', sets: 3, reps: 10, restSeconds: 45, targetDeg: 135, active: true, createdAt: Date.now() })
    expect((await c.get(`/api/profiles/${id}/plan`)).body.targetDeg).toBe(110)
    const day = { weekday: 1, title: 'Shoulders', items: [{ exercise: 'front_raise', side: 'right', sets: 3, reps: 10, restSeconds: 45, targetDeg: 95 }] }
    await c.put(`/api/profiles/${id}/program`).send({ days: [day] })
    await Program.collection.updateMany({}, { $set: { 'days.0.items.0.targetDeg': 135 } })
    expect((await c.get(`/api/profiles/${id}/program`)).body.days[0].items[0].targetDeg).toBe(110)
  })

  it('GET /api/profiles/:id/plan is 404 before a plan is assigned', async () => {
    const c = await signup()
    const id = await createProfile(c)
    const res = await c.get(`/api/profiles/${id}/plan`)
    expect(res.status).toBe(404)
  })

  it('PUT /api/profiles/:id/plan sets the active plan', async () => {
    const c = await signup()
    const id = await createProfile(c)
    const put = await c.put(`/api/profiles/${id}/plan`).send(plan)
    expect(put.status).toBe(201)
    expect(put.body).toMatchObject({ ...plan, profileId: id, active: true })
    expect(typeof put.body.id).toBe('string')

    const get = await c.get(`/api/profiles/${id}/plan`)
    expect(get.status).toBe(200)
    expect(get.body.id).toBe(put.body.id)
  })

  it('PUT again replaces the active plan and keeps the old one in history', async () => {
    const c = await signup()
    const id = await createProfile(c)
    const first = await c.put(`/api/profiles/${id}/plan`).send(plan)
    const second = await c.put(`/api/profiles/${id}/plan`).send({ ...plan, reps: 10 })
    expect(second.status).toBe(201)

    const active = await c.get(`/api/profiles/${id}/plan`)
    expect(active.body.id).toBe(second.body.id)
    expect(active.body.reps).toBe(10)

    const history = await c.get(`/api/profiles/${id}/plans`)
    expect(history.status).toBe(200)
    expect(history.body).toHaveLength(2)
    expect(history.body.filter((p: { active: boolean }) => p.active)).toHaveLength(1)
    expect(history.body.find((p: { id: string }) => p.id === first.body.id).active).toBe(false)
  })

  it('PATCH /api/profiles/:id/plan updates part of the active plan', async () => {
    const c = await signup()
    const id = await createProfile(c)
    await c.put(`/api/profiles/${id}/plan`).send(plan)
    const res = await c.patch(`/api/profiles/${id}/plan`).send({ reps: 12, restSeconds: 60 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ...plan, reps: 12, restSeconds: 60, active: true })
  })

  it('validates bodies and profile ids', async () => {
    const c = await signup()
    const id = await createProfile(c)
    expect((await c.put(`/api/profiles/${id}/plan`).send({ ...plan, reps: 0 })).status).toBe(400)
    expect((await c.patch(`/api/profiles/${id}/plan`).send({ reps: 12 })).status).toBe(404)
    expect((await c.put('/api/profiles/64b64b64b64b64b64b64b64b/plan').send(plan)).status).toBe(404)
    expect((await c.put('/api/profiles/bad/plan').send(plan)).status).toBe(404)
  })
})
