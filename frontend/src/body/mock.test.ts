import { MUSCLE_IDS } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { MOCK_WEEKS, mockGrowthAt, randomEndBuild } from './mock'

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32
    return s / 2 ** 32
  }
}

describe('the mock transformation', () => {
  it('draws a named end build with every group well along, and different builds from different draws', () => {
    const a = randomEndBuild(seeded(1))
    expect(a.name).toBeTruthy()
    for (const m of MUSCLE_IDS) {
      expect(a.growth.levels[m], m).toBeGreaterThanOrEqual(0.15)
      expect(a.growth.levels[m], m).toBeLessThanOrEqual(1)
    }
    expect(a.growth.overall).toBeGreaterThan(0.2)
    const names = new Set(Array.from({ length: 40 }, (_, i) => randomEndBuild(seeded(i * 1_000_003 + 11)).name))
    expect(names.size).toBeGreaterThan(3)
    expect(randomEndBuild(seeded(7))).toEqual(randomEndBuild(seeded(7)))
  })

  it('starts skinny, grows quickly at first and slows, and arrives at the end build', () => {
    const end = randomEndBuild(seeded(3)).growth
    expect(mockGrowthAt(end, 0).overall).toBe(0)
    const quarter = mockGrowthAt(end, MOCK_WEEKS / 4).overall
    const half = mockGrowthAt(end, MOCK_WEEKS / 2).overall
    // More of the change in the first quarter than in the quarter after it.
    expect(quarter).toBeGreaterThan(half - quarter)
    expect(mockGrowthAt(end, MOCK_WEEKS).overall).toBeCloseTo(end.overall, 9)
    for (const m of MUSCLE_IDS) expect(mockGrowthAt(end, MOCK_WEEKS).levels[m]).toBeCloseTo(end.levels[m]!, 9)
  })
})
