import { EXERCISES, type ExerciseId, type Side } from '@arc/dependencies'

/** One MediaPipe pose landmark: x and y from 0 to 1 across the video, and how sure the model is it is visible. */
export interface Landmark {
  x: number
  y: number
  z?: number
  visibility?: number
}

export interface JointReading {
  /** False when a landmark of the joint is missing or the model cannot see it well enough. */
  tracked: boolean
  /** The exercise's metric (elbow flexion, shoulder abduction, knee angle), degrees. */
  metricDeg: number
  /** The raw angle at the joint, 180 = straight. */
  innerDeg: number
  /** The three landmarks, proximal to distal, in video coordinates (0..1). */
  points: [[number, number], [number, number], [number, number]] | null
}

/** Below this the model is guessing where the joint is. */
export const MIN_VISIBILITY = 0.5

/** The angle at `b` between the segments to `a` and `c`, in degrees (0..180). */
export function innerAngleDeg(a: [number, number], b: [number, number], c: [number, number]): number {
  const u = [a[0] - b[0], a[1] - b[1]]
  const v = [c[0] - b[0], c[1] - b[1]]
  const cos = (u[0]! * v[0]! + u[1]! * v[1]!) / (Math.hypot(u[0]!, u[1]!) * Math.hypot(v[0]!, v[1]!))
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}

const UNTRACKED: JointReading = { tracked: false, metricDeg: 0, innerDeg: 0, points: null }

/**
 * The exercise's joint, read from a pose: the landmarks named in the exercise config for the
 * chosen side (MediaPipe names sides from the person's point of view, on the unmirrored frame),
 * the angle measured on the real picture (`aspect` = video width / height, since x and y are
 * both 0..1), and the config's conversion to the metric the rep counter and dashboard use.
 */
export function readJoint(landmarks: readonly Landmark[] | null | undefined, exercise: ExerciseId, side: Side, aspect = 1): JointReading {
  if (!landmarks) return UNTRACKED
  const cfg = EXERCISES[exercise]
  const marks = cfg.joints[side].map((i) => landmarks[i])
  if (marks.some((m) => !m || (m.visibility ?? 1) < MIN_VISIBILITY)) return UNTRACKED
  const points = marks.map((m) => [m!.x, m!.y]) as JointReading['points'] & object
  const [a, b, c] = points.map(([x, y]) => [x * aspect, y] as [number, number]) as [[number, number], [number, number], [number, number]]
  const innerDeg = innerAngleDeg(a, b, c)
  return { tracked: true, innerDeg, metricDeg: cfg.metricFromInnerAngle(innerDeg), points }
}
