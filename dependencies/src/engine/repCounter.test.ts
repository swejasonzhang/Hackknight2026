import { describe, expect, it } from 'vitest'
import { RepCounter } from './repCounter.ts'

const cfg = { enterDeg: 90, exitDeg: 40, minRepMs: 500 }

/** Feed a triangle wave: rest -> peak -> rest, `stepMs` apart. */
function wave(counter: RepCounter, peak: number, t0: number, stepMs = 100): { reps: number; t: number } {
  let t = t0
  let reps = 0
  const up = [10, 30, 50, 70, 90, peak]
  const down = [peak, 90, 70, 50, 40, 20, 10]
  for (const deg of [...up, ...down]) {
    if (counter.update(deg, t)) reps++
    t += stepMs
  }
  return { reps, t }
}

describe('RepCounter', () => {
  it('counts one rep per full excursion past enterDeg and back to exitDeg', () => {
    const counter = new RepCounter(cfg)
    let t = 0
    let total = 0
    for (let i = 0; i < 3; i++) {
      const r = wave(counter, 130, t)
      total += r.reps
      t = r.t
    }
    expect(total).toBe(3)
    expect(counter.snapshot.count).toBe(3)
  })

  it('records the peak and the duration of each rep', () => {
    const counter = new RepCounter(cfg)
    let rep = null
    let t = 1000
    for (const deg of [10, 60, 95, 120, 135, 120, 95, 60, 35]) {
      rep = counter.update(deg, t) ?? rep
      t += 200
    }
    expect(rep).not.toBeNull()
    expect(rep!.peakDeg).toBe(135)
    expect(rep!.index).toBe(1)
    // left the rest zone at t=1200 (60 deg), back at t=2600 (35 deg)
    expect(rep!.startedAt).toBe(1200)
    expect(rep!.endedAt).toBe(2600)
    expect(rep!.durationMs).toBe(1400)
  })

  it('does not double count when the signal wobbles around a threshold', () => {
    const counter = new RepCounter(cfg)
    let t = 0
    let reps = 0
    for (const deg of [10, 50, 88, 92, 89, 93, 91, 120, 95, 60, 42, 39, 41, 38]) {
      if (counter.update(deg, t)) reps++
      t += 100
    }
    expect(reps).toBe(1)
  })

  it('ignores excursions shorter than minRepMs as jitter', () => {
    const counter = new RepCounter(cfg)
    const { reps } = wave(counter, 130, 0, 20) // whole wave in 260 ms
    expect(reps).toBe(0)
    expect(counter.snapshot.count).toBe(0)
  })

  it('counts a half-way movement that never reaches enterDeg as a partial', () => {
    const counter = new RepCounter(cfg)
    let t = 0
    for (const deg of [10, 50, 70, 75, 60, 45, 30]) {
      counter.update(deg, t)
      t += 150
    }
    expect(counter.snapshot.count).toBe(0)
    expect(counter.snapshot.partials).toBe(1)
  })

  it('exposes the movement phase for UI cues', () => {
    const counter = new RepCounter(cfg)
    expect(counter.snapshot.phase).toBe('rest')
    counter.update(60, 0)
    expect(counter.snapshot.phase).toBe('rising')
    counter.update(120, 100)
    expect(counter.snapshot.phase).toBe('peak')
    counter.update(100, 200)
    expect(counter.snapshot.phase).toBe('returning')
    counter.update(30, 900)
    expect(counter.snapshot.phase).toBe('rest')
  })

  it('reset clears counts and phase', () => {
    const counter = new RepCounter(cfg)
    wave(counter, 130, 0)
    counter.update(80, 5000)
    counter.reset()
    expect(counter.snapshot).toMatchObject({ phase: 'rest', count: 0, partials: 0, peakDeg: null })
  })

  it('rejects a config whose enter threshold is not above exit', () => {
    expect(() => new RepCounter({ enterDeg: 40, exitDeg: 40, minRepMs: 100 })).toThrow()
  })
})
