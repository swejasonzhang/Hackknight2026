import { EXERCISE_IDS, EXERCISES, type ExerciseId } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { BONES, clampMetric, framed, JOINT_NAMES, restFor, skeletonFor, sweepFor, type JointName, type V3 } from './skeleton'

/** Seven readings from rest to the furthest each movement shows. */
const RANGE = Object.fromEntries(
  EXERCISE_IDS.map((e) => {
    const { restDeg, maxDeg } = EXERCISES[e]
    return [e, Array.from({ length: 7 }, (_, i) => restDeg + ((maxDeg - restDeg) * i) / 6)]
  }),
) as Record<ExerciseId, number[]>
const len = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
/** The inner angle at `mid` between the segments to `a` and `b`, in degrees. */
const inner = (a: [number, number], mid: [number, number], b: [number, number]) => {
  const u = [a[0] - mid[0], a[1] - mid[1]]
  const v = [b[0] - mid[0], b[1] - mid[1]]
  const cos = (u[0]! * v[0]! + u[1]! * v[1]!) / (Math.hypot(u[0]!, u[1]!) * Math.hypot(v[0]!, v[1]!))
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}
const xy = (p: V3): [number, number] => [p[0], p[1]]
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180

/** The three classics move one limb; everything else stays put. */
const MOVING: Partial<Record<ExerciseId, JointName[]>> = {
  elbow_flexion: ['rWrist', 'rFingertip'],
  shoulder_abduction: ['rElbow', 'rWrist', 'rFingertip'],
  seated_knee_extension: ['rAnkle', 'rToe'],
}
/** Movements whose goniometer base is a reference line rather than a joint. */
const REFERENCE_BASE: ExerciseId[] = ['shoulder_abduction', 'shoulder_press', 'lat_pulldown', 'ab_twist']

