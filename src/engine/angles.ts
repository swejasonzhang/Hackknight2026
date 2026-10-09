import type { JointTriple, Point3, PoseLandmark } from './types'

/**
 * Which landmark set the angle is computed from.
 * - world3d: MediaPipe worldLandmarks (meters, hip-centred). Less sensitive to the patient
 *   turning away from the camera, but depth (z) is estimated and noisier than x/y.
 * - image2d: normalized image landmarks, z ignored. Most stable when the joint moves in a
 *   plane parallel to the camera. Pass the video aspect ratio so angles are not distorted.
 */
export type AngleSource = 'world3d' | 'image2d'

const RAD_TO_DEG = 180 / Math.PI

/**
 * Inner angle at vertex `b` between rays b->a and b->c, in degrees (0..180).
 * `aspect` (width / height) un-squashes normalized image coordinates; leave it at 1 for
 * metric coordinates. Returns NaN when either ray has zero length.
 */
export function innerAngleDeg(a: Point3, b: Point3, c: Point3, use3d = true, aspect = 1): number {
  const bax = (a.x - b.x) * aspect
  const bay = a.y - b.y
  const baz = use3d ? a.z - b.z : 0
  const bcx = (c.x - b.x) * aspect
  const bcy = c.y - b.y
  const bcz = use3d ? c.z - b.z : 0
  const lenA = Math.hypot(bax, bay, baz)
  const lenC = Math.hypot(bcx, bcy, bcz)
  if (lenA === 0 || lenC === 0) return NaN
  const cos = (bax * bcx + bay * bcy + baz * bcz) / (lenA * lenC)
  return Math.acos(Math.min(1, Math.max(-1, cos))) * RAD_TO_DEG
}

export interface JointAngleSample {
  innerDeg: number
  /** Lowest visibility among the three landmarks (0..1) */
  minVisibility: number
}

/**
 * Angle at a joint from a full landmark list. Returns null when any of the three
 * landmarks is missing or below `minVisibility`, so callers can show "move into frame".
 */
export function jointAngle(
  points: readonly PoseLandmark[],
  triple: JointTriple,
  source: AngleSource,
  aspect = 1,
  minVisibility = 0.5,
): JointAngleSample | null {
  const a = points[triple[0]]
  const b = points[triple[1]]
  const c = points[triple[2]]
  if (!a || !b || !c) return null
  const vis = Math.min(a.visibility ?? 1, b.visibility ?? 1, c.visibility ?? 1)
  if (vis < minVisibility) return null
  const deg = innerAngleDeg(a, b, c, source === 'world3d', source === 'image2d' ? aspect : 1)
  if (Number.isNaN(deg)) return null
  return { innerDeg: deg, minVisibility: vis }
}
