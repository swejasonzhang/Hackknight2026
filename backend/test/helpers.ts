import type { CreateSessionInput, RepRecord, SetRecord } from '@ptg/dependencies'
import request, { type Test } from 'supertest'
import { createApp } from '../src/app.ts'

export const app = createApp({ allowDevRoutes: true })

/** A supertest client that sends the same credentials on every request. */
export interface Client {
  token: string
  userId: string
  get(url: string): Test
  post(url: string): Test
  put(url: string): Test
  patch(url: string): Test
  delete(url: string): Test
}

function withHeader(name: string, value: string, token = '', userId = ''): Client {
  const h = (t: Test) => t.set(name, value)
  return {
    token,
    userId,
    get: (u) => h(request(app).get(u)),
    post: (u) => h(request(app).post(u)),
    put: (u) => h(request(app).put(u)),
    patch: (u) => h(request(app).patch(u)),
    delete: (u) => h(request(app).delete(u)),
  }
}

let counter = 0

/** Signs up a fresh account and returns an authenticated client. */
export async function signup(name = 'Ada Lovelace'): Promise<Client> {
  const email = `user${++counter}@example.com`
  const res = await request(app).post('/api/auth/signup').send({ name, email, password: 'correct horse battery' })
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`)
  return withHeader('Authorization', `Bearer ${res.body.token}`, res.body.token, res.body.user.id)
}

/** The computer-vision module: no account, just the shared API key. */
export function service(): Client {
  return withHeader('x-api-key', process.env.CV_API_KEY ?? '')
}

/** Unauthenticated requests. */
export const anon = request(app)

export async function createProfile(c: Client, name = 'Ada Lovelace'): Promise<string> {
  const res = await c.post('/api/profiles').send({ name })
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
