import type { CoachStatus } from '@arc/dependencies'
import { api } from '../api/client'

let cached: Promise<CoachStatus> | null = null

/**
 * Whether the server has Gemini and ElevenLabs, asked once per page load and shared, so every
 * speaker knows its voice before its first line. A failed check counts as neither.
 */
export function coachStatus(): Promise<CoachStatus> {
  cached ??= api.coach.status().catch(() => ({ gemini: false, voice: false }))
  return cached
}

/** True once the server confirms ElevenLabs: Arc's voice. */
export function elevenLabsVoice(): Promise<boolean> {
  return coachStatus().then((s) => s.voice)
}
