import { describe, expect, it } from 'vitest'
import { OneEuroFilter } from './oneEuro.ts'

function variance(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length
}

/** Deterministic pseudo-noise so the test never flakes. */
function noise(i: number): number {
  return Math.sin(i * 12.9898) * 43758.5453 % 1
}

describe('OneEuroFilter', () => {
  it('passes the first sample through unchanged', () => {
    expect(new OneEuroFilter().filter(42, 0)).toBe(42)
  })

  it('leaves a constant signal unchanged', () => {
    const f = new OneEuroFilter()
    let y = 0
    for (let i = 0; i < 50; i++) y = f.filter(100, i * 33)
    expect(y).toBeCloseTo(100, 6)
  })

  it('reduces jitter on a noisy constant signal', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.0 })
    const raw: number[] = []
    const out: number[] = []
    for (let i = 0; i < 300; i++) {
      const x = 100 + 4 * noise(i)
      raw.push(x)
      out.push(f.filter(x, i * 33))
    }
    expect(variance(out.slice(50))).toBeLessThan(variance(raw.slice(50)) / 4)
  })

  it('follows a fast ramp with bounded lag', () => {
    const f = new OneEuroFilter({ minCutoff: 1.5, beta: 0.05 })
    let y = 0
    let x = 0
    for (let i = 0; i < 60; i++) {
      x = i * 2 // 60 deg/s at 30 fps
      y = f.filter(x, i * 33)
    }
    expect(x - y).toBeLessThan(15)
  })

  it('handles non-increasing timestamps without producing NaN', () => {
    const f = new OneEuroFilter()
    f.filter(10, 100)
    const y = f.filter(12, 100)
    expect(Number.isFinite(y)).toBe(true)
  })

  it('reset forgets history', () => {
    const f = new OneEuroFilter()
    f.filter(100, 0)
    f.filter(100, 33)
    f.reset()
    expect(f.filter(5, 66)).toBe(5)
  })
})
