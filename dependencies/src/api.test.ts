import { describe, expect, it } from 'vitest'
import { CreateProfileSchema, CreateSessionSchema, PlanInputSchema, UpdatePlanSchema } from './api.ts'

const validSession = {
  profileId: 'abc',
  exercise: 'elbow_flexion',
  side: 'right',
  startedAt: 1000,
  endedAt: 90000,
  plan: { sets: 1, reps: 2, restSeconds: 30, targetDeg: 140 },
  sets: [
    {
      setNumber: 1,
      reps: [
        { index: 1, peakDeg: 120, startedAt: 1000, endedAt: 3000, durationMs: 2000 },
        { index: 2, peakDeg: 118, startedAt: 4000, endedAt: 6000, durationMs: 2000 },
      ],
      fatigue: { index: 0, romDecay: 0, tempoDrift: 0, romDropDeg: 0, sampleReps: 2 },
      startedAt: 1000,
      endedAt: 6000,
      endedEarly: false,
    },
  ],
}

describe('API schemas', () => {
  it('CreateProfileSchema trims the name and rejects an empty one', () => {
    expect(CreateProfileSchema.parse({ name: '  Ada ' }).name).toBe('Ada')
    expect(CreateProfileSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(CreateProfileSchema.safeParse({ name: 'Ada', email: 'not-an-email' }).success).toBe(false)
  })

  it('PlanInputSchema enforces ranges and UpdatePlanSchema allows partial bodies', () => {
    const ok = { exercise: 'elbow_flexion', side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg: 140 }
    expect(PlanInputSchema.safeParse(ok).success).toBe(true)
    expect(PlanInputSchema.safeParse({ ...ok, reps: 0 }).success).toBe(false)
    expect(PlanInputSchema.safeParse({ ...ok, exercise: 'jumping_jacks' }).success).toBe(false)
    expect(UpdatePlanSchema.safeParse({ reps: 10 }).success).toBe(true)
  })

  it('CreateSessionSchema accepts a valid session and rejects an empty or inverted one', () => {
    expect(CreateSessionSchema.safeParse(validSession).success).toBe(true)
    expect(CreateSessionSchema.safeParse({ ...validSession, sets: [] }).success).toBe(false)
    expect(CreateSessionSchema.safeParse({ ...validSession, endedAt: 10 }).success).toBe(false)
  })
})
