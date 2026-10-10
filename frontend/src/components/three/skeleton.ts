import { EXERCISE_IDS, EXERCISES, LM, type ExerciseId } from '@arc/dependencies'

/**
 * A whole human body for each exercise, as joints in 3D: an adult of 170 cm in units of 27 cm
 * (6.3 units tall), with limb lengths and joint heights from standard anthropometric ratios
 * (shoulder at 0.82 of height, hip joint at 0.52, knee at 0.28; upper arm 0.19, forearm 0.15,
 * hand 0.11, thigh 0.245, shin 0.245, foot 0.15). +Y is up, the floor is y = 0, and the camera
 * looks down −Z. Each of the fifteen movements poses the body from the reading: the limb (or, for
 * squats, lunges, deadlifts and crunches, the whole body) moves so the tracked joint shows exactly
 * that angle, and the rest holds a natural pose. The tracked landmarks the pose tracker follows
 * are joints of this body, so the overlay (rings, segments, the goniometer arc) sits exactly on
 * it, and the development simulator reads its landmarks from the same pose. Pure maths, tested
 * without WebGL; the scene turns joints into sculpted parts.
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
/** The ankle joint's height when the foot is flat on the floor. */
const ANKLE_Y = HIP_Y - LIMB.thigh - LIMB.shin
/** The foot from the ankle to the toes, in the frame of a shin hanging straight down. */
const FOOT: [number, number] = [0.72, -0.2]

type V2 = [number, number]
type Joints = Record<JointName, V3>

export interface Overlay {
  /** The three tracked landmarks, proximal to distal, in the XY plane of the movement. */
  base: V2
  mid: V2
  end: V2
  /** The joints they sit on (a few bases are a reference line instead: the trunk line, the level). */
  joints: [JointName, JointName, JointName]
  labels: [string, string, string]
  /** Depth of the overlay, in front of the moving limb. */
  z: number
  /**
   * Direction of the moving segment (mid to end) at rest and now, degrees from +X,
   * counter-clockwise. Rest is measured from the base segment as it is now, so the arc stays on
   * the joint when the whole body moves; now is rest plus the reading's sweep, never wrapped.
   */
  restDeg: number
  currentDeg: number
  /** Length of the moving segment, so the goniometer arc can be sized to it. */
  reach: number
}

export interface Skeleton {
  joints: Joints
  /** Side on (the body faces +X) or face on (the body faces the camera). */
  view: 'side' | 'front'
  overlay: Overlay
  /** The stool for the seated exercise. */
  seat?: { top: number; x: [number, number]; z: [number, number] }
}

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const dir = (d: number): V2 => [Math.cos(rad(d)), Math.sin(rad(d))]
const at = (p: V3, d: number, length: number, z = p[2]): V3 => {
  const [c, s] = dir(d)
  return [p[0] + c * length, p[1] + s * length, z]
}
const turn = ([x, y]: V2, d: number): V2 => {
  const [c, s] = dir(d)
  return [x * c - y * s, x * s + y * c]
}
const xy = (p: V3): V2 => [p[0], p[1]]
const angleOf = (from: V2, to: V2) => deg(Math.atan2(to[1] - from[1], to[0] - from[0]))
/** An angle folded into (−180, 180]. */
const wrap = (d: number) => {
  const r = ((d % 360) + 360) % 360
  return r > 180 ? r - 360 : r
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** An arm hanging from `shoulder`: upper arm at `upperDeg`, forearm and hand at `foreDeg`. */
function arm(shoulder: V3, upperDeg: number, foreDeg: number, handDeg = foreDeg, zs: [number, number, number] = [shoulder[2], shoulder[2], shoulder[2]]): [V3, V3, V3] {
  const elbow = at(shoulder, upperDeg, LIMB.upperArm, zs[0])
  const wrist = at(elbow, foreDeg, LIMB.forearm, zs[1])
  const tip = at(wrist, handDeg, LIMB.hand, zs[2])
  return [elbow, wrist, tip]
}

/** An arm in 3D: unit directions for the upper arm and for the forearm and hand. */
function arm3(shoulder: V3, upper: V3, fore: V3): [V3, V3, V3] {
  const go = (p: V3, d: V3, l: number): V3 => [p[0] + d[0] * l, p[1] + d[1] * l, p[2] + d[2] * l]
  const elbow = go(shoulder, upper, LIMB.upperArm)
  const wrist = go(elbow, fore, LIMB.forearm)
  return [elbow, wrist, go(wrist, fore, LIMB.hand)]
}
const unit = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}

