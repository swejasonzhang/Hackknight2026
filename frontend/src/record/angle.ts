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
  /** The side read: the chosen one, or for a movement with no side, whichever the camera sees. */
  side: Side
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

/** The angle at `b` between the segments to `a` and `c` in space, in degrees (0..180). */
export function innerAngle3Deg(a: readonly [number, number, number], b: readonly [number, number, number], c: readonly [number, number, number]): number {
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]]
  const cos = (u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!) / (Math.hypot(u[0]!, u[1]!, u[2]!) * Math.hypot(v[0]!, v[1]!, v[2]!))
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}

/** How far the line from `a` to `b` slopes off the level, either way, in degrees (0..90). */
export function tiltDeg(a: [number, number], b: [number, number]): number {
  const slope = Math.abs((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI)
  return slope > 90 ? 180 - slope : slope
}

const untracked = (side: Side): JointReading => ({ tracked: false, metricDeg: 0, innerDeg: 0, points: null, side })
/** A movement with no side changes to the other side only when the camera sees it this much better. */
const SWITCH_MARGIN = 0.15

/** How well the model sees a side's three landmarks: the least visible of them. */
function seen(landmarks: readonly Landmark[], exercise: ExerciseId, side: Side): number {
  return Math.min(...EXERCISES[exercise].joints[side].map((i) => (landmarks[i] ? (landmarks[i].visibility ?? 1) : 0)))
}

/**
 * The exercise's joint, read from a pose: the landmarks named in the exercise config for the
 * chosen side (MediaPipe names sides from the person's point of view, on the unmirrored frame),
 * and the config's conversion to the metric the rep counter and dashboard use.
 *
 * The angle is measured in space from the model's world landmarks (`world`, in metres) when it
 * gives them, so a curl done facing the camera reads true: on the flat picture the forearm coming
 * toward the lens shortens to a stub and its angle swings wildly. Without them it is measured on
 * the real picture (`aspect` = video width / height, since x and y are both 0..1). A tilt (the ab
 * twist's shoulder line against the level) and a reading across the body (the pec fly's wrists
 * through a shoulder) are always measured on the picture, as the camera app defines them.
 *
 * A movement with no side to pick (a squat, a deadlift) is read on whichever side the camera sees
 * better. `prefer` is the side read last time: it is kept until the other is seen clearly better,
 * so the reading does not flick between the two sides frame by frame.
 */
export function readJoint(landmarks: readonly Landmark[] | null | undefined, exercise: ExerciseId, chosen: Side, aspect = 1, world?: readonly Landmark[] | null, prefer?: Side): JointReading {
  const cfg = EXERCISES[exercise]
  const current = cfg.sided ? chosen : (prefer ?? chosen)
  if (!landmarks) return untracked(current)
  const other: Side = current === 'right' ? 'left' : 'right'
  const side = !cfg.sided && seen(landmarks, exercise, other) > seen(landmarks, exercise, current) + (prefer ? SWITCH_MARGIN : 0) ? other : current
  const indices = cfg.joints[side]
  const marks = indices.map((i) => landmarks[i])
  if (marks.some((m) => !m || (m.visibility ?? 1) < MIN_VISIBILITY)) return untracked(side)
  const points = marks.map((m) => [m!.x, m!.y]) as JointReading['points'] & object
  const [a, b, c] = points.map(([x, y]) => [x * aspect, y] as [number, number]) as [[number, number], [number, number], [number, number]]
  // In space only along one limb (the same side's landmarks): a reading across the body, both
  // wrists through a shoulder (the pec fly), is defined on the picture, as the camera app reads it.
  const oneSide = indices.every((i) => i % 2 === indices[0]! % 2)
  const inSpace = cfg.measure !== 'tilt' && oneSide && world ? indices.map((i) => world[i]) : null
  const innerDeg =
    cfg.measure === 'tilt'
      ? tiltDeg(a, b)
      : inSpace && inSpace.every(Boolean)
        ? innerAngle3Deg(...(inSpace.map((m) => [m!.x, m!.y, m!.z ?? 0] as const) as [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]]))
        : innerAngleDeg(a, b, c)
  return { tracked: true, innerDeg, metricDeg: cfg.metricFromInnerAngle(innerDeg), points, side }
}
