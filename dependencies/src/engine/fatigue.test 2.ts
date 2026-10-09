import { describe, expect, it } from 'vitest'
import { estimateFatigue, FATIGUE_MIN_REPS } from './fatigue.ts'
import type { RepRecord } from './types.ts'

function reps(peaks: number[], durations?: number[]): RepRecord[] {
  let t = 0
  return peaks.map((peakDeg, i) => {
    const durationMs = durations?.[i] ?? 2000
    const rep = { index: i + 1, peakDeg, startedAt: t, endedAt: t + durationMs, durationMs }
    t += durationMs + 500
    return rep
  })
}

describe('estimateFatigue', () => {
  it('returns a zero index with too few reps', () => {
    const f = estimateFatigue(reps([120, 118, 115]))
    expect(f.index).toBe(0)
    expect(f.sampleReps).toBe(3)
    expect(FATIGUE_MIN_REPS).toBe(4)
  })

  it('is zero for a flat set', () => {
    const f = estimateFatigue(reps([120, 120, 120, 120, 120, 120]))
    expect(f.index).toBe(0)
    expect(f.romDropDeg).toBe(0)
    expect(f.tempoDrift).toBe(0)
  })

  it('reports ROM decay when peaks shrink across the set', () => {
    // first three mean 120, last three mean 100 -> 20 deg drop, 16.7 % decay
    const f = estimateFatigue(reps([122, 120, 118, 104, 100, 96]))
    expect(f.romDropDeg).toBeCloseTo(20, 5)
    expect(f.romDecay).toBeCloseTo(20 / 120, 5)
    expect(f.tempoDrift).toBe(0)
    expect(f.index).toBeCloseTo(0.6 * (20 / 120), 5)
    expect(f.sampleReps).toBe(6)
  })

  it('reports tempo drift when reps slow down', () => {
    const f = estimateFatigue(reps([120, 120, 120, 120], [2000, 2000, 3000, 3000]))
    expect(f.romDecay).toBe(0)
    expect(f.tempoDrift).toBeCloseTo(0.5, 5)
    expect(f.index).toBeCloseTo(0.2, 5)
  })

  it('ignores improvements: a set that gets stronger has index 0', () => {
    const f = estimateFatigue(reps([100, 105, 110, 120, 125, 130], [3000, 3000, 3000, 2000, 2000, 2000]))
    expect(f.romDecay).toBeLessThan(0)
    expect(f.tempoDrift).toBeLessThan(0)
    expect(f.index).toBe(0)
  })

  it('never exceeds 1', () => {
    const f = estimateFatigue(reps([150, 150, 150, 10, 10, 10], [1000, 1000, 1000, 9000, 9000, 9000]))
    expect(f.index).toBe(1)
  })

  it('uses k = 2 for a 4- or 5-rep set', () => {
    const f = estimateFatigue(reps([120, 120, 100, 100]))
    expect(f.romDropDeg).toBeCloseTo(20, 5)
  })
})