/** A leg from `hip`: thigh at `thighDeg`, shin at `shinDeg`, the foot square to the shin. */
function leg(hip: V3, thighDeg: number, shinDeg: number, toeZ = hip[2]): [V3, V3, V3] {
  const knee = at(hip, thighDeg, LIMB.thigh)
  const ankle = at(knee, shinDeg, LIMB.shin)
  const [fx, fy] = turn(FOOT, shinDeg + 90)
  return [knee, ankle, [ankle[0] + fx, ankle[1] + fy, toeZ]]
}

/** A foot flat on the floor at `ankle`, toes forward (+X). */
const toeOf = (ankle: V3): V3 => [ankle[0] + FOOT[0], ankle[1] + FOOT[1], ankle[2]]

/**
 * The knee of a leg from `hip` to `ankle`, bending forward (toward +X): the two-link solution
 * with thigh and shin at their own lengths.
 */
function kneeBetween(hip: V3, ankle: V3): V3 {
  const d = Math.min(LIMB.thigh + LIMB.shin - 1e-9, Math.hypot(ankle[0] - hip[0], ankle[1] - hip[1]))
  const toAnkle = angleOf(xy(hip), xy(ankle))
  const spread = deg(Math.acos((LIMB.thigh ** 2 + d ** 2 - LIMB.shin ** 2) / (2 * LIMB.thigh * d)))
  const a = at(hip, toAnkle + spread, LIMB.thigh)
  const b = at(hip, toAnkle - spread, LIMB.thigh)
  return a[0] >= b[0] ? a : b
}

/** Standing legs, side on: both feet flat under the hips. */
function standingLegs(): Pick<Joints, 'rHip' | 'lHip' | 'rKnee' | 'lKnee' | 'rAnkle' | 'lAnkle' | 'rToe' | 'lToe'> {
  const rHip: V3 = [0, HIP_Y, HIP_HALF]
  const lHip: V3 = [0, HIP_Y, -HIP_HALF]
  const [rKnee, rAnkle, rToe] = leg(rHip, -90, -90)
  const [lKnee, lAnkle, lToe] = leg(lHip, -90, -90)
  return { rHip, lHip, rKnee, lKnee, rAnkle, lAnkle, rToe, lToe }
}

/** Standing legs, face on: the feet point at the camera. */
function frontLegs(): Pick<Joints, 'rHip' | 'lHip' | 'rKnee' | 'lKnee' | 'rAnkle' | 'lAnkle' | 'rToe' | 'lToe'> {
  const rHip: V3 = [-HIP_HALF, HIP_Y, 0]
  const lHip: V3 = [HIP_HALF, HIP_Y, 0]
  const foot = (hip: V3): [V3, V3, V3] => {
    const knee = at(hip, -90, LIMB.thigh)
    const ankle = at(knee, -90, LIMB.shin)
    return [knee, ankle, [ankle[0] + Math.sign(hip[0]) * 0.04, ankle[1] + FOOT[1], ankle[2] + FOOT[0]]]
  }
  const [rKnee, rAnkle, rToe] = foot(rHip)
  const [lKnee, lAnkle, lToe] = foot(lHip)
  return { rHip, lHip, rKnee, lKnee, rAnkle, lAnkle, rToe, lToe }
}

type TrunkJoints = Pick<Joints, 'pelvis' | 'neck' | 'headBase' | 'headTop' | 'rShoulder' | 'lShoulder'>

/**
 * The trunk and head as one rigid piece pivoting at the hip centre `hip`, pointing `trunkDeg`
 * (90 is upright; side on, less leans forward). Face on, the shoulders sit across the trunk.
 */
