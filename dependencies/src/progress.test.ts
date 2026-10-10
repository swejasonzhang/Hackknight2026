import type { SessionRecord } from './engine/types.ts'
import { describe, expect, it } from 'vitest'
import { buildProgress, weekStartIso } from './progress.ts'

function session(id: string, startedAt: number, peaks: number[][], demo = false): SessionRecord {
  let t = startedAt
  const sets = peaks.map((setPeaks, si) => {
    const reps = setPeaks.map((peakDeg, ri) => {
      const rep = { index: ri + 1, peakDeg, startedAt: t, endedAt: t + 2000, durationMs: 2000 }
      t += 2500
      return rep
    })
    return {
      setNumber: si + 1,
      reps,
      fatigue: { index: 0.1 * (si + 1), romDecay: 0, tempoDrift: 0, romDropDeg: 0, sampleReps: reps.length },
      startedAt: reps[0]!.startedAt,
      endedAt: reps.at(-1)!.endedAt,
      endedEarly: false,
    }
  })
  const all = sets.flatMap((s) => s.reps)
  return {
    id,
    profileId: 'p1',
    exercise: 'elbow_flexion',
    side: 'right',
    startedAt,
    endedAt: t,
    plan: { sets: sets.length, reps: 4, restSeconds: 30, targetDeg: 140 },
    sets,
    summary: {
      totalReps: all.length,
      bestPeakDeg: Math.max(...all.map((r) => r.peakDeg)),
      meanPeakDeg: all.reduce((a, r) => a + r.peakDeg, 0) / all.length,
      fatigueIndex: 0.15,
    },
    demo,
  }
}

describe('weekStartIso', () => {
  it('returns the ISO date of the Monday of that week (UTC)', () => {
    expect(weekStartIso(Date.UTC(2026, 8, 9, 15))).toBe('2026-09-07') // Wednesday
    expect(weekStartIso(Date.UTC(2026, 8, 13, 23))).toBe('2026-09-07') // Sunday
    expect(weekStartIso(Date.UTC(2026, 8, 14, 0))).toBe('2026-09-14') // Monday
  })
})

describe('buildProgress', () => {
  it('returns empty series for no sessions', () => {
    const p = buildProgress('p1', 'elbow_flexion', [], null)
    expect(p).toEqual({ profileId: 'p1', exercise: 'elbow_flexion', targetDeg: null, sessions: [], sessionsPerWeek: [], latestSessionReps: [] })
  })

  it('orders sessions oldest first, counts per week and lists the latest session reps', () => {
    const day = 24 * 3600 * 1000
    const mon = Date.UTC(2026, 8, 7, 18)
    const newest = session('c', mon + 8 * day, [[130, 128], [126, 120]], true)
    const p = buildProgress('p1', 'elbow_flexion', [newest, session('a', mon, [[120, 118]]), session('b', mon + 2 * day, [[122, 121]])], 140)
    expect(p.targetDeg).toBe(140)
    expect(p.sessions.map((s) => s.sessionId)).toEqual(['a', 'b', 'c'])
    expect(p.sessions[2]).toMatchObject({ bestPeakDeg: 130, totalReps: 4, fatigueIndex: 0.15, demo: true })
    expect(p.sessionsPerWeek).toEqual([
      { weekStart: '2026-09-07', count: 2 },
      { weekStart: '2026-09-14', count: 1 },
    ])
    expect(p.latestSessionReps.map((r) => r.label)).toEqual(['S1 R1', 'S1 R2', 'S2 R1', 'S2 R2'])
    expect(p.latestSessionReps[2]).toEqual({ label: 'S2 R1', setNumber: 2, index: 1, peakDeg: 126 })
  })
})
