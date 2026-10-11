import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearToken, getToken, setToken, SIGNED_OUT_EVENT } from '../auth/token'
import { api, ApiRequestError } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('api client', () => {
  beforeEach(() => clearToken())
  afterEach(() => vi.unstubAllGlobals())

  it('posts JSON and returns the parsed body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'p1', name: 'Ada', createdAt: 1 }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const profile = await api.profiles.create({ name: 'Ada' })
    expect(profile.id).toBe('p1')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/profiles')
    expect(init.method).toBe('POST')
    expect(init.headers['content-type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ name: 'Ada' })
  })

  it("sends the browser's timezone offset when loading demo data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ profileId: 'p1', sessions: 40, created: true }, 201))
    vi.stubGlobal('fetch', fetchMock)
    await api.dev.seed()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/dev/seed')
    expect(JSON.parse(init.body)).toEqual({ tzOffsetMinutes: new Date().getTimezoneOffset() })
  })

  it('saves a recorded session as the signed-in user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 's1' }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const input = { profileId: 'p1', exercise: 'elbow_flexion' as const, side: 'right' as const, startedAt: 1, endedAt: 2, plan: { sets: 1, reps: 1, restSeconds: 45, targetDeg: 140 }, sets: [] }
    await api.sessions.create(input)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/sessions')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(input)
  })

  it("fetches Arc's voice for a message with the member's token", async () => {
    setToken('abc.def.ghi')
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([0x49, 0x44, 0x33]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }))
    vi.stubGlobal('fetch', fetchMock)
    const blob = await api.coach.audio('m1')
    expect(blob.size).toBe(3)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/coach/messages/m1/audio')
    expect(init.headers.authorization).toBe('Bearer abc.def.ghi')
  })

  it("sends the onboarding chat to Arc", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ reply: 'Hi, I am Arc.', messageId: 'm1', done: false, offline: true }))
    vi.stubGlobal('fetch', fetchMock)
    const reply = await api.coach.onboarding({ messages: [] })
    expect(reply.reply).toBe('Hi, I am Arc.')
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/coach/onboarding')
  })

  it('builds query strings for progress', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ sessions: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await api.progress('p1', 'elbow_flexion')
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/profiles/p1/progress?exercise=elbow_flexion')
  })

  it("changes a profile's figure with PATCH, and clears it with null", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ id: 'p1', name: 'Ada', figure: 'female', createdAt: 1 })))
    vi.stubGlobal('fetch', fetchMock)
    const profile = await api.profiles.update('p1', { figure: 'female' })
    expect(profile.figure).toBe('female')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/profiles/p1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ figure: 'female' })
    await api.profiles.update('p1', { figure: null })
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ figure: null })
  })

  it('fetches the body the training grew', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ profileId: 'p1', figure: null, asOf: 1, overall: 0, muscles: {}, weeks: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const body = await api.body('p1')
    expect(body).toMatchObject({ profileId: 'p1', figure: null, weeks: [] })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/profiles/p1/body')
    expect(init.method).toBe('GET')
  })

  it("starts a challenge with the browser's timezone offset, reads it back and leaves it", async () => {
    const run = { id: 'r1', profileId: 'p1', challengeId: 'summer_body', startedAt: 1, status: 'active', phase: 0 }
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve(init.method === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse(run, init.method === 'POST' ? 201 : 200)),
    )
    vi.stubGlobal('fetch', fetchMock)
    expect(await api.challenge.start('p1', { challengeId: 'summer_body', tzOffsetMinutes: 240 })).toEqual(run)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/profiles/p1/challenge')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ challengeId: 'summer_body', tzOffsetMinutes: 240 })

    expect(await api.challenge.get('p1')).toEqual(run)
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/profiles/p1/challenge')
    expect(fetchMock.mock.calls[1]![1].method).toBe('GET')

    await api.challenge.leave('p1')
    expect(fetchMock.mock.calls[2]![0]).toBe('/api/profiles/p1/challenge')
    expect(fetchMock.mock.calls[2]![1]).toMatchObject({ method: 'DELETE', body: undefined })
  })

  it('reports no challenge as a 404, so the page can tell it from a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'No challenge' }, 404)))
    await expect(api.challenge.get('p1')).rejects.toMatchObject({ status: 404, message: 'No challenge' })
  })

  it('throws ApiRequestError with the server message on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ error: 'Invalid request', issues: [] }, 400))))
    await expect(api.profiles.create({ name: '' })).rejects.toMatchObject({ status: 400, message: 'Invalid request' })
    await expect(api.profiles.create({ name: '' })).rejects.toBeInstanceOf(ApiRequestError)
  })

  it('sends the stored token as a Bearer header', async () => {
    setToken('abc.def.ghi')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)
    await api.profiles.list()
    expect(fetchMock.mock.calls[0]![1].headers.authorization).toBe('Bearer abc.def.ghi')
  })

  it('clears the token and announces sign-out on 401', async () => {
    setToken('expired')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Not signed in' }, 401)))
    const listener = vi.fn()
    window.addEventListener(SIGNED_OUT_EVENT, listener)
    await expect(api.profiles.list()).rejects.toMatchObject({ status: 401 })
    expect(getToken()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(SIGNED_OUT_EVENT, listener)
  })

  it('auth.signup and auth.login post credentials and return the token with the user', async () => {
    const body = { token: 't', user: { id: 'u1', name: 'Ada', email: 'ada@example.com', createdAt: 1 } }
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(body, 201)))
    vi.stubGlobal('fetch', fetchMock)
    const res = await api.auth.signup({ name: 'Ada', email: 'ada@example.com', password: 'correct horse battery' })
    expect(res.token).toBe('t')
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/signup')
    await api.auth.login({ email: 'ada@example.com', password: 'correct horse battery' })
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/auth/login')
    expect(fetchMock.mock.calls[1]![1].method).toBe('POST')
  })
})