function trunk(view: 'side' | 'front', hip: V2, trunkDeg: number): TrunkJoints {
  const put = (p: V2, z = 0): V3 => {
    const [x, y] = turn(p, trunkDeg - 90)
    return [hip[0] + x, hip[1] + y, z]
  }
  const lean = view === 'side' ? 1 : 0 // the head sits a little forward, seen side on
  return {
    pelvis: put([0, 0.15]),
    neck: put([0.02 * lean, 1.9]),
    headBase: put([0.04 * lean, 2.13]),
    headTop: put([0.06 * lean, 2.95]),
    rShoulder: view === 'side' ? put([0, 1.8], SHOULDER_HALF) : put([-SHOULDER_HALF, 1.8]),
    lShoulder: view === 'side' ? put([0, 1.8], -SHOULDER_HALF) : put([SHOULDER_HALF, 1.8]),
  }
}

/** What a movement's pose function returns; `skeletonFor` adds the goniometer's directions. */
interface Pose {
  joints: Joints
  view: 'side' | 'front'
  track: [JointName, JointName, JointName]
  labels: [string, string, string]
  z: number
  reach: number
  /** A reference point instead of the first tracked joint (the trunk line, the level). */
  base?: V2
  seat?: Skeleton['seat']
}

/** The value of `t` in [lo, hi] at which `f(t)` (monotonic) equals `target`, by bisection. */
function solve(f: (t: number) => number, target: number, lo: number, hi: number): number {
  const rising = f(hi) > f(lo)
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (f(mid) < target === rising) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
const innerAt = (a: V2, b: V2, c: V2) => {
  const u = [a[0] - b[0], a[1] - b[1]]
  const v = [c[0] - b[0], c[1] - b[1]]
  const cos = (u[0]! * v[0]! + u[1]! * v[1]!) / (Math.hypot(u[0]!, u[1]!) * Math.hypot(v[0]!, v[1]!))
  return deg(Math.acos(Math.max(-1, Math.min(1, cos))))
}

const ARM_RING: Pick<Pose, 'labels' | 'z' | 'reach'> = { labels: ['shoulder', 'elbow', 'wrist'], z: SHOULDER_HALF + 0.42, reach: LIMB.forearm }

/** Side on, standing, the right arm doing the work at the elbow; the forearm points `foreDeg`. */
function sideElbow(foreDeg: number): Pose {
  const t = trunk('side', [0, HIP_Y], 90)
  const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -90, foreDeg)
  const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, -90, -80)
  return { joints: { ...t, ...standingLegs(), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rShoulder', 'rElbow', 'rWrist'], ...ARM_RING }
}

/** Face on, both arms working at the shoulders: upper arm `inner` degrees from the trunk, forearm `foreDeg`. */
function frontShoulders(inner: number, foreDeg: number, both: boolean): Pose {
  const t = trunk('front', [0, HIP_Y], 90)
  const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -90 - inner, foreDeg)
  const [lElbow, lWrist, lFingertip] = both ? arm(t.lShoulder, -90 + inner, 180 - foreDeg) : arm(t.lShoulder, -84, -86)
  return {
    joints: { ...t, ...frontLegs(), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip },
    view: 'front',
    track: ['rHip', 'rShoulder', 'rElbow'],
    labels: ['hip', 'shoulder', 'elbow'],
    // The goniometer's fixed arm runs down the side of the trunk from the shoulder to hip level.
    base: [t.rShoulder[0], HIP_Y],
    z: 0.62,
    reach: LIMB.upperArm,
  }
}

