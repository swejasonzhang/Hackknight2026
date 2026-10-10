import type { ExerciseId, SessionDto, Side } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { dayKey, defaultDay, firstDay, groupByDay, parseDayKey, progressFor, shiftDay, weekOf } from './days'

/** Local wall-clock time, so the tests hold in any timezone (CI runs on UTC, laptops do not). */
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime()

let n = 0
function session(startedAt: number, best: number, opts: { exercise?: ExerciseId; side?: Side; target?: number } = {}): SessionDto {
  n += 1
  return {
    id: `s${n}`,
    profileId: 'p1',
    exercise: opts.exercise ?? 'elbow_flexion',
    side: opts.side ?? 'right',
    startedAt,
    endedAt: startedAt + 240_000,
    plan: { sets: 3, reps: 8, restSeconds: 45, targetDeg: opts.target ?? 140 },
    sets: [],
    summary: { totalReps: 24, bestPeakDeg: best, meanPeakDeg: best - 4, fatigueIndex: 0.06 },
    demo: false,
  } as unknown as SessionDto
}

describe('day keys', () => {
  it('reads the local calendar day, not the UTC one', () => {
    expect(dayKey(at(2026, 10, 9, 23, 30))).toBe('2026-10-09')
    expect(dayKey(at(2026, 10, 10, 0, 15))).toBe('2026-10-10')
  })

  it('steps across month, year and daylight-saving boundaries', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDay('2026-10-31', 2)).toBe('2026-11-02')
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDay('2026-03-07', 2)).toBe('2026-03-09')
  })

  it('lists the Monday-to-Sunday week around a day', () => {
    const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
    expect(weekOf('2026-10-09')).toEqual(week)
    expect(weekOf('2026-10-05')).toEqual(week)
    expect(weekOf('2026-10-11')).toEqual(week)
  })

  it('accepts only real calendar days from a URL', () => {
    expect(parseDayKey('2026-10-09')).toBe('2026-10-09')
    expect(parseDayKey('2026-02-30')).toBeNull()
    expect(parseDayKey('yesterday')).toBeNull()
    expect(parseDayKey(null)).toBeNull()
  })
})

describe('grouping sessions into days', () => {
  it('groups by local day with each day in time order', () => {
    const late = session(at(2026, 10, 9, 18), 130)
    const early = session(at(2026, 10, 9, 7), 128)
    const other = session(at(2026, 10, 7, 12), 125)
    const days = groupByDay([late, other, early])
    expect([...days.keys()].sort()).toEqual(['2026-10-07', '2026-10-09'])
    expect(days.get('2026-10-09')!.map((s) => s.id)).toEqual([early.id, late.id])
  })

  it('opens on the latest day with a workout, or today when there are none', () => {
    const sessions = [session(at(2026, 10, 7), 125), session(at(2026, 10, 2), 120)]
    expect(defaultDay(sessions, at(2026, 10, 10))).toBe('2026-10-07')
    expect(defaultDay([], at(2026, 10, 10))).toBe('2026-10-10')
    expect(firstDay(sessions)).toBe('2026-10-02')
    expect(firstDay([])).toBeNull()
  })
})

describe('progress for a session', () => {
  it('compares with the previous and the first session of the same movement and side, and the goal', () => {
    const first = session(at(2026, 9, 1), 100)
    const otherSide = session(at(2026, 10, 5), 90, { side: 'left' })
    const otherMovement = session(at(2026, 10, 6), 150, { exercise: 'shoulder_abduction', target: 160 })
    const previous = session(at(2026, 10, 6, 8), 127)
    const today = session(at(2026, 10, 9), 132.4)
    const p = progressFor([today, otherMovement, previous, otherSide, first], today)
    expect(p.previous?.id).toBe(previous.id)
    expect(p.deltaPrevious).toBeCloseTo(5.4)
    expect(p.first?.id).toBe(first.id)
    expect(p.deltaFirst).toBeCloseTo(32.4)
    expect(p.goal).toBe(140)
    expect(p.toGoal).toBeCloseTo(7.6)
  })

  it('has no comparison for the first session and never a negative distance to the goal', () => {
    const only = session(at(2026, 10, 9), 145)
    const p = progressFor([only], only)
    expect(p.previous).toBeNull()
    expect(p.deltaPrevious).toBeNull()
    expect(p.first).toBeNull()
    expect(p.deltaFirst).toBeNull()
    expect(p.toGoal).toBe(0)
  })
})
