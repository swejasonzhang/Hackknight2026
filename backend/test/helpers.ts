import type { CreateSessionInput, RepRecord, SetRecord } from '@ptg/dependencies'
import request from 'supertest'
import { createApp } from '../src/app.ts'

export const app = createApp({ allowDevRoutes: true })

export async function createProfile(name = 'Ada Lovelace'): Promise<string> {
  const res = await request(app).post('/api/profiles').send({ name })
  if (res.status !== 201) throw new Error(`createProfile failed: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body.id as string
}

export function makeReps(peaks: number[], startedAt: number, durationMs = 2000): RepRecord[] {
  let t = startedAt
  return peaks.map((peakDeg, i) => {
    const rep = { index: i + 1, peakDeg, startedAt: t, endedAt: t + durationMs, durationMs }
    t += durationMs + 500
    return rep
  })
}

export function makeSet(setNumber: number, peaks: number[], startedAt: number): SetRecord {
  const reps = makeReps(peaks, startedAt)
  return {
    setNumber,
    reps,
    // Deliberately wrong: the server must recompute fatigue from the reps.
    fatigue: { index: 0.99, romDecay: 0.99, tempoDrift: 0.99, romDropDeg: 99, sampleReps: 0 },
    startedAt,
    endedAt: reps.at(-1)!.endedAt,
    endedEarly: false,
  }
}

/** A valid session body: 2 sets x 4 reps with slightly declining range. */
export function makeSession(profileId: string, overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  const startedAt = overrides.startedAt ?? Date.UTC(2026, 9, 1, 18, 0, 0)
  const set1 = makeSet(1, [120, 119, 117, 114], startedAt + 5_000)
  const set2 = makeSet(2, [116, 115, 112, 110], set1.endedAt + 45_000)
  return {
    profileId,
    exercise: 'elbow_flexion',
    side: 'right',
    startedAt,
    endedAt: set2.endedAt + 2_000,
    plan: { sets: 2, reps: 4, restSeconds: 45, targetDeg: 140 },
    sets: [set1, set2],
    ...overrides,
  }
}
