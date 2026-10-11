import { describe, expect, it } from 'vitest'
import { FAULT_LINE, FORM_CHECKS, FORM_FAULTS, FormWatch, type PosePoint } from './form.ts'
import { EXERCISE_IDS, LM } from './types.ts'

/** 33 landmarks out of view, then the given ones placed and seen. */
function pose(points: Record<number, [number, number]>): PosePoint[] {
  const all: PosePoint[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }))
  for (const [i, [x, y]] of Object.entries(points)) all[Number(i)] = { x, y, visibility: 0.99 }
  return all
}
const rad = (d: number) => (d * Math.PI) / 180
/** A right arm side on: shoulder at (0.5, 0.3), upper arm `upperDeg` from straight down, forearm `foreDeg`; hip below. */
function arm(upperDeg: number, foreDeg: number, hipX = 0.5) {
  const shoulder: [number, number] = [0.5, 0.3]
  const elbow: [number, number] = [shoulder[0] + 0.15 * Math.sin(rad(upperDeg)), shoulder[1] + 0.15 * Math.cos(rad(upperDeg))]
  const wrist: [number, number] = [elbow[0] + 0.13 * Math.sin(rad(foreDeg)), elbow[1] + 0.13 * Math.cos(rad(foreDeg))]
  return pose({ [LM.RIGHT_SHOULDER]: shoulder, [LM.RIGHT_ELBOW]: elbow, [LM.RIGHT_WRIST]: wrist, [LM.RIGHT_HIP]: [hipX, 0.6] })
}

describe('form checks', () => {
  it('passes a curl with the upper arm still, however far the forearm moves', () => {
    const w = new FormWatch('elbow_flexion', 'right')
    w.start(arm(0, 0))
    for (const fore of [30, 60, 120, 150]) expect(w.check(arm(5, fore))).toBeNull()
  })

  it('refuses a curl whose upper arm swings forward, and keeps the reason for the rest of the rep', () => {
    const w = new FormWatch('elbow_flexion', 'right')
    w.start(arm(0, 0))
    expect(w.check(arm(40, 120))).toBe('upper_arm_moved')
    expect(w.check(arm(0, 0))).toBe('upper_arm_moved')
    w.reset()
    w.start(arm(0, 0))
    expect(w.check(arm(0, 90))).toBeNull()
  })

  it('refuses a curl that swings the body', () => {
    const w = new FormWatch('elbow_flexion', 'right')
    w.start(arm(0, 0, 0.5))
    // The hip moves back under a still shoulder: the trunk tips about 25 degrees.
    expect(w.check(arm(0, 90, 0.36))).toBe('body_swing')
  })

  it('wants a straight arm in a lateral raise', () => {
    const w = new FormWatch('shoulder_abduction', 'right')
    w.start(arm(0, 0))
    expect(w.check(arm(0, 10))).toBeNull()
    expect(w.check(arm(0, 80))).toBe('arm_bent')
  })

  it('skips a check it cannot see rather than failing it', () => {
    const w = new FormWatch('elbow_flexion', 'right')
    w.start(pose({}))
    expect(w.check(pose({}))).toBeNull()
  })

  it('judges whole-body movements on depth and tempo alone, and has words for every fault', () => {
    for (const id of ['deadlift', 'squat', 'crunch', 'ab_twist', 'pec_fly'] as const) expect(FORM_CHECKS[id]).toHaveLength(0)
    for (const id of EXERCISE_IDS) expect(FORM_CHECKS[id]).toBeDefined()
    for (const f of FORM_FAULTS) expect(FAULT_LINE[f]).toMatch(/\.$/)
  })
})
