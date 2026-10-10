import { CreateSessionSchema, EXERCISE_IDS, EXERCISES, type SessionPlan } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { readJoint } from './angle'
import { READY_MS, SessionRecorder } from './recorder'
import { simulatedPeak } from './LiveRecorder'
import { createSimulatedTracker } from './simulated'

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

describe('SessionRecorder voice commands', () => {
  const plan: SessionPlan = { sets: 2, reps: 3, restSeconds: 10, targetDeg: 140 }

  it('"start" begins the first set at once, without waiting for the joint to settle', () => {
    const rec = new SessionRecorder({ exercise: 'elbow_flexion', side: 'right', plan })
    rec.command('start', T0)
    expect(rec.view.phase).toBe('active')
  })

  it('"pause" stops counting until "resume"', () => {
    const rec = new SessionRecorder({ exercise: 'elbow_flexion', side: 'right', plan })
    let t = run(rec, T0, READY_MS + 100, () => 10)
    rec.command('pause', t)
    expect(rec.view.paused).toBe(true)
    t = run(rec, t, 2 * 2000 + 400, (x) => curl(x))
    expect(rec.view.totalReps).toBe(0)
    rec.command('resume', t)
    t = run(rec, t, 2 * 2000 + 400, (x) => curl(x))
    expect(rec.view.paused).toBe(false)
    expect(rec.view.totalReps).toBe(2)
  })

  it('"pause" during the rest freezes the countdown', () => {
    const rec = new SessionRecorder({ exercise: 'elbow_flexion', side: 'right', plan })
    let t = run(rec, T0, READY_MS + 100, () => 10)
    t = run(rec, t, 3 * 2000 + 400, (x) => curl(x))
    expect(rec.view.phase).toBe('rest')
    const left = rec.view.restLeftMs
    rec.command('pause', t)
    t = run(rec, t, 30_000, () => 10)
    expect(rec.view.phase).toBe('rest')
    rec.command('resume', t)
    expect(rec.view.restLeftMs).toBeCloseTo(left, -2)
  })

  it('"skip" ends a set early into the rest, and skips the rest into the next set', () => {
    const rec = new SessionRecorder({ exercise: 'elbow_flexion', side: 'right', plan })
    let t = run(rec, T0, READY_MS + 100, () => 10)
    t = run(rec, t, 1 * 2000 + 400, (x) => curl(x))
    rec.command('skip', t)
    expect(rec.view.phase).toBe('rest')
    rec.command('skip', t + 100)
    expect(rec.view.phase).toBe('active')
    expect(rec.view.setNumber).toBe(2)
    t = run(rec, t + 200, 3 * 2000 + 400, (x) => curl(x))
    const input = rec.toSessionInput('p')!
    expect(input.sets.map((s) => [s.reps.length, s.endedEarly])).toEqual([[1, true], [3, false]])
  })

  it('"rest" starts the rest now; "stop" finishes and saves', () => {
    const rec = new SessionRecorder({ exercise: 'elbow_flexion', side: 'right', plan })
    let t = run(rec, T0, READY_MS + 100, () => 10)
    t = run(rec, t, 2 * 2000 + 400, (x) => curl(x))
    rec.command('rest', t)
    expect(rec.view.phase).toBe('rest')
    rec.command('stop', t + 500)
    expect(rec.view.phase).toBe('done')
  })

  it('keeps every command with its time, saved with the session', () => {
    const rec = new SessionRecorder({ exercise: 'elbow_flexion', side: 'right', plan })
    let t = run(rec, T0, READY_MS + 100, () => 10)
    rec.command('status', t)
    t = run(rec, t, 2 * 2000 + 400, (x) => curl(x))
    rec.command('stop', t)
    const input = rec.toSessionInput('p')!
    expect(input.events!.map((e) => e.command)).toEqual(['status', 'stop'])
    expect(CreateSessionSchema.safeParse(input).success).toBe(true)
  })
})

describe('every movement, end to end', () => {
  it('counts the reps of a person working from rest to the goal, read through the camera path', () => {
    for (const exercise of EXERCISE_IDS) {
      for (const side of ['right', 'left'] as const) {
        const { targetDeg, minRepMs } = EXERCISES[exercise]
        const period = Math.max(2600, minRepMs * 2)
        const tracker = createSimulatedTracker(exercise, side, simulatedPeak({ exercise, plan: { sets: 1, reps: 3, restSeconds: 10, targetDeg } }), period)
        const rec = new SessionRecorder({ exercise, side, plan: { sets: 1, reps: 3, restSeconds: 10, targetDeg } })
        const start = performance.now()
        for (let t = 0; t < READY_MS + 900 + 3 * period + 600; t += FRAME) {
          const reading = readJoint(tracker.detect(null as never, start + t), exercise, side, 16 / 9)
          rec.feed({ tracked: reading.tracked, metricDeg: reading.metricDeg, tMs: T0 + t })
        }
        expect(rec.view.totalReps, `${exercise} ${side}`).toBe(3)
        expect(rec.view.bestDeg, `${exercise} ${side} best`).toBeGreaterThan(EXERCISES[exercise].enterDeg)
      }
    }
  }, 30_000)
})
