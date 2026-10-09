import { describe, expect, it } from 'vitest'
import { createRepCycle } from './repCycle'

describe('createRepCycle (hero rep detector)', () => {
  it('counts a rep once the angle passes the top and returns below the bottom, reporting the peak', () => {
    const cycle = createRepCycle({ top: 115, bottom: 35 })
    const events = [20, 60, 100, 118, 131, 127, 90, 40, 30].map((a) => cycle.feed(a))
    const completed = events.filter((e) => e.completed)
    expect(completed).toHaveLength(1)
    expect(completed[0]).toMatchObject({ rep: 1, peak: 131 })
  })

  it('does not double count when the angle wobbles around the top', () => {
    const cycle = createRepCycle({ top: 115, bottom: 35 })
    const completed = [20, 116, 112, 117, 113, 130, 60, 30].map((a) => cycle.feed(a)).filter((e) => e.completed)
    expect(completed).toHaveLength(1)
  })

  it('ignores a movement that never reaches the top', () => {
    const cycle = createRepCycle({ top: 115, bottom: 35 })
    const completed = [20, 80, 100, 60, 20].map((a) => cycle.feed(a)).filter((e) => e.completed)
    expect(completed).toHaveLength(0)
  })

  it('keeps counting across reps and can be reset', () => {
    const cycle = createRepCycle({ top: 115, bottom: 35 })
    const one = [20, 130, 20]
    const reps = [...one, ...one, ...one].map((a) => cycle.feed(a)).filter((e) => e.completed)
    expect(reps.map((r) => r.rep)).toEqual([1, 2, 3])
    cycle.reset()
    expect(one.map((a) => cycle.feed(a)).filter((e) => e.completed)[0]?.rep).toBe(1)
  })
})
