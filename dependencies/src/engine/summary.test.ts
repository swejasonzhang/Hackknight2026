import { describe, expect, it } from 'vitest'
import { estimateFatigue } from './fatigue.ts'
import { summarizeSets } from './summary.ts'
import type { RepRecord, SetRecord } from './types.ts'

function set(setNumber: number, peaks: number[]): SetRecord {
  let t = 0
  const reps: RepRecord[] = peaks.map((peakDeg, i) => {
    const rep = { index: i + 1, peakDeg, startedAt: t, endedAt: t + 2000, durationMs: 2000 }
    t += 2500
    return rep
  })
  return { setNumber, reps, fatigue: estimateFatigue(reps), startedAt: 0, endedAt: t, endedEarly: false }
}

describe('summarizeSets', () => {
  it('aggregates reps across sets', () => {
    const summary = summarizeSets([set(1, [120, 120, 110, 110]), set(2, [100, 100, 100, 100])])
    expect(summary.totalReps).toBe(8)
    expect(summary.bestPeakDeg).toBe(120)
    expect(summary.meanPeakDeg).toBeCloseTo(107.5, 5)
    // set 1: 10 deg drop of 120 -> 0.05 index; set 2: 0 -> mean 0.025
    expect(summary.fatigueIndex).toBeCloseTo(0.025, 5)
  })

  it('ignores the fatigue of sets too short to estimate it', () => {
    const summary = summarizeSets([set(1, [120, 110]), set(2, [120, 120, 100, 100])])
    expect(summary.fatigueIndex).toBeCloseTo(estimateFatigue(set(2, [120, 120, 100, 100]).reps).index, 6)
  })

  it('is all zeros with no sets', () => {
    expect(summarizeSets([])).toEqual({ totalReps: 0, bestPeakDeg: 0, meanPeakDeg: 0, fatigueIndex: 0 })
  })
})
