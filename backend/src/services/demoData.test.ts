import { EXERCISE_IDS, summarizeSets } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { generateDemoSessions } from './demoData.ts'

const NOW = Date.UTC(2026, 9, 10, 21) // Saturday 10 Oct 2026, 21:00 UTC
const WEEK = 7 * 24 * 3600 * 1000

describe('generateDemoSessions', () => {
  it('is repeatable for a seed and different across seeds', () => {
    const a = generateDemoSessions('p1', NOW, 7)
    const b = generateDemoSessions('p1', NOW, 7)
    const c = generateDemoSessions('p1', NOW, 8)
    expect(b).toEqual(a)
    expect(c.map((s) => s.summary.bestPeakDeg)).not.toEqual(a.map((s) => s.summary.bestPeakDeg))
  })

  it('covers six weeks for every exercise with two or three sessions in each full week, none in the future', () => {
    for (const seed of [1, 2, 3, 42, 1234]) {
      const sessions = generateDemoSessions('p1', NOW, seed)
      expect(sessions.length).toBeGreaterThanOrEqual(30)
      expect(sessions.every((s) => s.startedAt <= NOW && s.startedAt > NOW - 6 * WEEK)).toBe(true)
      for (const exercise of EXERCISE_IDS) {
        const mine = sessions.filter((s) => s.exercise === exercise)
        const perWeek = new Map<number, number>()
        for (const s of mine) {
          const week = Math.floor((NOW - s.startedAt) / WEEK)
          perWeek.set(week, (perWeek.get(week) ?? 0) + 1)
        }
        for (const week of [1, 2, 3, 4]) expect([2, 3]).toContain(perWeek.get(week))
      }
    }
  })

  it('trends upward per exercise and keeps every number consistent', () => {
    for (const seed of [5, 99, 2026]) {
      const sessions = generateDemoSessions('p1', NOW, seed)
      for (const exercise of EXERCISE_IDS) {
        const mine = sessions.filter((s) => s.exercise === exercise).sort((x, y) => x.startedAt - y.startedAt)
        const first = mine.slice(0, 4).reduce((sum, s) => sum + s.summary.bestPeakDeg, 0) / 4
        const last = mine.slice(-4).reduce((sum, s) => sum + s.summary.bestPeakDeg, 0) / 4
        expect(last).toBeGreaterThan(first + 8)
      }
      for (const s of sessions) {
        expect(s.demo).toBe(true)
        expect(s.sets.length).toBeGreaterThanOrEqual(2)
        expect(s.sets.every((set) => set.reps.length >= 4)).toBe(true)
        expect(s.summary).toEqual(summarizeSets(s.sets))
        expect(s.endedAt).toBeGreaterThan(s.startedAt)
      }
    }
  })

  it('varies the time of day', () => {
    const hours = new Set(generateDemoSessions('p1', NOW, 11).map((s) => new Date(s.startedAt).getUTCHours()))
    expect(hours.size).toBeGreaterThan(3)
  })
})
