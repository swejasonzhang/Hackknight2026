import { describe, expect, it } from 'vitest'
import { leaderboard } from './leaderboard.ts'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 10, 12)
const session = (profileId: string, { daysAgo = 1, reps = 30, sets = 3, loadKg, fatigue = 0.1, demo = false }: { daysAgo?: number; reps?: number; sets?: number; loadKg?: number; fatigue?: number; demo?: boolean } = {}) => ({
  profileId,
  startedAt: NOW - daysAgo * DAY,
  sets: Array.from({ length: sets }, () => ({ reps: Array.from({ length: Math.round(reps / sets) }) })) as never,
  summary: { totalReps: reps, bestPeakDeg: 120, meanPeakDeg: 110, fatigueIndex: fatigue },
  demo,
  ...(loadKg != null ? { loadKg } : {}),
})
const PROFILES = [
  { id: 'ada', name: 'Ada' },
  { id: 'grace', name: 'Grace' },
  { id: 'alan', name: 'Alan' },
]

describe('the household leaderboard', () => {
  it('ranks each profile on reps, sets, weight moved and steadiness, and on an Arc score of all four', () => {
    const board = leaderboard(PROFILES, [session('ada', { reps: 40, sets: 4, loadKg: 10, fatigue: 0.2 }), session('grace', { reps: 30, sets: 3, loadKg: 20, fatigue: 0.05 }), session('grace', { reps: 10, sets: 1 })], { now: NOW })
    const [first, second, third] = board.rows
    expect(board.factors).toEqual(['reps', 'sets', 'volume', 'steadiness'])
    expect(first).toMatchObject({ name: 'Grace', reps: 40, sets: 4, volumeKg: 600, topLoadKg: 20, sessions: 2 })
    // Grace's fatigue is the mean over her sessions: 0.05 and 0.1.
    expect(first!.fatigue).toBeCloseTo(0.075, 3)
    expect(second).toMatchObject({ name: 'Ada', reps: 40, volumeKg: 400, steadiness: 0.8 })
    // Equal reps and sets share first place.
    expect(first!.ranks).toMatchObject({ score: 1, reps: 1, sets: 1, volume: 1, steadiness: 1 })
    expect(second!.ranks).toMatchObject({ score: 2, reps: 1, sets: 1, volume: 2, steadiness: 2 })
    // Leading on everything scores 100; Ada: (1 + 1 + 400/600 + 0.8/0.925) / 4.
    expect(first!.score).toBe(100)
    expect(second!.score).toBe(Math.round(((1 + 1 + 400 / 600 + 0.8 / 0.925) / 4) * 100))
    // No training in the window: no score, last place, nothing invented.
    expect(third).toMatchObject({ name: 'Alan', sessions: 0, score: 0, fatigue: null, steadiness: null, topLoadKg: null })
    expect(third!.ranks.score).toBe(3)
  })

  it('counts only the window: this week, the last 30 days, or all time', () => {
    const sessions = [session('ada', { daysAgo: 2, reps: 10 }), session('ada', { daysAgo: 20, reps: 20 }), session('ada', { daysAgo: 90, reps: 40 })]
    expect(leaderboard(PROFILES, sessions, { now: NOW, window: 'week' }).rows[0]!.reps).toBe(10)
    expect(leaderboard(PROFILES, sessions, { now: NOW, window: 'month' }).rows[0]!.reps).toBe(30)
    const all = leaderboard(PROFILES, sessions, { now: NOW, window: 'all' })
    expect(all.rows[0]!.reps).toBe(70)
    expect(all.since).toBe(0)
  })

  it('leaves weight moved out of the score until someone gives a weight', () => {
    const board = leaderboard(PROFILES.slice(0, 2), [session('ada', { reps: 30 }), session('grace', { reps: 15 })], { now: NOW })
    expect(board.factors).toEqual(['reps', 'sets', 'steadiness'])
    expect(board.rows.map((r) => [r.name, r.volumeKg])).toEqual([
      ['Ada', 0],
      ['Grace', 0],
    ])
  })

  it('marks a profile whose training is all demo data', () => {
    const board = leaderboard(PROFILES.slice(0, 2), [session('ada', { demo: true }), session('grace')], { now: NOW })
    expect(board.rows.find((r) => r.name === 'Ada')!.demo).toBe(true)
    expect(board.rows.find((r) => r.name === 'Grace')!.demo).toBe(false)
  })

  it('measures fatigue only where a set was long enough to show it', () => {
    const board = leaderboard(PROFILES.slice(0, 1), [session('ada', { reps: 6, sets: 2, fatigue: 0 })], { now: NOW })
    expect(board.rows[0]).toMatchObject({ fatigue: null, steadiness: null })
  })
})
