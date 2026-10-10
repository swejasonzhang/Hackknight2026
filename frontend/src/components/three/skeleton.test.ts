import { EXERCISE_IDS, type ExerciseId } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { BONES, clampMetric, framed, JOINT_NAMES, restFor, skeletonFor, type JointName, type V3 } from './skeleton'

const RANGE: Record<ExerciseId, number[]> = {
  elbow_flexion: [0, 30, 60, 90, 120, 150, 180],
  shoulder_abduction: [0, 30, 60, 90, 120, 150, 180],
  seated_knee_extension: [90, 105, 120, 135, 150, 165, 180],
}
const len = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
/** The inner angle at `mid` between the segments to `a` and `b`, in degrees. */
const inner = (a: [number, number], mid: [number, number], b: [number, number]) => {
  const u = [a[0] - mid[0], a[1] - mid[1]]
  const v = [b[0] - mid[0], b[1] - mid[1]]
  const cos = (u[0]! * v[0]! + u[1]! * v[1]!) / (Math.hypot(u[0]!, u[1]!) * Math.hypot(v[0]!, v[1]!))
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}
const xy = (p: V3): [number, number] => [p[0], p[1]]

/** Which joints the exercise moves; everything else must hold still. */
const MOVING: Record<ExerciseId, JointName[]> = {
  elbow_flexion: ['rWrist', 'rFingertip'],
  shoulder_abduction: ['rElbow', 'rWrist', 'rFingertip'],
  seated_knee_extension: ['rAnkle', 'rToe'],
}

describe('skeletonFor: a whole body for every exercise', () => {
  it('has every body part: head, neck, torso, pelvis, and both arms, hands, legs and feet', () => {
    const names = BONES.map((b) => b.name)
    for (const part of ['head', 'neck', 'torso', 'pelvis', 'rUpperArm', 'lUpperArm', 'rForearm', 'lForearm', 'rHand', 'lHand', 'rThigh', 'lThigh', 'rShin', 'lShin', 'rFoot', 'lFoot'] as const) {
      expect(names).toContain(part)
    }
    for (const exercise of EXERCISE_IDS) {
      const s = skeletonFor(exercise, RANGE[exercise][3]!)
      for (const j of JOINT_NAMES) expect(s.joints[j].every(Number.isFinite), `${exercise} ${j}`).toBe(true)
    }
  })

  it('puts the tracked landmarks on the body joints the camera app follows', () => {
    for (const exercise of EXERCISE_IDS) {
      for (const deg of RANGE[exercise]) {
        const s = skeletonFor(exercise, deg)
        const { base, mid, end } = s.overlay
        const [b, m, e] = s.overlay.joints
        expect(mid).toEqual(xy(s.joints[m]))
        expect(end).toEqual(xy(s.joints[e]))
        if (exercise === 'shoulder_abduction') {
          // The goniometer's fixed arm runs down the side of the trunk from the shoulder to hip level.
          expect(base[0]).toBeCloseTo(s.joints.rShoulder[0], 9)
          expect(base[1]).toBeCloseTo(s.joints.rHip[1], 9)
        } else {
          expect(base).toEqual(xy(s.joints[b]))
        }
      }
    }
  })

  it('bends the tracked joint to the reading: elbow 180° minus flexion, shoulder and knee the reading itself', () => {
    for (const exercise of EXERCISE_IDS) {
      for (const deg of RANGE[exercise]) {
        const { base, mid, end } = skeletonFor(exercise, deg).overlay
        const expected = exercise === 'elbow_flexion' ? 180 - deg : deg
        expect(inner(base, mid, end), `${exercise} ${deg}°`).toBeCloseTo(expected, 6)
      }
    }
  })

  it('never stretches a limb, and the left and right limbs match', () => {
    for (const exercise of EXERCISE_IDS) {
      const lengths = RANGE[exercise].map((deg) => {
        const j = skeletonFor(exercise, deg).joints
        return BONES.map((bone) => len(j[bone.from], j[bone.to]))
      })
      for (const row of lengths) row.forEach((l, i) => expect(l).toBeCloseTo(lengths[0]![i]!, 9))
      const j = skeletonFor(exercise, RANGE[exercise][0]!).joints
      for (const [r, l] of [
        [['rShoulder', 'rElbow'], ['lShoulder', 'lElbow']],
        [['rElbow', 'rWrist'], ['lElbow', 'lWrist']],
        [['rHip', 'rKnee'], ['lHip', 'lKnee']],
        [['rKnee', 'rAnkle'], ['lKnee', 'lAnkle']],
      ] as [JointName[], JointName[]][]) {
        expect(len(j[r[0]!], j[r[1]!])).toBeCloseTo(len(j[l[0]!], j[l[1]!]), 9)
      }
    }
  })

  it('moves only the exercising limb; the rest of the body holds still', () => {
    for (const exercise of EXERCISE_IDS) {
      const a = skeletonFor(exercise, RANGE[exercise][1]!).joints
      const b = skeletonFor(exercise, RANGE[exercise][5]!).joints
      for (const name of JOINT_NAMES) {
        if (MOVING[exercise].includes(name)) expect(len(a[name], b[name]), `${exercise} ${name} moves`).toBeGreaterThan(0.1)
        else expect(len(a[name], b[name]), `${exercise} ${name} stays`).toBeCloseTo(0, 9)
      }
    }
  })

  it('stands on the floor, or sits on the stool with the resting foot on the floor', () => {
    for (const exercise of ['elbow_flexion', 'shoulder_abduction'] as const) {
      const j = skeletonFor(exercise, 90).joints
      expect(Math.min(j.lAnkle[1], j.rAnkle[1])).toBeGreaterThan(0)
      expect(Math.min(j.lToe[1], j.rToe[1])).toBeCloseTo(0.05, 6)
      expect(j.headTop[1]).toBeGreaterThan(6)
    }
    const seated = skeletonFor('seated_knee_extension', 90)
    expect(seated.seat).toBeDefined()
    expect(seated.joints.rHip[1]).toBeGreaterThan(seated.seat!.top)
    expect(seated.joints.lToe[1]).toBeCloseTo(0.05, 6)
  })

  it('starts every movement from rest: the forearm, the arm and the shin hanging straight down', () => {
    expect(restFor('elbow_flexion')).toBe(0)
    expect(restFor('shoulder_abduction')).toBe(0)
    expect(restFor('seated_knee_extension')).toBe(90)
    for (const exercise of EXERCISE_IDS) {
      const o = skeletonFor(exercise, restFor(exercise)).overlay
      expect(o.currentDeg).toBeCloseTo(o.restDeg, 9)
    }
  })

  it('clamps readings to what the movement can show', () => {
    expect(clampMetric('seated_knee_extension', 40)).toBe(90)
    expect(clampMetric('elbow_flexion', -10)).toBe(0)
    expect(clampMetric('shoulder_abduction', 200)).toBe(180)
  })
})

describe('framing', () => {
  it('keeps the whole body in view at every reading', () => {
    for (const exercise of EXERCISE_IDS) {
      for (const deg of RANGE[exercise]) {
        const j = skeletonFor(exercise, deg).joints
        for (const name of JOINT_NAMES) {
          const [x, y] = framed(exercise, j[name])
          expect(Math.abs(x), `${exercise} ${deg}° ${name} x`).toBeLessThanOrEqual(2)
          expect(Math.abs(y), `${exercise} ${deg}° ${name} y`).toBeLessThanOrEqual(1.35)
        }
      }
    }
  })
})
