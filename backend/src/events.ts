import type { SessionDto } from '@arc/dependencies'
import { EventEmitter } from 'node:events'

/**
 * In-process feed of stored sessions, one topic per profile. The SSE route subscribes browsers to
 * it so a dashboard updates the moment the camera app posts a session. One API instance serves
 * getarc.health; a multi-instance deployment would relay these through Postgres NOTIFY.
 */
const emitter = new EventEmitter()
emitter.setMaxListeners(0)

const topic = (profileId: string) => `session:${profileId}`

export function publishSession(session: SessionDto): void {
  emitter.emit(topic(session.profileId), session)
}

/** Subscribes to sessions stored for one profile; returns the unsubscribe function. */
export function onSessionStored(profileId: string, listener: (session: SessionDto) => void): () => void {
  const name = topic(profileId)
  emitter.on(name, listener)
  return () => {
    emitter.off(name, listener)
  }
}
