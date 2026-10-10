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
  /** The exercise's metric (elbow flexion, shoulder abduction, knee angle, shoulder tilt...), degrees. */
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

/** How far the line from `a` to `b` slopes off the level, either way, in degrees (0..90). */
export function tiltDeg(a: [number, number], b: [number, number]): number {
  const slope = Math.abs((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI)
  return slope > 90 ? 180 - slope : slope
}

const UNTRACKED: JointReading = { tracked: false, metricDeg: 0, innerDeg: 0, points: null }

/** How well the model sees a side's three landmarks: the least visible of them. */
function seen(landmarks: readonly Landmark[], exercise: ExerciseId, side: Side): number {
  return Math.min(...EXERCISES[exercise].joints[side].map((i) => (landmarks[i] ? (landmarks[i].visibility ?? 1) : 0)))
}

/**
 * The exercise's joint, read from a pose: the landmarks named in the exercise config for the
 * chosen side (MediaPipe names sides from the person's point of view, on the unmirrored frame),
 * the angle measured on the real picture (`aspect` = video width / height, since x and y are
 * both 0..1), and the config's conversion to the metric the rep counter and dashboard use. A
 * movement with no side to pick (a squat, a deadlift) is read on whichever side the camera sees
 * better, the chosen side when they tie, so it counts whichever way the member faces.
 */
export function readJoint(landmarks: readonly Landmark[] | null | undefined, exercise: ExerciseId, chosen: Side, aspect = 1): JointReading {
  if (!landmarks) return UNTRACKED
  const cfg = EXERCISES[exercise]
  const other: Side = chosen === 'right' ? 'left' : 'right'
  const side = !cfg.sided && seen(landmarks, exercise, other) > seen(landmarks, exercise, chosen) ? other : chosen
  const marks = cfg.joints[side].map((i) => landmarks[i])
  if (marks.some((m) => !m || (m.visibility ?? 1) < MIN_VISIBILITY)) return UNTRACKED
  const points = marks.map((m) => [m!.x, m!.y]) as JointReading['points'] & object
  const [a, b, c] = points.map(([x, y]) => [x * aspect, y] as [number, number]) as [[number, number], [number, number], [number, number]]
  const innerDeg = cfg.measure === 'tilt' ? tiltDeg(a, b) : innerAngleDeg(a, b, c)
  return { tracked: true, innerDeg, metricDeg: cfg.metricFromInnerAngle(innerDeg), points }
}