/** Side on, both feet planted: the knee bends `knee` degrees, the shin leans `shinLean`, the trunk points `trunkDeg`. */
function plantedLegs(knee: number, shinLean: number): Pick<Joints, 'rHip' | 'lHip' | 'rKnee' | 'lKnee' | 'rAnkle' | 'lAnkle' | 'rToe' | 'lToe'> & { hip: V2; thighDown: number } {
  const shin = 90 - shinLean
  const thighUp = shin + knee // from the knee to the hip
  const ankle: V2 = [0, ANKLE_Y]
  const kneeXY: V2 = [ankle[0] + Math.cos(rad(shin)) * LIMB.shin, ankle[1] + Math.sin(rad(shin)) * LIMB.shin]
  const hip: V2 = [kneeXY[0] + Math.cos(rad(thighUp)) * LIMB.thigh, kneeXY[1] + Math.sin(rad(thighUp)) * LIMB.thigh]
  const side = (z: number) => {
    const a: V3 = [ankle[0], ankle[1], z]
    return { hip: [hip[0], hip[1], z] as V3, knee: [kneeXY[0], kneeXY[1], z] as V3, ankle: a, toe: toeOf(a) }
  }
  const r = side(HIP_HALF)
  const l = side(-HIP_HALF)
  return { rHip: r.hip, lHip: l.hip, rKnee: r.knee, lKnee: l.knee, rAnkle: r.ankle, lAnkle: l.ankle, rToe: r.toe, lToe: l.toe, hip, thighDown: thighUp + 180 }
}

const LEG_RING: Pick<Pose, 'labels' | 'z' | 'reach'> = { labels: ['hip', 'knee', 'ankle'], z: HIP_HALF + 0.55, reach: LIMB.shin }

// ---- the lunge: the hip lowers between a planted front foot and a planted back foot ----
const LUNGE_FRONT: V3 = [1.1, ANKLE_Y, HIP_HALF]
const LUNGE_BACK: V3 = [-2.0, ANKLE_Y, -HIP_HALF]
const LUNGE_HIP_X = -0.45
function lungeAt(hipY: number) {
  const rHip: V3 = [LUNGE_HIP_X, hipY, HIP_HALF]
  const lHip: V3 = [LUNGE_HIP_X, hipY, -HIP_HALF]
  const rKnee = kneeBetween(rHip, LUNGE_FRONT)
  const lKnee = kneeBetween(lHip, LUNGE_BACK)
  const flexion = 180 - innerAt(xy(rHip), xy(rKnee), xy(LUNGE_FRONT))
  return { rHip, lHip, rKnee, lKnee, flexion }
}

