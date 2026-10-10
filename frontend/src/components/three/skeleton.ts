import { EXERCISE_IDS, type ExerciseId } from '@arc/dependencies'

/**
 * A whole human body for each exercise, as joints in 3D: an adult of 170 cm in units of 27 cm
 * (6.3 units tall), with limb lengths and joint heights from standard anthropometric ratios
 * (shoulder at 0.82 of height, hip joint at 0.52, knee at 0.28; upper arm 0.19, forearm 0.15,
 * hand 0.11, thigh 0.245, shin 0.245, foot 0.15). +Y is up, the floor is y = 0, and the camera
 * looks down −Z. Only the exercising limb moves with the reading; the
 * rest of the body holds a natural pose. The tracked landmarks the camera app follows are joints
 * of this body, so the overlay (rings, segments, the goniometer arc) sits exactly on it.
 * Pure maths, tested without WebGL; the scene turns joints into sculpted parts.
 */
export type V3 = [number, number, number]

export const JOINT_NAMES = [
  'pelvis',
  'neck',
  'headBase',
  'headTop',
  'rShoulder',
  'lShoulder',
  'rElbow',
  'lElbow',
  'rWrist',
  'lWrist',
  'rFingertip',
  'lFingertip',
  'rHip',
  'lHip',
  'rKnee',
  'lKnee',
  'rAnkle',
  'lAnkle',
  'rToe',
  'lToe',
] as const
export type JointName = (typeof JOINT_NAMES)[number]

export type BoneName = 'head' | 'neck' | 'torso' | 'pelvis' | 'rUpperArm' | 'lUpperArm' | 'rForearm' | 'lForearm' | 'rHand' | 'lHand' | 'rThigh' | 'lThigh' | 'rShin' | 'lShin' | 'rFoot' | 'lFoot'

export interface Bone {
  name: BoneName
  from: JointName
  to: JointName
}

/** Every body part as a bone between two joints. */
export const BONES: Bone[] = [
  { name: 'pelvis', from: 'rHip', to: 'lHip' },
  { name: 'torso', from: 'pelvis', to: 'neck' },
  { name: 'neck', from: 'neck', to: 'headBase' },
  { name: 'head', from: 'headBase', to: 'headTop' },
  { name: 'rUpperArm', from: 'rShoulder', to: 'rElbow' },
  { name: 'lUpperArm', from: 'lShoulder', to: 'lElbow' },
  { name: 'rForearm', from: 'rElbow', to: 'rWrist' },
  { name: 'lForearm', from: 'lElbow', to: 'lWrist' },
  { name: 'rHand', from: 'rWrist', to: 'rFingertip' },
  { name: 'lHand', from: 'lWrist', to: 'lFingertip' },
  { name: 'rThigh', from: 'rHip', to: 'rKnee' },
  { name: 'lThigh', from: 'lHip', to: 'lKnee' },
  { name: 'rShin', from: 'rKnee', to: 'rAnkle' },
  { name: 'lShin', from: 'lKnee', to: 'lAnkle' },
  { name: 'rFoot', from: 'rAnkle', to: 'rToe' },
  { name: 'lFoot', from: 'lAnkle', to: 'lToe' },
]

/** Adult proportions in body units. */
export const LIMB = { upperArm: 1.1, forearm: 1.0, hand: 0.68, thigh: 1.6, shin: 1.5 }
const SHOULDER_HALF = 0.68
const HIP_HALF = 0.33
const HIP_Y = 3.35
const SHOULDER_Y = 5.15
/** The foot from the ankle to the toes, in the frame of a shin hanging straight down. */
const FOOT: [number, number] = [0.72, -0.2]

export interface Overlay {
  /** The three tracked landmarks, proximal to distal, in the XY plane of the movement. */
  base: [number, number]
  mid: [number, number]
  end: [number, number]
  /** The joints they sit on (the shoulder exercise's base is the trunk line at hip level). */
  joints: [JointName, JointName, JointName]
  labels: [string, string, string]
  /** Depth of the overlay, in front of the moving limb. */
  z: number
  /** Direction of the moving segment at rest and now, degrees from +X, counter-clockwise. */
  restDeg: number
  currentDeg: number
  /** Length of the moving segment, so the goniometer arc can be sized to it. */
  reach: number
}

export interface Skeleton {
  joints: Record<JointName, V3>
  /** Side on (the body faces +X) or face on (the body faces the camera). */
  view: 'side' | 'front'
  overlay: Overlay
  /** The stool for the seated exercise. */
  seat?: { top: number; x: [number, number]; z: [number, number] }
}

const rad = (d: number) => (d * Math.PI) / 180
const dir = (deg: number): [number, number] => [Math.cos(rad(deg)), Math.sin(rad(deg))]
const at = (p: V3, deg: number, length: number, z = p[2]): V3 => {
  const [c, s] = dir(deg)
  return [p[0] + c * length, p[1] + s * length, z]
}
const turn = ([x, y]: [number, number], deg: number): [number, number] => {
  const [c, s] = dir(deg)
  return [x * c - y * s, x * s + y * c]
}

