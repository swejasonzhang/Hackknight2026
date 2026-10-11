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

  it('reads a movement with no side on whichever side faces the camera, and a one-sided one only on its own side', () => {
    // Left hip 23, knee 25, ankle 27: the member faces the other way from the plan's side.
    const left = pose({ 23: [0.4, 0.4], 25: [0.6, 0.4], 27: [0.6, 0.7] })
    const squat = readJoint(left, 'squat', 'right')
    expect(squat.tracked).toBe(true)
    expect(squat.metricDeg).toBeCloseTo(90, 6)
    // Both sides in view: the chosen one wins.
    const both = pose({ 23: [0.4, 0.4], 25: [0.6, 0.4], 27: [0.6, 0.7], 24: [0.4, 0.4], 26: [0.4, 0.6], 28: [0.4, 0.8] })
    expect(readJoint(both, 'squat', 'right').metricDeg).toBeCloseTo(0, 6)
    // Left leg in view, right lunge chosen: the lunge waits for the right leg.
    expect(readJoint(left, 'lunge', 'right').tracked).toBe(false)
  })

  it('is not tracked when a joint is hidden or there is nobody in view', () => {
    expect(readJoint(pose({ 12: [0.5, 0.2], 14: [0.5, 0.4], 16: [0.7, 0.4] }, 0.2), 'elbow_flexion', 'right').tracked).toBe(false)
    expect(readJoint(pose({ 12: [0.5, 0.2], 14: [0.5, 0.4] }), 'elbow_flexion', 'right').tracked).toBe(false)
    expect(readJoint(null, 'elbow_flexion', 'right').tracked).toBe(false)
  })
})

describe('readJoint in space', () => {
  /** A right arm seen from the front, the forearm swinging toward the camera by `flex` degrees. */
  function facingCurl(flex: number) {
    const r = (flex * Math.PI) / 180
    // In metres round the hips (y down, z toward the camera), and as the flat picture shows it.
    const world = pose({ 12: [0, -0.3], 14: [0, 0], 16: [0, 0.25] })
    world[12] = { x: 0, y: -0.3, z: 0, visibility: 0.99 }
    world[14] = { x: 0, y: 0, z: 0, visibility: 0.99 }
    world[16] = { x: 0.004, y: 0.25 * Math.cos(r), z: -0.25 * Math.sin(r), visibility: 0.99 }
    const picture = pose({ 12: [0.5, 0.3], 14: [0.5, 0.45], 16: [0.502, 0.45 + 0.125 * Math.cos(r)] })
    return { world, picture }
  }

  it('reads a curl done facing the camera true, where the flat picture loses the forearm', () => {
    for (const flex of [10, 45, 90, 120]) {
      const { world, picture } = facingCurl(flex)
      expect(readJoint(picture, 'elbow_flexion', 'right', 16 / 9, world).metricDeg, `${flex}°`).toBeCloseTo(flex, 0)
    }
    // At 90° the forearm points straight at the lens. On the picture it is a stub, and a few
    // pixels of the model's shake swing its angle across the whole range; in space it holds.
    const { world } = facingCurl(90)
    const shaken = (dx: number, dy: number) => {
      const picture = pose({ 12: [0.5, 0.3], 14: [0.5, 0.45], 16: [0.5 + dx, 0.45 + dy] })
      const inSpace = world.map((p, i) => (i === 16 ? { ...p, x: p.x + dx, y: p.y + dy } : p))
      return { flat: readJoint(picture, 'elbow_flexion', 'right', 16 / 9).metricDeg, space: readJoint(picture, 'elbow_flexion', 'right', 16 / 9, inSpace).metricDeg }
    }
    const a = shaken(0.002, 0.005)
    const b = shaken(-0.002, -0.005)
    expect(Math.abs(a.flat - b.flat)).toBeGreaterThan(60)
    expect(Math.abs(a.space - b.space)).toBeLessThan(3)
  })

  it('reads a curl filmed side on from the picture, where the model\'s depth would flatten its top', () => {
    // Side on: the arm bends across the picture. In space the model flattens the bend (140° reads
    // about 120°), as a real webcam run through the pose model showed.
    const r = (d: number) => (d * Math.PI) / 180
    const flex = 140
    const picture = pose({ 12: [0.5, 0.3], 14: [0.5, 0.45], 16: [0.5 + (0.12 * Math.sin(r(flex))) / (16 / 9), 0.45 - 0.12 * Math.cos(r(180 - flex))] })
    const flat = readJoint(picture, 'elbow_flexion', 'right', 16 / 9).metricDeg
    const world = pose({})
    world[12] = { x: 0, y: -0.3, z: 0.01, visibility: 0.99 }
    world[14] = { x: 0, y: 0, z: 0, visibility: 0.99 }
    world[16] = { x: 0.25 * Math.sin(r(120)), y: -0.25 * Math.cos(r(180 - 120)), z: -0.01, visibility: 0.99 }
    expect(readJoint(picture, 'elbow_flexion', 'right', 16 / 9, world).metricDeg).toBeCloseTo(flat, 3)
  })

  it('measures a tilt on the picture, where level is, even with the landmarks in space', () => {
    const rise = 0.2 * Math.tan((25 * Math.PI) / 180)
    const picture = pose({ 11: [0.6, 0.3 - rise], 12: [0.4, 0.3] })
    const world = pose({ 11: [0.2, 0], 12: [-0.2, 0] })
    expect(readJoint(picture, 'ab_twist', 'left', 1, world).metricDeg).toBeCloseTo(25, 6)
  })

  it('measures a reading across the body (the pec fly) on the picture, where its thresholds are set', () => {
    // Arms open wide, the wrists level with the shoulders and a little in front of them.
    const picture = pose({ 15: [0.85, 0.42], 11: [0.6, 0.4], 16: [0.15, 0.42] })
    const world = pose({})
    world[15] = { x: 0.7, y: 0.05, z: -0.35, visibility: 0.99 }
    world[11] = { x: 0.18, y: 0, z: 0, visibility: 0.99 }
    world[16] = { x: -0.7, y: 0.05, z: -0.35, visibility: 0.99 }
    const flat = readJoint(picture, 'pec_fly', 'right', 1)
    expect(readJoint(picture, 'pec_fly', 'right', 1, world).metricDeg).toBeCloseTo(flat.metricDeg, 9)
    expect(flat.metricDeg).toBeLessThan(EXERCISES.pec_fly.exitDeg)
  })

  it('keeps reading one side of a movement with no side until the other is clearly better seen', () => {
    // A squat seen side on: both legs' hip, knee and ankle, the right a little clearer than the left.
    const legs = (right: number, left: number) => {
      const p = pose({ 24: [0.5, 0.5], 26: [0.5, 0.7], 28: [0.5, 0.9], 23: [0.52, 0.5], 25: [0.52, 0.7], 27: [0.52, 0.9] })
      for (const i of [24, 26, 28]) p[i]!.visibility = right
      for (const i of [23, 25, 27]) p[i]!.visibility = left
      return p
    }
    expect(readJoint(legs(0.9, 0.85), 'squat', 'left').side).toBe('right')
    expect(readJoint(legs(0.9, 0.85), 'squat', 'left', 1, null, 'left').side).toBe('left')
    expect(readJoint(legs(0.95, 0.6), 'squat', 'left', 1, null, 'left').side).toBe('right')
    // A movement with a side always reads the side chosen.
    expect(readJoint(pose({ 11: [0.5, 0.2], 13: [0.5, 0.4], 15: [0.6, 0.5] }), 'elbow_flexion', 'right', 1, null, 'left').side).toBe('right')
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
