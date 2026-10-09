import { EXERCISES, RepCounter, type RepRecord } from '@ptg/dependencies'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SimulatedMotionSource } from './SimulatedMotionSource'
import type { MotionSample } from './types'

describe('SimulatedMotionSource', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('emits samples at the configured rate and stops cleanly', () => {
    const source = new SimulatedMotionSource({ periodMs: 2000, restDeg: 10, peakDeg: 130, sampleMs: 50 })
    const samples: MotionSample[] = []
    source.start((s) => samples.push(s))
    vi.advanceTimersByTime(1000)
    expect(samples).toHaveLength(20)
    expect(samples.every((s) => s.tracked)).toBe(true)
    expect(samples[0]!.metricDeg).toBeCloseTo(10, 0)
    source.stop()
    vi.advanceTimersByTime(1000)
    expect(samples).toHaveLength(20)
  })

  it('drives the shared rep counter at one rep per period, with peaks that decay per rep', () => {
    const ex = EXERCISES.elbow_flexion
    const counter = new RepCounter(ex)
    const reps: RepRecord[] = []
    const source = new SimulatedMotionSource({ periodMs: 2000, restDeg: 10, peakDeg: 130, peakDecayPerRep: 5, sampleMs: 50 })
    source.start((s) => {
      const rep = counter.update(s.metricDeg, s.tMs)
      if (rep) reps.push(rep)
    })
    vi.advanceTimersByTime(10_500)
    source.stop()
    expect(reps.length).toBe(5)
    expect(reps[0]!.peakDeg).toBeCloseTo(130, 0)
    expect(reps[4]!.peakDeg).toBeCloseTo(110, 0)
    expect(reps[0]!.durationMs).toBeGreaterThan(1000)
  })

  it('slows down when slowdownPerRep is set', () => {
    const source = new SimulatedMotionSource({ periodMs: 1000, restDeg: 0, peakDeg: 100, slowdownPerRep: 500, sampleMs: 50 })
    const peaksAt: number[] = []
    let last = -Infinity
    let rising = false
    source.start((s) => {
      if (s.metricDeg > last) rising = true
      else if (rising && s.metricDeg < last) {
        peaksAt.push(s.tMs - 50)
        rising = false
      }
      last = s.metricDeg
    })
    vi.advanceTimersByTime(4000)
    source.stop()
    // periods: 1000, 1500, 2000 -> peaks at ~500, ~1750, ~3500
    expect(peaksAt[0]).toBeCloseTo(500, -2)
    expect(peaksAt[1]).toBeCloseTo(1750, -2)
  })
})