// ---- the pec fly: both arms sweep in front of the chest, at shoulder height ----
const FLY_MAX = 100
function flyAt(sweep: number) {
  const t = trunk('front', [0, HIP_Y], 90)
  const upper = (s: number): V3 => [Math.cos(rad(sweep)) * Math.cos(rad(8)) * s, -Math.sin(rad(8)), Math.sin(rad(sweep)) * Math.cos(rad(8))]
  const fore = (s: number): V3 => [Math.cos(rad(sweep + 20)) * Math.cos(rad(22)) * s, -Math.sin(rad(22)), Math.sin(rad(sweep + 20)) * Math.cos(rad(22))]
  const [rElbow, rWrist, rFingertip] = arm3(t.rShoulder, upper(-1), fore(-1))
  const [lElbow, lWrist, lFingertip] = arm3(t.lShoulder, upper(1), fore(1))
  const closed = 180 - innerAt(xy(lWrist), xy(t.lShoulder), xy(rWrist))
  return { joints: { ...t, ...frontLegs(), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, closed }
}

/** Each movement's whole body for a reading `m` (already clamped to the movement's range). */
const POSES: Record<ExerciseId, (m: number) => Pose> = {
  // The forearm swings forward and up from hanging.
  elbow_flexion: (m) => sideElbow(-90 + m),
  // Upper arm at the side, the forearm straightening from bent up to pointing down.
  tricep_extension: (m) => sideElbow(90 - m),
  // Both arms press from elbows at shoulder height to overhead; the forearms stay upright.
  shoulder_press: (m) => frontShoulders(m, lerp(90, 95, (m - 85) / 90), true),
  // The right arm rises out to the body's side, straight.
  shoulder_abduction: (m) => {
    const p = frontShoulders(m, -90 - m, false)
    const [rElbow, rWrist, rFingertip] = arm(p.joints.rShoulder, -90 - m, -90 - m)
    return { ...p, joints: { ...p.joints, rElbow, rWrist, rFingertip } }
  },
  // Side on, the straight right arm rises in front, measured hip, shoulder, wrist.
  front_raise: (m) => {
    const t = trunk('side', [0, HIP_Y], 90)
    const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -90 + m, -90 + m)
    const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, -90, -80)
    return { joints: { ...t, ...standingLegs(), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rHip', 'rShoulder', 'rWrist'], labels: ['hip', 'shoulder', 'wrist'], z: SHOULDER_HALF + 0.42, reach: LIMB.upperArm }
  },
  // Side on, both hands push straight forward at chest height; the elbow opens to `m`.
  chest_press: (m) => {
    const t = trunk('side', [0, HIP_Y], 90)
    const drop = 0.3
    const reachLen = Math.sqrt(LIMB.upperArm ** 2 + LIMB.forearm ** 2 - 2 * LIMB.upperArm * LIMB.forearm * Math.cos(rad(m)))
    const toWrist = deg(Math.atan2(-drop, Math.sqrt(reachLen ** 2 - drop ** 2)))
    const spread = deg(Math.acos((LIMB.upperArm ** 2 + reachLen ** 2 - LIMB.forearm ** 2) / (2 * LIMB.upperArm * reachLen)))
    const press = (shoulder: V3) => {
      const elbow = at(shoulder, toWrist - spread, LIMB.upperArm)
      const wrist: V3 = [shoulder[0] + Math.cos(rad(toWrist)) * reachLen, shoulder[1] + Math.sin(rad(toWrist)) * reachLen, shoulder[2]]
      const fore = angleOf(xy(elbow), xy(wrist))
      return [elbow, wrist, at(wrist, fore, LIMB.hand)] as const
    }
    const [rElbow, rWrist, rFingertip] = press(t.rShoulder)
    const [lElbow, lWrist, lFingertip] = press(t.lShoulder)
    return { joints: { ...t, ...standingLegs(), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rShoulder', 'rElbow', 'rWrist'], ...ARM_RING }
  },
  // Face on: measured at the left shoulder between the two wrists, as the camera app does.
  pec_fly: (m) => {
    const { joints } = flyAt(solve((s) => flyAt(s).closed, m, 0, FLY_MAX))
    return { joints, view: 'front', track: ['lWrist', 'lShoulder', 'rWrist'], labels: ['left wrist', 'left shoulder', 'right wrist'], z: 2.4, reach: LIMB.upperArm }
  },
  // Face on, both elbows pull down from overhead; the hands come to shoulder height.
  lat_pulldown: (m) => {
    const inner = 180 - m
    return frontShoulders(inner, lerp(90, 105, (inner - 50) / 110), true)
  },
  // Side on, hinged forward with soft knees; the right elbow pulls up and back, the forearm hangs.
  bent_over_row: (m) => {
    const legs = plantedLegs(20, 8)
    const t = trunk('side', legs.hip, 30)
    const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -90 - m, -90)
    const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, -88, -88)
    const { hip: _hip, thighDown: _down, ...joints } = legs
    return { joints: { ...t, ...joints, rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rShoulder', 'rElbow', 'rWrist'], ...ARM_RING }
  },
  // Side on: the hips hinge from `m` (the shoulder-hip-knee angle) to standing tall; the knees soften at the bottom.
  deadlift: (m) => {
    const knee = 0.45 * (180 - m)
    const legs = plantedLegs(knee, 0.4 * knee)
    const t = trunk('side', legs.hip, legs.thighDown + m)
    const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -90, -90)
    const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, -90, -90)
    const { hip: _hip, thighDown: _down, ...joints } = legs
    return { joints: { ...t, ...joints, rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rShoulder', 'rHip', 'rKnee'], labels: ['shoulder', 'hip', 'knee'], z: HIP_HALF + 0.55, reach: LIMB.thigh * 0.75 }
  },
  // Side on: the knees bend `m`, the hips sit back, the trunk leans and the arms reach forward to balance.
  squat: (m) => {
    const legs = plantedLegs(m, 0.38 * m)
    const t = trunk('side', legs.hip, 90 - 0.4 * m)
    const reach = Math.min(-5, -90 + 0.8 * m)
    const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, reach, reach)
    const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, reach, reach)
    const { hip: _hip, thighDown: _down, ...joints } = legs
    return { joints: { ...t, ...joints, rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rHip', 'rKnee', 'rAnkle'], ...LEG_RING }
  },
  // Side on, the right foot forward: the hips lower until the front knee bends `m`.
  lunge: (m) => {
    const hipY = solve((y) => lungeAt(y).flexion, m, 1.45, 2.93)
    const { rHip, lHip, rKnee, lKnee } = lungeAt(hipY)
    const t = trunk('side', [LUNGE_HIP_X, hipY], 90)
    const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -90, -80)
    const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, -90, -80)
    const joints = { ...t, rHip, lHip, rKnee, lKnee, rAnkle: LUNGE_FRONT, lAnkle: LUNGE_BACK, rToe: toeOf(LUNGE_FRONT), lToe: toeOf(LUNGE_BACK), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }
    return { joints, view: 'side', track: ['rHip', 'rKnee', 'rAnkle'], ...LEG_RING }
  },
  // Seated on the stool, side on: thighs level, the left shin hanging, the right shin swinging out;
  // the trunk leans back a little and the hands rest on the thighs.
  seated_knee_extension: (m) => {
    const hipY = 1.75
    const rHip: V3 = [0, hipY, HIP_HALF]
    const lHip: V3 = [0, hipY, -HIP_HALF]
    const [rKnee, rAnkle, rToe] = leg(rHip, 0, m - 180)
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
    return { joints, view: 'side', seat: { top: hipY - 0.3, x: [-0.55, 1.05], z: [-0.75, 0.75] }, track: ['rHip', 'rKnee', 'rAnkle'], ...LEG_RING }
  },
  // Lying on the back, side on, legs out with soft knees: the trunk curls up off the floor.
  crunch: (m) => {
    const hip: V2 = [0, 0.4]
    const t = trunk('side', hip, 195 - m)
    const lyingLeg = (z: number) => {
      const h: V3 = [hip[0], hip[1], z]
      const knee = at(h, 15, LIMB.thigh)
      const shin = deg(Math.asin((0.2 - knee[1]) / LIMB.shin))
      const [, ankle, toe] = leg(h, 15, shin)
      return { hip: h, knee, ankle, toe }
    }
    const r = lyingLeg(HIP_HALF)
    const l = lyingLeg(-HIP_HALF)
    const trunkDeg = 195 - m
    // Hands cross on the chest: the upper arm toward the hips, the forearm back up the chest.
    const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, trunkDeg + 205, trunkDeg + 345, trunkDeg + 345, [0.62, 0.5, 0.42])
    const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, trunkDeg + 205, trunkDeg + 345, trunkDeg + 345, [-0.62, -0.5, -0.42])
    const joints = { ...t, rHip: r.hip, lHip: l.hip, rKnee: r.knee, lKnee: l.knee, rAnkle: r.ankle, lAnkle: l.ankle, rToe: r.toe, lToe: l.toe, rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }
    return { joints, view: 'side', track: ['rShoulder', 'rHip', 'rKnee'], labels: ['shoulder', 'hip', 'knee'], z: HIP_HALF + 0.55, reach: LIMB.thigh * 0.75 }
  },
  // Face on: the shoulders lean and turn to the right, `m` degrees off level; the hands stay together in front.
  ab_twist: (m) => {
    const t = trunk('front', [0, HIP_Y], 90 + m)
    const spin = (v: V3): V3 => {
      const [x, y] = turn([v[0], v[1]], m)
      return [x, y, v[2]]
    }
    const [rElbow, rWrist, rFingertip] = arm3(t.rShoulder, spin(unit([0.3, -0.75, 0.6])), spin(unit([0.29, 0.42, 0.86])))
    const [lElbow, lWrist, lFingertip] = arm3(t.lShoulder, spin(unit([-0.3, -0.75, 0.6])), spin(unit([-0.29, 0.42, 0.86])))
    return {
      joints: { ...t, ...frontLegs(), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip },
      view: 'front',
      track: ['rShoulder', 'rShoulder', 'lShoulder'],
      labels: ['level', 'right shoulder', 'left shoulder'],
      // The level: a horizontal line out from the right shoulder.
      base: [t.rShoulder[0] + 2 * SHOULDER_HALF, t.rShoulder[1]],
      z: 1.6,
      reach: SHOULDER_HALF,
    }
  },
}

