import { CreateSessionSchema, type SessionPlan } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { READY_MS, SessionRecorder } from './recorder'

const T0 = Date.UTC(2026, 9, 10, 14, 0)
const FRAME = 33
const PLAN: SessionPlan = { sets: 2, reps: 3, restSeconds: 5, targetDeg: 140 }

/** Elbow flexion from 10° to `peak` and back, one rep per `period` ms. */
const curl = (t: number, peak = 120, period = 2000) => 10 + ((peak - 10) * (1 - Math.cos((2 * Math.PI * t) / period))) / 2

function run(rec: SessionRecorder, from: number, ms: number, metric: (t: number) => number, tracked = true) {
  for (let t = from; t < from + ms; t += FRAME) rec.feed({ tracked, metricDeg: metric(t - from), tMs: t })
  return from + ms
}

describe('SessionRecorder', () => {
  it('waits until the joint is in view, then counts the planned sets with the rest between them on its own', () => {
    const rec = new SessionRecorder({ exercise: 'elbow_flexion', side: 'right', plan: PLAN })
    let t = run(rec, T0, 3000, () => 10, false)
    expect(rec.view.phase).toBe('waiting')
    t = run(rec, t, READY_MS + 100, () => 10)
    expect(rec.view.phase).toBe('active')
    expect(rec.view.setNumber).toBe(1)

    t = run(rec, t, 3 * 2000 + 400, (x) => curl(x))
    expect(rec.view.phase).toBe('rest')
    expect(rec.view.totalReps).toBe(3)
    expect(rec.view.restLeftMs).toBeGreaterThan(4000)

    // Moving during the rest does not count; the next set starts when the timer runs out.
    t = run(rec, t, 5200, (x) => curl(x))
    expect(rec.view.phase).toBe('active')
    expect(rec.view.setNumber).toBe(2)
    expect(rec.view.totalReps).toBe(3)

    t = run(rec, t, 3 * 2000 + 400, (x) => curl(x))
    expect(rec.view.phase).toBe('done')
    expect(rec.view.totalReps).toBe(6)
    expect(rec.view.bestDeg).toBeGreaterThan(100)

    const input = rec.toSessionInput('profile-1')!
    expect(CreateSessionSchema.safeParse(input).success).toBe(true)
    expect(input.sets.map((s) => s.reps.length)).toEqual([3, 3])
    expect(input.sets.every((s) => !s.endedEarly)).toBe(true)
    expect(input.plan).toEqual(PLAN)
    expect(input.startedAt).toBeGreaterThanOrEqual(T0)
    expect(input.endedAt).toBeLessThanOrEqual(t)
  })

  it('keeps an early finish, marking the unfinished set as ended early', () => {
    const rec = new SessionRecorder({ exercise: 'elbow_flexion', side: 'left', plan: PLAN })
    let t = run(rec, T0, READY_MS + 100, () => 10)
    t = run(rec, t, 2 * 2000 + 400, (x) => curl(x))
    rec.finish(t)
    expect(rec.view.phase).toBe('done')
    const input = rec.toSessionInput('profile-1')!
    expect(input.side).toBe('left')
    expect(input.sets).toHaveLength(1)
    expect(input.sets[0]!.reps).toHaveLength(2)
    expect(input.sets[0]!.endedEarly).toBe(true)
  })

  it('counts nothing while the joint is out of view, and has nothing to save without a rep', () => {
    const rec = new SessionRecorder({ exercise: 'elbow_flexion', side: 'right', plan: PLAN })
    let t = run(rec, T0, READY_MS + 100, () => 10)
    t = run(rec, t, 3 * 2000, (x) => curl(x), false)
    expect(rec.view.totalReps).toBe(0)
    rec.finish(t)
    expect(rec.toSessionInput('profile-1')).toBeNull()
  })

  it('saves whole-millisecond times even though the browser clock has fractions', () => {
    // performance.timeOrigin + performance.now() is fractional; the API takes whole milliseconds.
    const rec = new SessionRecorder({ exercise: 'elbow_flexion', side: 'right', plan: { ...PLAN, sets: 1, reps: 2 } })
    let t = run(rec, T0 + 0.371, READY_MS + 100, () => 10)
    t = run(rec, t, 2 * 2000 + 400, (x) => curl(x))
    const input = rec.toSessionInput('profile-1')!
    expect(CreateSessionSchema.safeParse(input).success).toBe(true)
    expect(Number.isInteger(input.startedAt)).toBe(true)
    expect(input.sets[0]!.reps.every((r) => Number.isInteger(r.startedAt) && Number.isInteger(r.endedAt))).toBe(true)
  })

  it('counts knee extensions from the hanging shin up to a straight leg', () => {
    const rec = new SessionRecorder({ exercise: 'seated_knee_extension', side: 'right', plan: { ...PLAN, sets: 1, reps: 2 } })
    let t = run(rec, T0, READY_MS + 100, () => 92)
    t = run(rec, t, 2 * 2500 + 400, (x) => 92 + (170 - 92) * (1 - Math.cos((2 * Math.PI * x) / 2500)) / 2)
    expect(rec.view.phase).toBe('done')
    expect(rec.toSessionInput('p')!.sets[0]!.reps).toHaveLength(2)
  })
})
