import type { ExerciseId } from '@arc/dependencies'
import type { Pose } from './armPose'

/**
 * The body model around a pose: every part is a segment in the same flat XY plane as
 * `armPose`, anchored on the tracked landmarks, so when the joint angle changes the body moves
 * with it (the forearm, the raised arm, the shin) and the fixed part stays put. The 3D scene
 * turns each part into a sculpted mesh; this module stays pure so it can be tested without WebGL.
 */
export type PartName = 'upperArm' | 'forearm' | 'hand' | 'torso' | 'head' | 'thigh' | 'shin' | 'foot' | 'seat'

export interface BodyPart {
  name: PartName
  from: [number, number]
  to: [number, number]
  /** Depth in front of (+) or behind (−) the plane of the tracked joints. */
  z?: number
  /** A trunk seen face on (shoulder abduction) or side on (elbow flexion, the seated leg). */
  view?: 'front' | 'side'
}

/** How each exercise is framed in the scene: a scale and an offset that keep every pose in view. */
export const FRAMING: Record<ExerciseId, { scale: number; offset: [number, number] }> = {
  elbow_flexion: { scale: 0.82, offset: [-0.2, -0.02] },
  shoulder_abduction: { scale: 0.6, offset: [-0.1, -0.15] },
  seated_knee_extension: { scale: 0.86, offset: [-0.45, -0.45] },
}

const HAND = 0.24
const FOREARM = 0.72
const FOOT = 0.3
/** The shoulder joint sits at the side of the chest, so the torso's axis is set in from it. */
const TORSO_INSET = 0.3

type V = [number, number]
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]]
const scale = (a: V, k: number): V => [a[0] * k, a[1] * k]
const unit = (deg: number): V => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)]
const along = (from: V, deg: number, length: number): V => add(from, scale(unit(deg), length))

/** Torso and head standing up from a hip point, leaning back by `leanDeg`. */
function trunk(hip: V, length: number, { leanDeg = 0, z = 0, view = 'front' }: { leanDeg?: number; z?: number; view?: 'front' | 'side' } = {}): BodyPart[] {
  const up = 90 + leanDeg
  const top = along(hip, up, length)
  const neck = along(top, up, 0.05)
  return [
    { name: 'torso', from: hip, to: top, z, view },
    { name: 'head', from: neck, to: along(neck, up, 0.4), z, view },
  ]
}

export function bodyFor(exercise: ExerciseId, pose: Pose): BodyPart[] {
  switch (exercise) {
    case 'elbow_flexion':
      // Seen from the side: the trunk stands behind the arm, the upper arm hangs from the
      // shoulder, and the forearm and fist turn about the elbow.
      return [
        ...trunk([pose.base[0], pose.base[1] - 1.15], 1.2, { z: -0.42, view: 'side' }),
        { name: 'upperArm', from: pose.base, to: pose.mid },
        { name: 'forearm', from: pose.mid, to: pose.end },
        { name: 'hand', from: pose.end, to: along(pose.end, pose.distalDeg, HAND) },
      ]
    case 'shoulder_abduction': {
      // The torso stands still; the straight arm rises out to the side from the shoulder.
      const hip: V = [pose.base[0] - TORSO_INSET, pose.base[1]]
      const torsoLength = pose.mid[1] - pose.base[1] + 0.08
      const wrist = along(pose.end, pose.distalDeg, FOREARM)
      return [
        ...trunk(hip, torsoLength, { view: 'front' }),
        { name: 'upperArm', from: pose.mid, to: pose.end },
        { name: 'forearm', from: pose.end, to: wrist },
        { name: 'hand', from: wrist, to: along(wrist, pose.distalDeg, HAND) },
      ]
    }
    case 'seated_knee_extension': {
      // Seated: the thigh rests level on the seat, the shin swings from the knee, the foot stays square to it.
      const seatY = pose.base[1] - 0.27
      return [
        { name: 'seat', from: [pose.base[0] - 0.3, seatY], to: [pose.mid[0] + 0.02, seatY] },
        ...trunk([pose.base[0] - 0.06, pose.base[1] + 0.02], 0.98, { leanDeg: 8, z: -0.18, view: 'side' }),
        { name: 'thigh', from: pose.base, to: pose.mid },
        { name: 'shin', from: pose.mid, to: pose.end },
        { name: 'foot', from: pose.end, to: along(pose.end, pose.distalDeg + 90, FOOT) },
      ]
    }
  }
}

/** A point of the pose as it lands in the scene after framing. */
export function framed(exercise: ExerciseId, p: V): V {
  const f = FRAMING[exercise]
  return [p[0] * f.scale + f.offset[0], p[1] * f.scale + f.offset[1]]
}
