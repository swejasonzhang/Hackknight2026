import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiRequestError } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('api client', () => {
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

  it('builds query strings for progress', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ sessions: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await api.progress('p1', 'elbow_flexion')
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/profiles/p1/progress?exercise=elbow_flexion')
  })

  it('throws ApiRequestError with the server message on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ error: 'Invalid request', issues: [] }, 400))))
    await expect(api.profiles.create({ name: '' })).rejects.toMatchObject({ status: 400, message: 'Invalid request' })
    await expect(api.profiles.create({ name: '' })).rejects.toBeInstanceOf(ApiRequestError)
  })
})