/** Where each movement starts: the metric in the start position. */
export function restFor(exercise: ExerciseId): number {
  return EXERCISES[exercise].restDeg
}

/** Readings outside what the movement can show are drawn at its rest or its furthest. */
export function clampMetric(exercise: ExerciseId, metricDeg: number): number {
  const { restDeg, maxDeg } = EXERCISES[exercise]
  return Math.min(maxDeg, Math.max(restDeg, metricDeg))
}

function overlayOf(p: Pose): { base: V2; mid: V2; end: V2 } {
  return { base: p.base ?? xy(p.joints[p.track[0]]), mid: xy(p.joints[p.track[1]]), end: xy(p.joints[p.track[2]]) }
}

/** For each movement: the moving segment's direction against the base at rest, and which way it sweeps. */
const SWEEP = Object.fromEntries(
  EXERCISE_IDS.map((e) => {
    const rel = (m: number) => {
      const { base, mid, end } = overlayOf(POSES[e](m))
      return wrap(angleOf(mid, end) - angleOf(mid, base))
    }
    const rest = restFor(e)
    return [e, { restRel: rel(rest), sign: Math.sign(wrap(rel(rest + 1) - rel(rest))) || 1 }]
  }),
) as Record<ExerciseId, { restRel: number; sign: number }>

