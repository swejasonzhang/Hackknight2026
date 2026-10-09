import { FATIGUE_MIN_REPS } from './fatigue.ts'
import type { SessionSummary, SetRecord } from './types.ts'

/** Roll a session's sets up into the numbers the dashboard plots. Computed on the server when a session is stored. */
export function summarizeSets(sets: readonly SetRecord[]): SessionSummary {
  const reps = sets.flatMap((s) => s.reps)
  const peaks = reps.map((r) => r.peakDeg)
  const fatigue = sets.filter((s) => s.fatigue.sampleReps >= FATIGUE_MIN_REPS).map((s) => s.fatigue.index)
  return {
    totalReps: reps.length,
    bestPeakDeg: peaks.length ? Math.max(...peaks) : 0,
    meanPeakDeg: peaks.length ? peaks.reduce((a, b) => a + b, 0) / peaks.length : 0,
    fatigueIndex: fatigue.length ? fatigue.reduce((a, b) => a + b, 0) / fatigue.length : 0,
  }
}
