import type { ExerciseConfig, RepRecord } from '@arc/dependencies'

/** Arc says at most one cue in this long. */
export const CUE_GAP_MS = 7000

/**
 * What Arc says after a rep, or null: the range fading through the set comes first, then a rep
 * well short of the goal, then a rushed rep, then praise for the first rep that reaches the goal.
 * Reps that are fine get no comment. `reps` is the current set so far, the latest last.
 */
export function cueFor(reps: readonly RepRecord[], cfg: ExerciseConfig, targetDeg: number): string | null {
  const last = reps.at(-1)
  if (!last) return null
  const range = Math.max(1, targetDeg - cfg.restDeg)
  if (reps.length >= 3) {
    const opening = (reps[0]!.peakDeg + reps[1]!.peakDeg) / 2
    if (opening - last.peakDeg >= range * 0.08) return 'Your range is fading. Slow it down and finish each rep.'
  }
  if (last.peakDeg < targetDeg - range * 0.12) return 'Go a little deeper.'
  if (last.durationMs < cfg.minRepMs * 1.4) return 'Slow down, lower it with control.'
  const before = reps.at(-2)
  if (last.peakDeg >= targetDeg && (!before || before.peakDeg < targetDeg)) return "That's the depth. Keep it there."
  return null
}

/** A cue waits for Arc to finish speaking and for the last cue to be a few seconds old. */
export function shouldCue({ now, lastCueAt, arcSpeaking }: { now: number; lastCueAt: number; arcSpeaking: boolean }): boolean {
  return !arcSpeaking && now - lastCueAt >= CUE_GAP_MS
}
