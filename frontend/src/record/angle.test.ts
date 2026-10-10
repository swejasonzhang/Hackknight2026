import { EXERCISE_IDS, EXERCISES } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { innerAngleDeg, readJoint, type Landmark } from './angle'

/** 33 landmarks, all out of view, then the given ones placed and visible. */
function pose(points: Record<number, [number, number]>, visibility = 0.99): Landmark[] {
  const all: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }))
  for (const [i, [x, y]] of Object.entries(points)) all[Number(i)] = { x, y, visibility }
  return all
}

describe('innerAngleDeg', () => {
  it('reads 180 for a straight line and 90 for a right angle', () => {
    expect(innerAngleDeg([0, 0], [0, 1], [0, 2])).toBeCloseTo(180, 9)
    expect(innerAngleDeg([0, 0], [0, 1], [1, 1])).toBeCloseTo(90, 9)
  })
})

describe('readJoint', () => {
  it("reads the right arm from MediaPipe's right-side landmarks and converts to elbow flexion", () => {
    // Right shoulder 12, elbow 14, wrist 16: a straight arm hanging down, then bent square.
    const straight = readJoint(pose({ 12: [0.5, 0.2], 14: [0.5, 0.4], 16: [0.5, 0.6] }), 'elbow_flexion', 'right')
    expect(straight.tracked).toBe(true)
    expect(straight.metricDeg).toBeCloseTo(0, 6)
    const bent = readJoint(pose({ 12: [0.5, 0.2], 14: [0.5, 0.4], 16: [0.7, 0.4] }), 'elbow_flexion', 'right')
    expect(bent.metricDeg).toBeCloseTo(90, 6)
    expect(bent.points).toEqual([[0.5, 0.2], [0.5, 0.4], [0.7, 0.4]])
  })

  it('measures on the real picture, not the squashed 0..1 coordinates of a wide video', () => {
    // In a 16:9 frame, 0.1125 across is the same distance on screen as 0.2 down.
    const wide = readJoint(pose({ 12: [0.5, 0.2], 14: [0.5, 0.4], 16: [0.5 + 0.2 / (16 / 9), 0.4] }), 'elbow_flexion', 'right', 16 / 9)
    expect(wide.metricDeg).toBeCloseTo(90, 6)
  })

  it('uses the hip, shoulder and elbow for abduction and the knee angle itself for knee extension', () => {
    const raised = readJoint(pose({ 23: [0.6, 0.7], 11: [0.6, 0.3], 13: [0.8, 0.3] }), 'shoulder_abduction', 'left')
    expect(raised.metricDeg).toBeCloseTo(90, 6)
    const knee = readJoint(pose({ 24: [0.3, 0.5], 26: [0.6, 0.5], 28: [0.6, 0.8] }), 'seated_knee_extension', 'right')
    expect(knee.metricDeg).toBeCloseTo(90, 6)
  })

  it('reads the ab twist as the shoulder line against the level, whichever way it leans', () => {
    const level = readJoint(pose({ 11: [0.6, 0.3], 12: [0.4, 0.3] }), 'ab_twist', 'right')
    expect(level.metricDeg).toBeCloseTo(0, 6)
    const run = 0.2
    const rise = Math.tan((25 * Math.PI) / 180) * run
    expect(readJoint(pose({ 11: [0.6, 0.3 - rise], 12: [0.4, 0.3] }), 'ab_twist', 'left').metricDeg).toBeCloseTo(25, 6)
    expect(readJoint(pose({ 11: [0.6, 0.3 + rise], 12: [0.4, 0.3] }), 'ab_twist', 'right').metricDeg).toBeCloseTo(25, 6)
  })

  it('is not tracked when a joint is hidden or there is nobody in view', () => {
    expect(readJoint(pose({ 12: [0.5, 0.2], 14: [0.5, 0.4], 16: [0.7, 0.4] }, 0.2), 'elbow_flexion', 'right').tracked).toBe(false)
    expect(readJoint(pose({ 12: [0.5, 0.2], 14: [0.5, 0.4] }), 'elbow_flexion', 'right').tracked).toBe(false)
    expect(readJoint(null, 'elbow_flexion', 'right').tracked).toBe(false)
  })
})

describe('the simulated person (development only)', () => {
  it('produces landmarks that read back as the reading it was given, for every exercise and side', async () => {
    const { simulatedLandmarks } = await import('./simulated')
    for (const exercise of EXERCISE_IDS) {
      const { restDeg, targetDeg } = EXERCISES[exercise]
      for (const deg of [restDeg, (restDeg + targetDeg) / 2, targetDeg]) {
        for (const side of ['left', 'right'] as const) {
          const reading = readJoint(simulatedLandmarks(exercise, side, deg), exercise, side, 16 / 9)
          expect(reading.tracked, `${exercise} ${side}`).toBe(true)
          expect(reading.metricDeg, `${exercise} ${side} ${deg}°`).toBeCloseTo(deg, 4)
        }
      }
    }
  })
})