export function clampMetric(exercise: ExerciseId, metricDeg: number): number {
  const [lo, hi] = exercise === 'seated_knee_extension' ? [90, 180] : [0, 180]
  return Math.min(hi, Math.max(lo, metricDeg))
}

/** Direction of the exercising segment for a reading, degrees from +X. */
export function directionFor(exercise: ExerciseId, metricDeg: number): number {
  const m = clampMetric(exercise, metricDeg)
  if (exercise === 'elbow_flexion') return -90 + m // the forearm swings forward and up
  if (exercise === 'shoulder_abduction') return -90 - m // the right arm rises out to the body's side
  return m - 180 // the shin swings from hanging to straight out
}

/** An arm hanging from `shoulder`: upper arm at `upperDeg`, forearm and hand at `foreDeg`. */
function arm(shoulder: V3, upperDeg: number, foreDeg: number, handDeg = foreDeg, zs: [number, number, number] = [shoulder[2], shoulder[2], shoulder[2]]): [V3, V3, V3] {
  const elbow = at(shoulder, upperDeg, LIMB.upperArm, zs[0])
  const wrist = at(elbow, foreDeg, LIMB.forearm, zs[1])
  const tip = at(wrist, handDeg, LIMB.hand, zs[2])
  return [elbow, wrist, tip]
}

/** A leg from `hip`: thigh at `thighDeg`, shin at `shinDeg`, the foot square to the shin. */
function leg(hip: V3, thighDeg: number, shinDeg: number, toeZ = hip[2]): [V3, V3, V3] {
  const knee = at(hip, thighDeg, LIMB.thigh)
  const ankle = at(knee, shinDeg, LIMB.shin)
  const [fx, fy] = turn(FOOT, shinDeg + 90)
  return [knee, ankle, [ankle[0] + fx, ankle[1] + fy, toeZ]]
}

/** The standing trunk and head, seen side on (a slight forward set of the head). */
function standingTrunk(): Pick<Record<JointName, V3>, 'pelvis' | 'neck' | 'headBase' | 'headTop'> {
  return { pelvis: [0, 3.5, 0], neck: [0.02, 5.25, 0], headBase: [0.04, 5.48, 0], headTop: [0.06, 6.3, 0] }
}

