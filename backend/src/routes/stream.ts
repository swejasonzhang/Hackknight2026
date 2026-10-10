import { Router } from 'express'
import { principalOf } from '../auth.ts'
import { onSessionStored } from '../events.ts'
import { requireProfile } from '../store/profiles.ts'

const HEARTBEAT_MS = 25_000

/**
 * Mounted at /api/profiles (behind `authenticate`). GET /:id/stream is a Server-Sent Events feed:
 * a `ready` event on connect, then a `session` event each time a session is stored for the
 * profile, with the full session as JSON. A comment line every 25 s keeps proxies from timing out.
 */
export const streamRouter = Router()

streamRouter.get('/:id/stream', async (req, res) => {
  const profile = await requireProfile(req.params.id, principalOf(req))
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(`event: ready\ndata: ${JSON.stringify({ profileId: profile.id })}\n\n`)
  const unsubscribe = onSessionStored(profile.id, (session) => {
    res.write(`event: session\ndata: ${JSON.stringify(session)}\n\n`)
  })
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)
  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
})
