import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app, createProfile, makeSession, service, signup } from './helpers.ts'

let base = ''
let server: ReturnType<typeof app.listen>

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

/** Reads the stream until `predicate` matches the text received so far, then returns that text. */
async function readUntil(body: ReadableStream<Uint8Array>, predicate: (text: string) => boolean, timeoutMs = 5_000): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  const deadline = Date.now() + timeoutMs
  while (!predicate(text)) {
    if (Date.now() > deadline) throw new Error(`stream timeout; received so far:\n${text}`)
    const { value, done } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
  }
  reader.releaseLock()
  return text
}

describe('GET /api/profiles/:id/stream', () => {
  it('says ready, then pushes each session the camera app stores for that profile', async () => {
    const c = await signup()
    const profileId = await createProfile(c)
    const abort = new AbortController()
    const res = await fetch(`${base}/api/profiles/${profileId}/stream`, { headers: { Authorization: `Bearer ${c.token}` }, signal: abort.signal })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const ready = await readUntil(res.body!, (t) => t.includes('event: ready'))
    expect(ready).toContain(`"profileId":"${profileId}"`)

    const stored = await service().post('/api/sessions').send(makeSession(profileId))
    expect(stored.status).toBe(201)

    const pushed = await readUntil(res.body!, (t) => t.includes('event: session'))
    const data = pushed.split('event: session\ndata: ')[1]!.split('\n')[0]!
    const session = JSON.parse(data)
    expect(session.id).toBe(stored.body.id)
    expect(session.summary.totalReps).toBe(8)
    abort.abort()
  })

  it('is scoped to the caller: another account gets 404 for a profile it does not own', async () => {
    const owner = await signup()
    const other = await signup()
    const profileId = await createProfile(owner)
    const res = await fetch(`${base}/api/profiles/${profileId}/stream`, { headers: { Authorization: `Bearer ${other.token}` } })
    expect(res.status).toBe(404)
    await res.text()
  })
})
