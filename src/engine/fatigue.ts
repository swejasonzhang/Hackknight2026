import type { FatigueEstimate, RepRecord } from './types'

/** Show a "reach full range" nudge at this index. */
export const FATIGUE_NUDGE = 0.12
/** End the set early and start rest at this index. */
export const FATIGUE_STOP = 0.25
/** Need at least this many reps before the estimate means anything. */
export const FATIGUE_MIN_REPS = 4

const EMPTY: FatigueEstimate = { index: 0, romDecay: 0, tempoDrift: 0, romDropDeg: 0, sampleReps: 0 }

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
}

/**
 * Fatigue PROXY for one set: compares the first k reps with the last k reps (k <= 3).
 *   romDecay   = fraction of peak ROM lost
 *   tempoDrift = fraction by which rep duration grew
 *   index      = 0.6 * romDecay + 0.4 * tempoDrift, clamped to 0..1 (only losses count)
 * This is not a clinical measurement. Say "ROM decay" and "tempo drift" on screen.
 */
export function estimateFatigue(reps: readonly RepRecord[]): FatigueEstimate {
  if (reps.length < FATIGUE_MIN_REPS) return { ...EMPTY, sampleReps: reps.length }
  const k = Math.min(3, Math.floor(reps.length / 2))
  const first = reps.slice(0, k)
  const last = reps.slice(-k)
  const peakFirst = mean(first.map((r) => r.peakDeg))
  const peakLast = mean(last.map((r) => r.peakDeg))
  const durFirst = mean(first.map((r) => r.durationMs))
  const durLast = mean(last.map((r) => r.durationMs))
  const romDropDeg = peakFirst - peakLast
  const romDecay = peakFirst > 0 ? romDropDeg / peakFirst : 0
  const tempoDrift = durFirst > 0 ? (durLast - durFirst) / durFirst : 0
  const index = Math.min(1, Math.max(0, 0.6 * Math.max(0, romDecay) + 0.4 * Math.max(0, tempoDrift)))
  return { index, romDecay, tempoDrift, romDropDeg, sampleReps: reps.length }
}
