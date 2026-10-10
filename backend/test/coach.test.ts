import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoachMessage } from '../src/models/CoachMessage.ts'
import { createProfile, makeSession, service, signup } from './helpers.ts'

const realFetch = globalThis.fetch
type Call = { url: string; init: RequestInit }

/** Stubs only the outside world (Gemini, ElevenLabs); supertest talks to the app directly. */
function stubOutside(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', async (url: string | URL, init: RequestInit = {}) => {
    const call = { url: String(url), init }
    calls.push(call)
    return handler(call)
  })
  return calls
}
const gemini = (json: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }), { status: 200 })
const geminiText = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })

const ANSWERS = [
  'I want to bend my knee all the way again after surgery',
  'Build some muscle',
  'My knee',
  'The left one',
  'It was surgery in March, a bit stiff',
  "I'm new to this",
  'Monday, Wednesday and Friday',
  `5'6"`,
  'skip',
]
/** Gemini's two jobs in one stub: the chat turn, and the week (asked with its own instructions). */
const isWeekCall = (call: Call) => String(call.init.body).includes("Build the member's training week")

describe('Arc, the coach', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.COACH_MAX_PER_MINUTE
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    globalThis.fetch = realFetch
  })

  it('reports which services are configured', async () => {
    const c = await signup()
    expect((await c.get('/api/coach/status')).body).toEqual({ gemini: false, voice: false })
    process.env.GEMINI_API_KEY = 'g-key'
    process.env.ELEVENLABS_API_KEY = 'e-key'
    expect((await c.get('/api/coach/status')).body).toEqual({ gemini: true, voice: true })
  })

  it('is for signed-in people only, not the camera app key', async () => {
    expect((await service().post('/api/coach/onboarding').send({ messages: [] })).status).toBe(403)
  })

  describe('onboarding after sign-up', () => {
    it('without Gemini, asks its questions one topic at a time, then saves the profile, the week and a plan from the answers', async () => {
      const c = await signup('Rose Tan')
      const messages: { role: 'arc' | 'user'; text: string }[] = []
      let res = await c.post('/api/coach/onboarding').send({ messages })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ offline: true, done: false, topic: 'goals' })
      expect(res.body.reply).toMatch(/Arc/)
      messages.push({ role: 'arc', text: res.body.reply })
      const topics: string[] = [res.body.topic]
      for (const answer of ANSWERS) {
        messages.push({ role: 'user', text: answer })
        res = await c.post('/api/coach/onboarding').send({ messages })
        messages.push({ role: 'arc', text: res.body.reply })
        if (res.body.topic) topics.push(res.body.topic)
      }
      expect(topics).toEqual(['goals', 'trainingGoal', 'focus', 'side', 'limitations', 'experience', 'days', 'height', 'weight'])
      expect(res.body.done).toBe(true)
      expect(res.body.topic).toBeUndefined()
      expect(res.body.intake).toMatchObject({ focus: 'seated_knee_extension', side: 'left', experience: 'new', daysPerWeek: 3, trainingGoal: 'hypertrophy', trainingDays: [1, 3, 5], heightCm: 168 })
      expect(res.body.intake).not.toHaveProperty('weightKg')
      expect(res.body.intake.goals).toMatch(/bend my knee/)
      // Muscle size, someone new: the bottom of 3-5 sets and 8-12 reps, the top of 60-180 s rest.
      expect(res.body.program).toMatchObject({ source: 'arc', active: true })
      expect(res.body.program.days.map((d: { weekday: number }) => d.weekday)).toEqual([1, 3, 5])
      expect(res.body.program.days[0].items).toEqual([{ exercise: 'seated_knee_extension', side: 'left', sets: 3, reps: 8, restSeconds: 180, targetDeg: 175 }])
      expect(res.body.plan).toMatchObject({ exercise: 'seated_knee_extension', side: 'left', sets: 3, reps: 8, restSeconds: 180, targetDeg: 175 })
      expect(res.body.reply).toMatch(/Monday, Wednesday and Friday/)

      const profiles = (await c.get('/api/profiles')).body
      expect(profiles).toHaveLength(1)
      expect(profiles[0]).toMatchObject({ id: res.body.profileId, name: 'Rose Tan' })
      expect(profiles[0].intake).toMatchObject({ focus: 'seated_knee_extension', trainingGoal: 'hypertrophy', heightCm: 168 })
      expect((await c.get(`/api/profiles/${res.body.profileId}/program`)).body).toEqual(res.body.program)
      // Every line of the chat is kept.
      expect(await CoachMessage.countDocuments({ kind: 'onboarding' })).toBe(19)
    })

    it('runs again for an existing profile and replaces its week, keeping one active', async () => {
      const c = await signup()
      const profileId = await createProfile(c, 'Grace')
      const messages: { role: 'arc' | 'user'; text: string }[] = []
      let res
      for (const answer of [...ANSWERS, 'unused']) {
        res = await c.post('/api/coach/onboarding').send({ messages, profileId })
        if (res.body.done) break
        messages.push({ role: 'arc', text: res.body.reply }, { role: 'user', text: answer })
      }
      expect(res!.body).toMatchObject({ done: true, profileId })
      const again = await c.post('/api/coach/onboarding').send({ messages, profileId })
      expect(again.body.program.id).not.toBe(res!.body.program.id)
      expect((await c.get(`/api/profiles/${profileId}/program`)).body.id).toBe(again.body.program.id)
    })

    it('with Gemini, sends the conversation with Arc as the persona and the key in a header, never the URL', async () => {
      process.env.GEMINI_API_KEY = 'g-secret'
      const intake = { goals: 'Lift my arm overhead again', trainingGoal: 'strength', focus: 'shoulder_abduction', side: 'right', limitations: 'none', experience: 'regular', trainingDays: [2, 4], daysPerWeek: 4, heightCm: null, weightKg: 70.4 }
      const calls = stubOutside((call) => (isWeekCall(call) ? new Response('bad request', { status: 400 }) : gemini({ reply: 'Great, your week is ready, Ada.', done: true, intake })))
      const c = await signup()
      const res = await c.post('/api/coach/onboarding').send({ messages: [{ role: 'arc', text: 'Hi, I am Arc.' }, { role: 'user', text: 'I want to raise my right arm overhead' }] })
      expect(res.body).toMatchObject({ done: true, offline: false, reply: 'Great, your week is ready, Ada.' })
      // Days counted from the days themselves; a skipped height is left out.
      expect(res.body.intake).toMatchObject({ trainingDays: [2, 4], daysPerWeek: 2, weightKg: 70 })
      expect(res.body.intake).not.toHaveProperty('heightCm')
      // Gemini's week failed, so Arc built its own: strength, regular, the top of 2-4 sets and 2-6 reps.
      expect(res.body.program.source).toBe('arc')
      expect(res.body.plan).toMatchObject({ exercise: 'shoulder_abduction', side: 'right', sets: 4, reps: 6, restSeconds: 120 })
      const [call] = calls
      expect(call!.url).toMatch(/generativelanguage\.googleapis\.com/)
      expect(call!.url).not.toContain('g-secret')
      expect((call!.init.headers as Record<string, string>)['x-goog-api-key']).toBe('g-secret')
      const body = JSON.parse(String(call!.init.body))
      expect(body.systemInstruction.parts[0].text).toMatch(/Your name is Arc/)
      expect(JSON.stringify(body.contents)).toContain('raise my right arm overhead')
    })

    it("with Gemini, Gemini writes the week, held to the member's days, the catalog and the goal's ranges", async () => {
      process.env.GEMINI_API_KEY = 'g-secret'
      const intake = { goals: 'Bend my elbow fully', trainingGoal: 'endurance', focus: 'elbow_flexion', side: 'left', limitations: 'none', experience: 'some', trainingDays: [1, 3, 5], daysPerWeek: 3 }
      const week = {
        summary: 'Three light days, lots of reps.',
        days: [
          { weekday: 1, title: 'Elbow and shoulder', items: [{ exercise: 'elbow_flexion', side: 'left', sets: 3, reps: 40, restSeconds: 5 }, { exercise: 'shoulder_abduction', side: 'left', sets: 2, reps: 15, restSeconds: 45 }] },
          { weekday: 2, title: 'Not a training day', items: [{ exercise: 'elbow_flexion', side: 'left', sets: 3, reps: 15, restSeconds: 45 }] },
          { weekday: 3, title: 'Made up', items: [{ exercise: 'deadlift', side: 'left', sets: 3, reps: 15, restSeconds: 45 }] },
        ],
      }
      const calls = stubOutside((call) => (isWeekCall(call) ? gemini(week) : gemini({ reply: 'All set.', done: true, intake })))
      const c = await signup()
      const res = await c.post('/api/coach/onboarding').send({ messages: [{ role: 'user', text: 'Ready' }] })
      const program = res.body.program
      expect(program).toMatchObject({ source: 'gemini', summary: 'Three light days, lots of reps.' })
      expect(program.days.map((d: { weekday: number }) => d.weekday)).toEqual([1, 3, 5])
      // Out-of-range numbers pulled back into stamina's 13-25 reps and 30-60 s; the goal angle from the catalog.
      expect(program.days[0]).toMatchObject({ title: 'Elbow and shoulder', items: [{ exercise: 'elbow_flexion', reps: 25, restSeconds: 30, targetDeg: 140 }, { exercise: 'shoulder_abduction' }] })
      // Wednesday held only an unknown movement and Friday was missing: both filled from Arc's own week.
      expect(program.days[1].items[0]).toMatchObject({ exercise: 'elbow_flexion', side: 'left' })
      expect(program.days[2].items[0]).toMatchObject({ exercise: 'elbow_flexion', side: 'left' })
      const weekCall = calls.find(isWeekCall)!
      expect(String(weekCall.init.body)).toMatch(/13 to 25 reps/)
      expect(weekCall.url).not.toContain('g-secret')
    })

    it('tells the page which topic Gemini is asking about', async () => {
      process.env.GEMINI_API_KEY = 'g-secret'
      stubOutside(() => gemini({ reply: 'Left or right?', done: false, topic: 'side', intake: null }))
      const c = await signup()
      const res = await c.post('/api/coach/onboarding').send({ messages: [{ role: 'user', text: 'My knee' }] })
      expect(res.body).toMatchObject({ done: false, topic: 'side', reply: 'Left or right?' })
    })

    it('falls back to its scripted questions when Gemini fails', async () => {
      process.env.GEMINI_API_KEY = 'g-secret'
      stubOutside(() => new Response('overloaded', { status: 503 }))
      const c = await signup()
      const res = await c.post('/api/coach/onboarding').send({ messages: [] })
      expect(res.status).toBe(200)
      expect(res.body.offline).toBe(true)
      expect(res.body.reply).toMatch(/Arc/)
    })
  })

  it('reads a set back in plain English for the rest, and keeps it', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const reps = [130, 128, 126].map((peakDeg, i) => ({ index: i + 1, peakDeg, startedAt: 1_000 + i * 3000, endedAt: 3_000 + i * 3000, durationMs: 2000 }))
    const res = await c.post('/api/coach/sets').send({ profileId, exercise: 'elbow_flexion', side: 'right', plan: { sets: 3, reps: 3, restSeconds: 45, targetDeg: 140 }, setNumber: 1, reps })
    expect(res.status).toBe(200)
    expect(res.body.text).toMatch(/set 1/i)
    expect(res.body.text).toMatch(/130/)
    expect(await CoachMessage.countDocuments({ kind: 'set' })).toBe(1)
  })

  it('summarises a saved session once, compared with the one before, and stores it on the session', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    await c.post('/api/sessions').send(makeSession(profileId, { startedAt: Date.UTC(2026, 9, 1), peaks: [118, 116, 115, 114] }))
    const latest = await c.post('/api/sessions').send(makeSession(profileId, { startedAt: Date.UTC(2026, 9, 8), peaks: [126, 125, 123, 122] }))
    const first = await c.post(`/api/coach/sessions/${latest.body.id}/summary`)
    expect(first.status).toBe(200)
    expect(first.body.text).toMatch(/126/)
    expect(first.body.text).toMatch(/8 more|up 8|\+8/i)
    const again = await c.post(`/api/coach/sessions/${latest.body.id}/summary`)
    expect(again.body.id).toBe(first.body.id)
    const stored = (await c.get(`/api/sessions/${latest.body.id}`)).body
    expect(stored.coachSummary).toMatchObject({ text: first.body.text, messageId: first.body.id, offline: true })
  })

  it("with Gemini, the session read is Gemini's words, given the numbers and the history", async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    await c.post('/api/sessions').send(makeSession(profileId, { startedAt: Date.UTC(2026, 9, 1), peaks: [118, 116, 115, 114] }))
    const latest = await c.post('/api/sessions').send(makeSession(profileId, { startedAt: Date.UTC(2026, 9, 8), peaks: [126, 125, 123, 122] }))
    process.env.GEMINI_API_KEY = 'g-secret'
    const calls = stubOutside(() => geminiText('Your best rep hit 126 degrees, eight more than last week.'))
    const res = await c.post(`/api/coach/sessions/${latest.body.id}/summary`)
    expect(res.body).toMatchObject({ text: 'Your best rep hit 126 degrees, eight more than last week.', offline: false })
    const prompt = JSON.stringify(JSON.parse(String(calls[0]!.init.body)).contents)
    expect(prompt).toContain('best 126')
    expect(prompt).toContain('best 118')
  })

  it('speaks a message with ElevenLabs, only to its owner', async () => {
    const c = await signup()
    const other = await signup('Someone Else')
    const profileId = await createProfile(c)
    const reps = [{ index: 1, peakDeg: 120, startedAt: 1000, endedAt: 3000, durationMs: 2000 }]
    const msg = (await c.post('/api/coach/sets').send({ profileId, exercise: 'elbow_flexion', side: 'right', plan: { sets: 1, reps: 1, restSeconds: 45, targetDeg: 140 }, setNumber: 1, reps })).body

    expect((await c.get(`/api/coach/messages/${msg.id}/audio`)).status).toBe(503)

    process.env.ELEVENLABS_API_KEY = 'e-secret'
    const calls = stubOutside(() => new Response(new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }))
    const audio = await c.get(`/api/coach/messages/${msg.id}/audio`).buffer(true)
    expect(audio.status).toBe(200)
    expect(audio.headers['content-type']).toMatch(/audio\/mpeg/)
    expect(Buffer.from(audio.body).subarray(0, 3).toString()).toBe('ID3')
    const [call] = calls
    expect(call!.url).toMatch(/api\.elevenlabs\.io\/v1\/text-to-speech\//)
    expect((call!.init.headers as Record<string, string>)['xi-api-key']).toBe('e-secret')
    expect(JSON.parse(String(call!.init.body))).toMatchObject({ text: msg.text, model_id: 'eleven_turbo_v2_5' })

    expect((await other.get(`/api/coach/messages/${msg.id}/audio`)).status).toBe(404)
  })

  it('limits how often one account can call Arc', async () => {
    process.env.COACH_MAX_PER_MINUTE = '2'
    const c = await signup()
    expect((await c.post('/api/coach/onboarding').send({ messages: [] })).status).toBe(200)
    expect((await c.post('/api/coach/onboarding').send({ messages: [] })).status).toBe(200)
    expect((await c.post('/api/coach/onboarding').send({ messages: [] })).status).toBe(429)
  })
})

describe('voice commands on a session', () => {
  it('are stored with the session and returned in order', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const body = { ...makeSession(profileId), events: [{ at: 1_700_000_000_000, command: 'pause' }, { at: 1_700_000_005_000, command: 'resume' }] }
    const res = await c.post('/api/sessions').send(body)
    expect(res.status).toBe(201)
    expect((await c.get(`/api/sessions/${res.body.id}`)).body.events).toEqual(body.events)
    expect((await c.post('/api/sessions').send({ ...body, events: [{ at: 1, command: 'self-destruct' }] })).status).toBe(400)
  })
})
