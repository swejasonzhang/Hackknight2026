import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoachMessage } from '../src/models/CoachMessage.ts'
import { resetSpeechCache } from '../src/services/voice.ts'
import { createProfile, makeSession, service, signup } from './helpers.ts'

const realFetch = globalThis.fetch
type Call = { url: string; init: RequestInit }
function stubOutside(handler: (call: Call) => Response) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', async (url: string | URL, init: RequestInit = {}) => {
    const call = { url: String(url), init }
    calls.push(call)
    return handler(call)
  })
  return calls
}
const mp3 = () => new Response(new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/mpeg' } })
const gemini = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })
const LIVE = { setNumber: 2, setsPlanned: 3, repsInSet: 4, repsPlanned: 8, totalReps: 12, recentPeaks: [128, 126, 121, 117], bestDeg: 133, targetDeg: 140, phase: 'active' as const }

describe("Arc's voice for any line (POST /api/coach/speak)", () => {
  beforeEach(() => {
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.COACH_MAX_PER_MINUTE
    resetSpeechCache()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    globalThis.fetch = realFetch
  })

  it('speaks a short line with ElevenLabs, the key in a header, and serves a repeat from memory', async () => {
    process.env.ELEVENLABS_API_KEY = 'e-secret'
    const calls = stubOutside(() => mp3())
    const c = await signup()
    const first = await c.post('/api/coach/speak').send({ text: 'Paused.' }).buffer(true)
    expect(first.status).toBe(200)
    expect(first.headers['content-type']).toMatch(/audio\/mpeg/)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toMatch(/api\.elevenlabs\.io/)
    expect(calls[0]!.url).not.toContain('e-secret')
    expect((calls[0]!.init.headers as Record<string, string>)['xi-api-key']).toBe('e-secret')
    await c.post('/api/coach/speak').send({ text: 'Paused.' })
    expect(calls).toHaveLength(1) // the second time came from the cache
  })

  it('answers 503 without ElevenLabs, refuses long text, and is for members only', async () => {
    const c = await signup()
    expect((await c.post('/api/coach/speak').send({ text: 'Paused.' })).status).toBe(503)
    process.env.ELEVENLABS_API_KEY = 'e-secret'
    expect((await c.post('/api/coach/speak').send({ text: 'x'.repeat(400) })).status).toBe(400)
    expect((await service().post('/api/coach/speak').send({ text: 'Paused.' })).status).toBe(403)
  })
})

describe('talking to Arc mid-workout (POST /api/coach/ask)', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY
    delete process.env.COACH_MAX_PER_MINUTE
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    globalThis.fetch = realFetch
  })

  const ask = async (text: string) => {
    const c = await signup()
    const profileId = await createProfile(c)
    const res = await c.post('/api/coach/ask').send({ profileId, exercise: 'elbow_flexion', side: 'right', text, live: LIVE })
    return { c, res }
  }

  it('answers how am I doing with the live numbers, and keeps both lines', async () => {
    const { res } = await ask('Arc, how am I doing?')
    expect(res.status).toBe(200)
    expect(res.body.text).toMatch(/set 2 of 3/i)
    expect(res.body.text).toMatch(/133/)
    expect(res.body.text).toMatch(/140/)
    expect(await CoachMessage.countDocuments({ kind: 'ask' })).toBe(2)
  })

  it('takes pain seriously: stop, and check with a professional', async () => {
    const { res } = await ask('my elbow hurts a lot')
    expect(res.body.text).toMatch(/stop/i)
    expect(res.body.text).toMatch(/professional/i)
  })

  it('reads the form question against the last reps', async () => {
    const { res } = await ask('is my form ok')
    // The last rep reached 117 of a 140 goal, fading from 128.
    expect(res.body.text).toMatch(/117/)
    expect(res.body.text).toMatch(/deeper|further|fad/i)
  })

  it('with Gemini, answers in its words, given the live numbers', async () => {
    process.env.GEMINI_API_KEY = 'g-secret'
    const calls = stubOutside(() => gemini('Nice work, keep the last reps slow.'))
    const { res } = await ask('this feels hard')
    expect(res.body).toMatchObject({ text: 'Nice work, keep the last reps slow.', offline: false })
    const body = String(calls[0]!.init.body)
    expect(body).toMatch(/128, 126, 121, 117/)
    expect(body).toMatch(/this feels hard/)
  })

  it('is for members and their own profiles only', async () => {
    const c = await signup()
    const other = await signup('Grace Hopper')
    const theirs = await createProfile(other)
    expect((await c.post('/api/coach/ask').send({ profileId: theirs, exercise: 'elbow_flexion', side: 'right', text: 'hi', live: LIVE })).status).toBe(404)
    expect((await service().post('/api/coach/ask').send({ profileId: theirs, exercise: 'elbow_flexion', side: 'right', text: 'hi', live: LIVE })).status).toBe(403)
  })
})

describe("Arc's own reads are specific (Gemini off)", () => {
  it('reads a set back with its best, its lowest, how many reached the goal, the tempo and one concrete step', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const peaks = [142, 141, 138, 133, 129, 124]
    const reps = peaks.map((peakDeg, i) => ({ index: i + 1, peakDeg, startedAt: 1_000 + i * 3000, endedAt: 3_000 + i * 3000 + i * 150, durationMs: 2000 + i * 150 }))
    const res = await c.post('/api/coach/sets').send({ profileId, exercise: 'elbow_flexion', side: 'right', plan: { sets: 3, reps: 6, restSeconds: 45, targetDeg: 140 }, setNumber: 1, reps })
    const text = res.body.text as string
    expect(text).toMatch(/142/) // best
    expect(text).toMatch(/124/) // lowest
    expect(text).toMatch(/2 of 6 reps reached your 140/i)
    expect(text).toMatch(/second/i) // tempo
    expect(text).toMatch(/next set/i) // one concrete step
  })

  it('counts only good-form reps: says how many did not count, why, and makes the fix the next step', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const reps = [140, 141, 139, 142].map((peakDeg, i) => ({ index: i + 1, peakDeg, startedAt: 1_000 + i * 3000, endedAt: 3_000 + i * 3000, durationMs: 2000 }))
    const rejected = [
      { at: 4_000, fault: 'upper_arm_moved' },
      { at: 9_000, fault: 'upper_arm_moved' },
      { at: 12_000, fault: 'too_fast' },
    ]
    const text = (await c.post('/api/coach/sets').send({ profileId, exercise: 'elbow_flexion', side: 'right', plan: { sets: 3, reps: 4, restSeconds: 45, targetDeg: 140 }, setNumber: 1, reps, rejected })).body.text as string
    expect(text).toMatch(/3 reps did not count for form: the upper arm moved \(2\), too quick\./)
    expect(text).toMatch(/Next set, keep your upper arm still\./)
    expect((await c.post('/api/coach/sets').send({ profileId, exercise: 'elbow_flexion', side: 'right', plan: { sets: 3, reps: 4, restSeconds: 45, targetDeg: 140 }, setNumber: 1, reps, rejected: [{ at: 1, fault: 'cheating' }] })).status).toBe(400)
  })

  it('keeps the reps a set refused with the session', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const body = makeSession(profileId)
    body.sets[0]!.rejected = [{ at: body.sets[0]!.endedAt, fault: 'body_swing' }]
    const saved = (await c.post('/api/sessions').send(body)).body
    expect(saved.sets[0].rejected).toEqual([{ at: body.sets[0]!.endedAt, fault: 'body_swing' }])
    expect(saved.sets[1]).not.toHaveProperty('rejected')
  })
})