/** How far the moving segment has swept from rest for a reading, signed the way the movement turns. */
export function sweepFor(exercise: ExerciseId, metricDeg: number): number {
  return SWEEP[exercise].sign * (clampMetric(exercise, metricDeg) - restFor(exercise))
}

export function skeletonFor(exercise: ExerciseId, metricDeg: number): Skeleton {
  const m = clampMetric(exercise, metricDeg)
  const p = POSES[exercise](m)
  const { base, mid, end } = overlayOf(p)
  const restDeg = angleOf(mid, base) + SWEEP[exercise].restRel
  const skeleton: Skeleton = {
    joints: p.joints,
    view: p.view,
    overlay: { base, mid, end, joints: p.track, labels: p.labels, z: p.z, restDeg, currentDeg: restDeg + sweepFor(exercise, m), reach: p.reach },
  }
  if (p.seat) skeleton.seat = p.seat
  return skeleton
}

/** Direction of the moving segment for a reading, for a movement whose base holds still (the three arm and knee classics). */
export function directionFor(exercise: ExerciseId, metricDeg: number): number {
  return skeletonFor(exercise, restFor(exercise)).overlay.restDeg + sweepFor(exercise, metricDeg)
}

/** The MediaPipe landmark each joint stands for, so the simulator reads its landmarks off this body. */
export const LANDMARK_OF: Partial<Record<JointName, number>> = {
  lShoulder: LM.LEFT_SHOULDER,
  rShoulder: LM.RIGHT_SHOULDER,
  lElbow: LM.LEFT_ELBOW,
  rElbow: LM.RIGHT_ELBOW,
  lWrist: LM.LEFT_WRIST,
  rWrist: LM.RIGHT_WRIST,
  lHip: LM.LEFT_HIP,
  rHip: LM.RIGHT_HIP,
  lKnee: LM.LEFT_KNEE,
  rKnee: LM.RIGHT_KNEE,
  lAnkle: LM.LEFT_ANKLE,
  rAnkle: LM.RIGHT_ANKLE,
}

/** Visible height and width of the stage in scene units, with a margin. */
const VIEW_H = 2.55
const VIEW_W = 3.7
/** The thickest part (the head) beyond its joint, so nothing is cut at the edge. */
const MARGIN = 0.45

function computeFraming(exercise: ExerciseId): { scale: number; offset: V3 } {
  const { restDeg, maxDeg } = EXERCISES[exercise]
  let minX = Infinity
  let maxX = -Infinity
  let minY = 0 // the floor is always in the picture
  let maxY = -Infinity
  for (let i = 0; i <= 24; i++) {
    const s = skeletonFor(exercise, restDeg + ((maxDeg - restDeg) * i) / 24)
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
