import type { ExerciseId } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { armPose } from './armPose'
import { bodyFor, framed, type BodyPart } from './bodyPose'

const near = (a: [number, number], b: [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0], 6)
  expect(a[1]).toBeCloseTo(b[1], 6)
}
const part = (parts: BodyPart[], name: string) => {
  const p = parts.find((x) => x.name === name)
  if (!p) throw new Error(`no ${name}`)
  return p
}
const dir = (p: BodyPart) => Math.atan2(p.to[1] - p.from[1], p.to[0] - p.from[0])

const ANGLES: Record<ExerciseId, number[]> = {
  elbow_flexion: [0, 45, 90, 140],
  shoulder_abduction: [0, 60, 120, 170],
  seated_knee_extension: [90, 120, 150, 180],
}

describe('bodyFor: the body model follows the tracked joints', () => {
  it('elbow flexion: the upper arm runs shoulder to elbow and the forearm elbow to wrist at every angle', () => {
    for (const deg of ANGLES.elbow_flexion) {
      const pose = armPose('elbow_flexion', deg)
      const body = bodyFor('elbow_flexion', pose)
      near(part(body, 'upperArm').from, pose.base)
      near(part(body, 'upperArm').to, pose.mid)
      near(part(body, 'forearm').from, pose.mid)
      near(part(body, 'forearm').to, pose.end)
      near(part(body, 'hand').from, pose.end)
      expect(dir(part(body, 'hand'))).toBeCloseTo(dir(part(body, 'forearm')), 6)
      // Seen from the side: the trunk stands behind the arm, from below the elbow to the shoulder.
      const torso = part(body, 'torso')
      expect(torso.z).toBeLessThan(0)
      expect(torso.view).toBe('side')
      expect(torso.to[1]).toBeGreaterThanOrEqual(pose.base[1])
    }
  })

  it('shoulder abduction: the torso stands from hip to shoulder and the straight arm rises from the shoulder through the elbow', () => {
    for (const deg of ANGLES.shoulder_abduction) {
      const pose = armPose('shoulder_abduction', deg)
      const body = bodyFor('shoulder_abduction', pose)
      const torso = part(body, 'torso')
      expect(torso.to[1]).toBeGreaterThanOrEqual(pose.mid[1])
      expect(torso.from[1]).toBeCloseTo(pose.base[1], 6)
      near(part(body, 'upperArm').from, pose.mid)
      near(part(body, 'upperArm').to, pose.end)
      near(part(body, 'forearm').from, pose.end)
      expect(dir(part(body, 'forearm'))).toBeCloseTo(dir(part(body, 'upperArm')), 6)
      expect(part(body, 'head').to[1]).toBeGreaterThan(torso.to[1])
      // The shoulder landmark sits at the outer edge of the chest, not over the neck.
      expect(pose.mid[0] - torso.to[0]).toBeGreaterThanOrEqual(0.28)
    }
  })

  it('seated knee extension: the thigh runs hip to knee, the shin knee to ankle, and the foot stays square to the shin', () => {
    for (const deg of ANGLES.seated_knee_extension) {
      const pose = armPose('seated_knee_extension', deg)
      const body = bodyFor('seated_knee_extension', pose)
      near(part(body, 'thigh').from, pose.base)
      near(part(body, 'thigh').to, pose.mid)
      near(part(body, 'shin').from, pose.mid)
      near(part(body, 'shin').to, pose.end)
      near(part(body, 'foot').from, pose.end)
      expect(Math.cos(dir(part(body, 'foot')) - dir(part(body, 'shin')))).toBeCloseTo(0, 6)
      expect(part(body, 'seat').to[1]).toBeLessThan(pose.base[1])
    }
  })

  it('moves the distal body part when the angle changes and leaves the fixed part where it was', () => {
    for (const exercise of Object.keys(ANGLES) as ExerciseId[]) {
      const [lo, , , hi] = ANGLES[exercise]
      const a = bodyFor(exercise, armPose(exercise, lo!))
      const b = bodyFor(exercise, armPose(exercise, hi!))
      const moving = exercise === 'seated_knee_extension' ? 'shin' : exercise === 'elbow_flexion' ? 'forearm' : 'upperArm'
      const fixed = exercise === 'seated_knee_extension' ? 'thigh' : exercise === 'elbow_flexion' ? 'upperArm' : 'torso'
      expect(part(b, moving).to).not.toEqual(part(a, moving).to)
      near(part(b, fixed).from, part(a, fixed).from)
      near(part(b, fixed).to, part(a, fixed).to)
    }
  })
})

describe('FRAMING', () => {
  it('keeps the whole body in view at every angle of every exercise', () => {
    for (const exercise of Object.keys(ANGLES) as ExerciseId[]) {
      for (const deg of [...ANGLES[exercise], exercise === 'seated_knee_extension' ? 90 : 0, 180]) {
        for (const p of bodyFor(exercise, armPose(exercise, deg))) {
          for (const pt of [p.from, p.to]) {
            const [x, y] = framed(exercise, pt)
            expect(Math.abs(x), `${exercise} ${deg}° ${p.name} x`).toBeLessThanOrEqual(1.8)
            expect(Math.abs(y), `${exercise} ${deg}° ${p.name} y`).toBeLessThanOrEqual(1.25)
          }
        }
      }
    }
  })
})