describe('skeletonFor: a whole body for every exercise', () => {
  it('poses all fifteen movements with every body part', () => {
    expect(EXERCISE_IDS).toHaveLength(15)
    const names = BONES.map((b) => b.name)
    for (const part of ['head', 'neck', 'torso', 'pelvis', 'rUpperArm', 'lUpperArm', 'rForearm', 'lForearm', 'rHand', 'lHand', 'rThigh', 'lThigh', 'rShin', 'lShin', 'rFoot', 'lFoot'] as const) {
      expect(names).toContain(part)
    }
    for (const exercise of EXERCISE_IDS) {
      for (const deg of RANGE[exercise]) {
        const s = skeletonFor(exercise, deg)
        for (const j of JOINT_NAMES) expect(s.joints[j].every(Number.isFinite), `${exercise} ${deg} ${j}`).toBe(true)
      }
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
        if (!REFERENCE_BASE.includes(exercise)) expect(base).toEqual(xy(s.joints[b]))
      }
    }
    // The shoulder movements measure from the trunk line, down the side from the shoulder to hip level.
    const s = skeletonFor('shoulder_press', 120)
    expect(s.overlay.base[0]).toBeCloseTo(s.joints.rShoulder[0], 9)
    expect(s.overlay.base[1]).toBeCloseTo(s.joints.rHip[1], 9)
    // The twist measures the shoulder line against the level.
    const t = skeletonFor('ab_twist', 20)
    expect(t.overlay.base[1]).toBeCloseTo(t.joints.rShoulder[1], 9)
  })

  it('shows exactly the reading at the tracked joint, as the camera app would measure it', () => {
    for (const exercise of EXERCISE_IDS) {
      const cfg = EXERCISES[exercise]
      for (const deg of RANGE[exercise]) {
        const { base, mid, end } = skeletonFor(exercise, deg).overlay
        expect(cfg.metricFromInnerAngle(inner(base, mid, end)), `${exercise} ${deg}°`).toBeCloseTo(deg, 4)
      }
    }
  })

  it('points the goniometer arc at the moving segment, from rest, without wrapping', () => {
    for (const exercise of EXERCISE_IDS) {
      const rest = skeletonFor(exercise, restFor(exercise)).overlay
      expect(rest.currentDeg, exercise).toBeCloseTo(rest.restDeg, 9)
      for (const deg of RANGE[exercise]) {
        const o = skeletonFor(exercise, deg).overlay
        const actual = (Math.atan2(o.end[1] - o.mid[1], o.end[0] - o.mid[0]) * 180) / Math.PI
        expect(wrap(o.currentDeg - actual), `${exercise} ${deg}°`).toBeCloseTo(0, 4)
        expect(Math.abs(o.currentDeg - o.restDeg), `${exercise} ${deg}° sweep`).toBeCloseTo(Math.abs(sweepFor(exercise, deg)), 9)
      }
    }
  })

  it('never stretches a limb, and the left and right limbs match', () => {
    for (const exercise of EXERCISE_IDS) {
      const lengths = RANGE[exercise].map((deg) => {
        const j = skeletonFor(exercise, deg).joints
        return BONES.map((bone) => len(j[bone.from], j[bone.to]))
      })
      for (const row of lengths) row.forEach((l, i) => expect(l, `${exercise} ${BONES[i]!.name}`).toBeCloseTo(lengths[0]![i]!, 6))
      const j = skeletonFor(exercise, RANGE[exercise][0]!).joints
      for (const [r, l] of [
        [['rShoulder', 'rElbow'], ['lShoulder', 'lElbow']],
        [['rElbow', 'rWrist'], ['lElbow', 'lWrist']],
        [['rHip', 'rKnee'], ['lHip', 'lKnee']],
        [['rKnee', 'rAnkle'], ['lKnee', 'lAnkle']],
      ] as [JointName[], JointName[]][]) {
        expect(len(j[r[0]!], j[r[1]!]), exercise).toBeCloseTo(len(j[l[0]!], j[l[1]!]), 6)
      }
    }
  })

  it('moves only the exercising limb in the three classics; the rest of the body holds still', () => {
    for (const [exercise, moving] of Object.entries(MOVING) as [ExerciseId, JointName[]][]) {
      const a = skeletonFor(exercise, RANGE[exercise][1]!).joints
      const b = skeletonFor(exercise, RANGE[exercise][5]!).joints
      for (const name of JOINT_NAMES) {
        if (moving.includes(name)) expect(len(a[name], b[name]), `${exercise} ${name} moves`).toBeGreaterThan(0.1)
        else expect(len(a[name], b[name]), `${exercise} ${name} stays`).toBeCloseTo(0, 9)
      }
    }
  })

  it('keeps the feet planted when the whole body moves', () => {
    for (const exercise of ['squat', 'deadlift', 'lunge', 'bent_over_row'] as const) {
      const a = skeletonFor(exercise, RANGE[exercise][0]!).joints
      const b = skeletonFor(exercise, RANGE[exercise][6]!).joints
      for (const name of ['rAnkle', 'lAnkle', 'rToe', 'lToe'] as const) expect(len(a[name], b[name]), `${exercise} ${name}`).toBeCloseTo(0, 9)
      // ...while the hips really travel.
      if (exercise !== 'bent_over_row') expect(len(a.rHip, b.rHip), `${exercise} hips`).toBeGreaterThan(0.2)
    }
  })

  it('stands, sits or lies on the floor and never sinks through it', () => {
    for (const exercise of EXERCISE_IDS) {
      for (const deg of RANGE[exercise]) {
        const j = skeletonFor(exercise, deg).joints
        for (const name of JOINT_NAMES) expect(j[name][1], `${exercise} ${deg}° ${name}`).toBeGreaterThanOrEqual(0)
        if (exercise !== 'crunch') expect(Math.min(j.lToe[1], j.rToe[1]), `${exercise} ${deg}° a foot on the floor`).toBeCloseTo(0.05, 6)
      }
    }
    for (const exercise of ['elbow_flexion', 'shoulder_abduction', 'ab_twist'] as const) expect(skeletonFor(exercise, 10).joints.headTop[1]).toBeGreaterThan(6)
    const seated = skeletonFor('seated_knee_extension', 90)
    expect(seated.seat).toBeDefined()
    expect(seated.joints.rHip[1]).toBeGreaterThan(seated.seat!.top)
    const lying = skeletonFor('crunch', 15).joints
    expect(lying.rShoulder[1]).toBeCloseTo(lying.rHip[1], 6) // flat on the back
    expect(skeletonFor('crunch', 60).joints.rShoulder[1]).toBeGreaterThan(lying.rShoulder[1] + 0.5) // curled up
  })

  it('starts the three classics from rest: the forearm, the arm and the shin hanging straight down', () => {
    expect(restFor('elbow_flexion')).toBe(0)
    expect(restFor('shoulder_abduction')).toBe(0)
    expect(restFor('seated_knee_extension')).toBe(90)
    for (const exercise of ['elbow_flexion', 'shoulder_abduction', 'seated_knee_extension'] as const) {
      expect(wrap(skeletonFor(exercise, restFor(exercise)).overlay.restDeg + 90)).toBeCloseTo(0, 9)
    }
  })

  it('clamps readings to what the movement can show', () => {
    expect(clampMetric('seated_knee_extension', 40)).toBe(90)
    expect(clampMetric('elbow_flexion', -10)).toBe(0)
    expect(clampMetric('shoulder_abduction', 200)).toBe(180)
    expect(clampMetric('squat', 150)).toBe(EXERCISES.squat.maxDeg)
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