export function skeletonFor(exercise: ExerciseId, metricDeg: number): Skeleton {
  const m = clampMetric(exercise, metricDeg)
  const now = directionFor(exercise, m)

  if (exercise === 'elbow_flexion') {
    // Side on: the body faces +X and its right side faces the camera (+Z).
    const rShoulder: V3 = [0, SHOULDER_Y, SHOULDER_HALF]
    const lShoulder: V3 = [0, SHOULDER_Y, -SHOULDER_HALF]
    const [rElbow, rWrist, rFingertip] = arm(rShoulder, -90, now)
    const [lElbow, lWrist, lFingertip] = arm(lShoulder, -90, -80)
    const rHip: V3 = [0, HIP_Y, HIP_HALF]
    const lHip: V3 = [0, HIP_Y, -HIP_HALF]
    const [rKnee, rAnkle, rToe] = leg(rHip, -90, -90)
    const [lKnee, lAnkle, lToe] = leg(lHip, -90, -90)
    const joints = { ...standingTrunk(), rShoulder, lShoulder, rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip, rHip, lHip, rKnee, lKnee, rAnkle, lAnkle, rToe, lToe }
    return {
      joints,
      view: 'side',
      overlay: { base: [rShoulder[0], rShoulder[1]], mid: [rElbow[0], rElbow[1]], end: [rWrist[0], rWrist[1]], joints: ['rShoulder', 'rElbow', 'rWrist'], labels: ['shoulder', 'elbow', 'wrist'], z: SHOULDER_HALF + 0.42, restDeg: -90, currentDeg: now, reach: LIMB.forearm },
    }
  }

  if (exercise === 'shoulder_abduction') {
    // Face on: the body faces the camera, so its right side is on the viewer's left (−X).
    const rShoulder: V3 = [-SHOULDER_HALF, SHOULDER_Y, 0]
    const lShoulder: V3 = [SHOULDER_HALF, SHOULDER_Y, 0]
    const [rElbow, rWrist, rFingertip] = arm(rShoulder, now, now)
    const [lElbow, lWrist, lFingertip] = arm(lShoulder, -84, -86)
    const rHip: V3 = [-HIP_HALF, HIP_Y, 0]
    const lHip: V3 = [HIP_HALF, HIP_Y, 0]
    // Feet point at the camera: the foot runs along +Z.
    const foot = (hip: V3): [V3, V3, V3] => {
      const knee = at(hip, -90, LIMB.thigh)
      const ankle = at(knee, -90, LIMB.shin)
      return [knee, ankle, [ankle[0] + Math.sign(hip[0]) * 0.04, ankle[1] + FOOT[1], ankle[2] + FOOT[0]]]
    }
    const [rKnee, rAnkle, rToe] = foot(rHip)
    const [lKnee, lAnkle, lToe] = foot(lHip)
    const joints = { pelvis: [0, 3.5, 0] as V3, neck: [0, 5.25, 0] as V3, headBase: [0, 5.48, 0] as V3, headTop: [0, 6.3, 0] as V3, rShoulder, lShoulder, rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip, rHip, lHip, rKnee, lKnee, rAnkle, lAnkle, rToe, lToe }
    return {
      joints,
      view: 'front',
      overlay: { base: [rShoulder[0], HIP_Y], mid: [rShoulder[0], rShoulder[1]], end: [rElbow[0], rElbow[1]], joints: ['rHip', 'rShoulder', 'rElbow'], labels: ['hip', 'shoulder', 'elbow'], z: 0.62, restDeg: -90, currentDeg: now, reach: LIMB.upperArm },
    }
  }

  // Seated knee extension, side on: thighs level on the stool, the left shin hanging, the right
  // shin swinging out; the trunk leans back a little and the hands rest on the thighs.
  const hipY = 1.75
  const rHip: V3 = [0, hipY, HIP_HALF]
  const lHip: V3 = [0, hipY, -HIP_HALF]
  const [rKnee, rAnkle, rToe] = leg(rHip, 0, now)
  const [lKnee, lAnkle, lToe] = leg(lHip, 0, -90)
  const lean = 96 // the trunk's direction, a little past vertical
  const pelvis: V3 = [-0.05, 1.9, 0]
  const neck = at(pelvis, lean, 1.75)
  const headBase = at(neck, lean - 4, 0.23)
  const headTop = at(headBase, lean - 6, 0.82)
  const shoulderAt = at(pelvis, lean, 1.65)
  const rShoulder: V3 = [shoulderAt[0], shoulderAt[1], SHOULDER_HALF]
  const lShoulder: V3 = [shoulderAt[0], shoulderAt[1], -SHOULDER_HALF]
  const [rElbow, rWrist, rFingertip] = arm(rShoulder, -80, -25, -8, [0.6, 0.46, 0.42])
  const [lElbow, lWrist, lFingertip] = arm(lShoulder, -80, -25, -8, [-0.6, -0.46, -0.42])
  const joints = { pelvis, neck, headBase, headTop, rShoulder, lShoulder, rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip, rHip, lHip, rKnee, lKnee, rAnkle, lAnkle, rToe, lToe }
  return {
    joints,
    view: 'side',
    seat: { top: hipY - 0.3, x: [-0.55, 1.05], z: [-0.75, 0.75] },
    overlay: { base: [rHip[0], rHip[1]], mid: [rKnee[0], rKnee[1]], end: [rAnkle[0], rAnkle[1]], joints: ['rHip', 'rKnee', 'rAnkle'], labels: ['hip', 'knee', 'ankle'], z: HIP_HALF + 0.55, restDeg: -90, currentDeg: now, reach: LIMB.shin },
  }
}

/** Visible height and width of the stage in scene units, with a margin. */
const VIEW_H = 2.55
const VIEW_W = 3.7
/** The thickest part (the head) beyond its joint, so nothing is cut at the edge. */
const MARGIN = 0.45

function computeFraming(exercise: ExerciseId): { scale: number; offset: V3 } {
  const [lo, hi] = exercise === 'seated_knee_extension' ? [90, 180] : [0, 180]
  let minX = Infinity
  let maxX = -Infinity
  let minY = 0 // the floor is always in the picture
  let maxY = -Infinity
  for (let m = lo; m <= hi; m += 5) {
    const s = skeletonFor(exercise, m)
    for (const p of Object.values(s.joints)) {
      minX = Math.min(minX, p[0])
      maxX = Math.max(maxX, p[0])
      minY = Math.min(minY, p[1])
      maxY = Math.max(maxY, p[1])
    }
    if (s.seat) {
      minX = Math.min(minX, s.seat.x[0])
      maxX = Math.max(maxX, s.seat.x[1])
    }
  }
  minX -= MARGIN
  maxX += MARGIN
  maxY += MARGIN * 0.4
  const scale = Math.min(VIEW_H / (maxY - minY), VIEW_W / (maxX - minX))
  return { scale, offset: [-((minX + maxX) / 2) * scale, -((minY + maxY) / 2) * scale, 0] }
}

/** How each exercise is framed: a scale and an offset that keep every reading's body in view. */
export const FRAMING = Object.fromEntries(EXERCISE_IDS.map((e) => [e, computeFraming(e)])) as Record<ExerciseId, { scale: number; offset: V3 }>

/** A point of the body as it lands in the scene after framing. */
export function framed(exercise: ExerciseId, p: V3): V3 {
  const f = FRAMING[exercise]
  return [p[0] * f.scale + f.offset[0], p[1] * f.scale + f.offset[1], p[2] * f.scale]
}
