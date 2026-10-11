import { EXERCISE_IDS, EXERCISES, LM, type ExerciseId } from '@arc/dependencies'
import { BODY_META } from './body/bodyMeta'

/**
 * A whole human body for each exercise, as joints in 3D. The proportions are the body's own:
 * MakeHuman's young adults (`body/bake.mjs`), female, male, or between the two for a profile that
 * has not said, in units of 27 cm, so every joint sits where the mesh bends. +Y is up, the floor
 * is y = 0, and the camera looks down −Z. Each of the fifteen movements poses the body from the
 * reading: the limb (or, for squats, lunges, deadlifts and crunches, the whole body) moves so the
 * tracked joint shows exactly that angle, and the rest holds a natural pose. The tracked landmarks
 * the pose tracker follows are joints of this body, so the overlay (rings, segments, the
 * goniometer arc) sits exactly on it, and the development simulator reads its landmarks from the
 * same pose. Pure maths, tested without WebGL; the scene skins the body onto these joints.
 */
export type V3 = [number, number, number]
type V2 = [number, number]

/** Which body: one of the two sexes, or between them. */
export type FigureKey = 'neutral' | 'female' | 'male'
export const FIGURE_KEYS: readonly FigureKey[] = ['neutral', 'female', 'male']

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
  'rClavicle',
  'lClavicle',
] as const
export type JointName = (typeof JOINT_NAMES)[number]

export type BoneName = 'head' | 'neck' | 'torso' | 'pelvis' | 'rUpperArm' | 'lUpperArm' | 'rForearm' | 'lForearm' | 'rHand' | 'lHand' | 'rThigh' | 'lThigh' | 'rShin' | 'lShin' | 'rFoot' | 'lFoot'

export interface Bone {
  name: BoneName
  from: JointName
  to: JointName
}

/** Every body part as a bone between two joints. The hand's runs from the wrist to the middle knuckle. */
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

type Joints = Record<JointName, V3>
type BakedJoint = keyof (typeof BODY_META.joints)['female']

/** Each figure's joints standing in the bind pose, as the mesh was made; the neutral figure is the mean of the two. */
export function bindJoints(figure: FigureKey): Record<BakedJoint, V3> {
  const { female, male } = BODY_META.joints
  const pick = (name: BakedJoint): V3 => {
    const f = female[name]
    const m = male[name]
    if (figure === 'female') return [f[0], f[1], f[2]]
    if (figure === 'male') return [m[0], m[1], m[2]]
    return [(f[0] + m[0]) / 2, (f[1] + m[1]) / 2, (f[2] + m[2]) / 2]
  }
  return Object.fromEntries((Object.keys(female) as BakedJoint[]).map((n) => [n, pick(n)])) as Record<BakedJoint, V3>
}

/** A figure's proportions, read off its bind pose. */
export interface Proportions {
  /** Shoulder to elbow, elbow to wrist, wrist to the middle knuckle, hip to knee, knee to ankle. */
  limb: { upperArm: number; forearm: number; hand: number; thigh: number; shin: number }
  shoulderHalf: number
  hipHalf: number
  clavicleHalf: number
  /** The hip joints' height standing. */
  hipY: number
  /** Points of the trunk from the hip joints' midpoint: [toward the front, up the trunk]. */
  trunk: Record<'pelvis' | 'neck' | 'headBase' | 'headTop' | 'shoulder' | 'clavicle', V2>
  /** The foot from the ankle to the toes in the frame of a shin hanging straight down: [forward, up]. */
  foot: V2
  /**
   * The hips' height lying flat with the back on the floor and the thigh's depth under its bone
   * sitting, each [skinny, built] (the pose takes the figure's growth between them), and the
   * ankle's height standing.
   */
  room: { lying: [number, number]; seat: [number, number]; ankle: number }
}

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2])

function proportionsOf(figure: FigureKey): Proportions {
  const j = bindJoints(figure)
  const both = (r: [BakedJoint, BakedJoint], l: [BakedJoint, BakedJoint]) => (len3(sub3(j[r[1]], j[r[0]])) + len3(sub3(j[l[1]], j[l[0]]))) / 2
  const hipY = (j.rHip[1] + j.lHip[1]) / 2
  const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  const trunkPoint = (p: V3): V2 => [p[2], p[1] - hipY]
  // The foot in the shin's frame: along the shin (down) and square to it toward the front.
  const shin = sub3(j.rAnkle, j.rKnee)
  const down: V3 = [shin[0] / len3(shin), shin[1] / len3(shin), shin[2] / len3(shin)]
  const forward = sub3([0, 0, 1], [down[0] * down[2], down[1] * down[2], down[2] * down[2]])
  const fl = len3(forward)
  const toe = sub3(j.rToe, j.rAnkle)
  // Measured by the bake on this figure's own skinny and built bodies.
  const room = BODY_META.room[figure]
  return {
    limb: {
      upperArm: both(['rShoulder', 'rElbow'], ['lShoulder', 'lElbow']),
      forearm: both(['rElbow', 'rWrist'], ['lElbow', 'lWrist']),
      hand: both(['rWrist', 'rFingertip'], ['lWrist', 'lFingertip']),
      thigh: both(['rHip', 'rKnee'], ['lHip', 'lKnee']),
      shin: both(['rKnee', 'rAnkle'], ['lKnee', 'lAnkle']),
    },
    shoulderHalf: (j.lShoulder[0] - j.rShoulder[0]) / 2,
    hipHalf: (j.lHip[0] - j.rHip[0]) / 2,
    clavicleHalf: (j.lClavicle[0] - j.rClavicle[0]) / 2,
    hipY,
    trunk: {
      pelvis: trunkPoint(j.pelvis),
      neck: trunkPoint(j.neck),
      headBase: trunkPoint(j.headBase),
      headTop: trunkPoint(j.headTop),
      shoulder: trunkPoint(mid(j.rShoulder, j.lShoulder)),
      clavicle: trunkPoint(mid(j.rClavicle, j.lClavicle)),
    },
    foot: [dot3(toe, forward) / fl, -dot3(toe, down)],
    room: { lying: [room.lying[0]! + 0.02, room.lying[1]! + 0.02], seat: [room.seat[0]!, room.seat[1]!], ankle: (j.rAnkle[1] + j.lAnkle[1]) / 2 + 0.02 },
  }
}

export const PROPORTIONS = Object.fromEntries(FIGURE_KEYS.map((f) => [f, proportionsOf(f)])) as Record<FigureKey, Proportions>

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
  /** Which way the pelvis points up the body when it stays put while the trunk moves (lying for a crunch). */
  pelvisUp?: V3
  /** Face on, how far the trunk turns about the upright, in radians (the ab twist): its front turns with it. */
  twist?: number
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
const unit = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
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
  pelvisUp?: V3
  twist?: number
}

type TrunkJoints = Pick<Joints, 'pelvis' | 'neck' | 'headBase' | 'headTop' | 'rShoulder' | 'lShoulder' | 'rClavicle' | 'lClavicle'>
type LegJoints = Pick<Joints, 'rHip' | 'lHip' | 'rKnee' | 'lKnee' | 'rAnkle' | 'lAnkle' | 'rToe' | 'lToe'>

/** Every movement's pose function for one figure's proportions: the reading `m`, and how built the figure is (`fill`, 0..1). */
function posesFor(P: Proportions): Record<ExerciseId, (m: number, fill: number) => Pose> {
  const { upperArm, forearm, hand, thigh, shin } = P.limb
  /** The ankle joint's height when the legs stand straight and the feet are flat. */
  const ankleY = P.hipY - thigh - shin
  // The movements' own distances (where a lunge's feet land, the stool) were set for a leg of 3.1 units.
  const legK = (thigh + shin) / 3.1
  const armK = (upperArm + forearm) / 2.1
  /** How far the shoulders sit in front of the hips' line, as an angle up the trunk. */
  const shoulderLean = deg(Math.atan2(P.trunk.shoulder[0], P.trunk.shoulder[1]))

  /** An arm hanging from `shoulder`: upper arm at `upperDeg`, forearm and hand at `foreDeg`. */
  function arm(shoulder: V3, upperDeg: number, foreDeg: number, handDeg = foreDeg, zs: [number, number, number] = [shoulder[2], shoulder[2], shoulder[2]]): [V3, V3, V3] {
    const elbow = at(shoulder, upperDeg, upperArm, zs[0])
    const wrist = at(elbow, foreDeg, forearm, zs[1])
    const tip = at(wrist, handDeg, hand, zs[2])
    return [elbow, wrist, tip]
  }

  /** An arm in 3D: unit directions for the upper arm and for the forearm and hand. */
  function arm3(shoulder: V3, up: V3, fore: V3): [V3, V3, V3] {
    const go = (p: V3, d: V3, l: number): V3 => [p[0] + d[0] * l, p[1] + d[1] * l, p[2] + d[2] * l]
    const elbow = go(shoulder, up, upperArm)
    const wrist = go(elbow, fore, forearm)
    return [elbow, wrist, go(wrist, fore, hand)]
  }

  /** A leg from `hip`: thigh at `thighDeg`, shin at `shinDeg`, the foot square to the shin. */
  function leg(hip: V3, thighDeg: number, shinDeg: number, toeZ = hip[2]): [V3, V3, V3] {
    const knee = at(hip, thighDeg, thigh)
    const ankle = at(knee, shinDeg, shin)
    const [fx, fy] = turn(P.foot, shinDeg + 90)
    return [knee, ankle, [ankle[0] + fx, ankle[1] + fy, toeZ]]
  }

  /** A foot flat on the floor at `ankle`, toes forward (+X). */
  const toeOf = (ankle: V3): V3 => [ankle[0] + P.foot[0], ankle[1] + P.foot[1], ankle[2]]

  /** The knee of a leg from `hip` to `ankle`, bending forward (toward +X): the two-link solution. */
  function kneeBetween(hip: V3, ankle: V3): V3 {
    const d = Math.min(thigh + shin - 1e-9, Math.hypot(ankle[0] - hip[0], ankle[1] - hip[1]))
    const toAnkle = angleOf(xy(hip), xy(ankle))
    const spread = deg(Math.acos((thigh ** 2 + d ** 2 - shin ** 2) / (2 * thigh * d)))
    const a = at(hip, toAnkle + spread, thigh)
    const b = at(hip, toAnkle - spread, thigh)
    return a[0] >= b[0] ? a : b
  }

  /** Standing legs, side on: both feet flat under the hips. */
  function standingLegs(): LegJoints {
    const rHip: V3 = [0, P.hipY, P.hipHalf]
    const lHip: V3 = [0, P.hipY, -P.hipHalf]
    const [rKnee, rAnkle, rToe] = leg(rHip, -90, -90)
    const [lKnee, lAnkle, lToe] = leg(lHip, -90, -90)
    return { rHip, lHip, rKnee, lKnee, rAnkle, lAnkle, rToe, lToe }
  }

  /** Standing legs, face on: the feet point at the camera. */
  function frontLegs(): LegJoints {
    const rHip: V3 = [-P.hipHalf, P.hipY, 0]
    const lHip: V3 = [P.hipHalf, P.hipY, 0]
    const foot = (hip: V3): [V3, V3, V3] => {
      const knee = at(hip, -90, thigh)
      const ankle = at(knee, -90, shin)
      return [knee, ankle, [ankle[0] + Math.sign(hip[0]) * 0.04, ankle[1] + P.foot[1], ankle[2] + P.foot[0]]]
    }
    const [rKnee, rAnkle, rToe] = foot(rHip)
    const [lKnee, lAnkle, lToe] = foot(lHip)
    return { rHip, lHip, rKnee, lKnee, rAnkle, lAnkle, rToe, lToe }
  }

  /**
   * The trunk and head as one rigid piece pivoting at the hip joints' midpoint `hip`, pointing
   * `trunkDeg` (90 is upright; side on, less leans forward). Side on the body faces +X and its
   * right side the camera; face on, the shoulders sit across the trunk and the front faces +Z.
   */
  function trunk(view: 'side' | 'front', hip: V2, trunkDeg: number): TrunkJoints {
    const side = view === 'side'
    const put = ([fwd, up]: V2, lat = 0): V3 => {
      const [x, y] = turn(side ? [fwd, up] : [lat, up], trunkDeg - 90)
      return [hip[0] + x, hip[1] + y, side ? -lat : fwd]
    }
    const T = P.trunk
    return {
      pelvis: put(T.pelvis),
      neck: put(T.neck),
      headBase: put(T.headBase),
      headTop: put(T.headTop),
      rShoulder: put(T.shoulder, -P.shoulderHalf),
      lShoulder: put(T.shoulder, P.shoulderHalf),
      rClavicle: put(T.clavicle, -P.clavicleHalf),
      lClavicle: put(T.clavicle, P.clavicleHalf),
    }
  }

  const armRing: Pick<Pose, 'labels' | 'z' | 'reach'> = { labels: ['shoulder', 'elbow', 'wrist'], z: P.shoulderHalf + 0.42, reach: forearm }
  const legRing: Pick<Pose, 'labels' | 'z' | 'reach'> = { labels: ['hip', 'knee', 'ankle'], z: P.hipHalf + 0.55, reach: shin }

  /** Side on, standing, the right arm doing the work at the elbow; the forearm points `foreDeg`. */
  function sideElbow(foreDeg: number): Pose {
    const t = trunk('side', [0, P.hipY], 90)
    const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -90, foreDeg)
    const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, -90, -80)
    return { joints: { ...t, ...standingLegs(), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rShoulder', 'rElbow', 'rWrist'], ...armRing }
  }

  /** Face on, both arms working at the shoulders: upper arm `inner` degrees from the trunk, forearm `foreDeg`. */
  function frontShoulders(inner: number, foreDeg: number, both: boolean): Pose {
    const t = trunk('front', [0, P.hipY], 90)
    const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -90 - inner, foreDeg)
    const [lElbow, lWrist, lFingertip] = both ? arm(t.lShoulder, -90 + inner, 180 - foreDeg) : arm(t.lShoulder, -84, -86)
    return {
      joints: { ...t, ...frontLegs(), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip },
      view: 'front',
      track: ['rHip', 'rShoulder', 'rElbow'],
      labels: ['hip', 'shoulder', 'elbow'],
      // The goniometer's fixed arm runs down the side of the trunk from the shoulder to hip level.
      base: [t.rShoulder[0], P.hipY],
      z: 0.62,
      reach: upperArm,
    }
  }

  /** Side on, both feet planted: the knee bends `knee` degrees, the shin leans `shinLean`. */
  function plantedLegs(knee: number, shinLean: number): LegJoints & { hip: V2; thighDown: number } {
    const shinDeg = 90 - shinLean
    const thighUp = shinDeg + knee // from the knee to the hip
    const ankle: V2 = [0, ankleY]
    const kneeXY: V2 = [ankle[0] + Math.cos(rad(shinDeg)) * shin, ankle[1] + Math.sin(rad(shinDeg)) * shin]
    const hip: V2 = [kneeXY[0] + Math.cos(rad(thighUp)) * thigh, kneeXY[1] + Math.sin(rad(thighUp)) * thigh]
    const side = (z: number) => {
      const a: V3 = [ankle[0], ankle[1], z]
      return { hip: [hip[0], hip[1], z] as V3, knee: [kneeXY[0], kneeXY[1], z] as V3, ankle: a, toe: toeOf(a) }
    }
    const r = side(P.hipHalf)
    const l = side(-P.hipHalf)
    return { rHip: r.hip, lHip: l.hip, rKnee: r.knee, lKnee: l.knee, rAnkle: r.ankle, lAnkle: l.ankle, rToe: r.toe, lToe: l.toe, hip, thighDown: thighUp + 180 }
  }
  const legsOnly = ({ hip: _hip, thighDown: _down, ...joints }: ReturnType<typeof plantedLegs>): LegJoints => joints

  // ---- the lunge: the hip lowers between a planted front foot and a planted back foot ----
  const lungeFront: V3 = [1.1 * legK, ankleY, P.hipHalf]
  const lungeBack: V3 = [-2.0 * legK, ankleY, -P.hipHalf]
  const lungeHipX = -0.45 * legK
  function lungeAt(hipY: number) {
    const rHip: V3 = [lungeHipX, hipY, P.hipHalf]
    const lHip: V3 = [lungeHipX, hipY, -P.hipHalf]
    const rKnee = kneeBetween(rHip, lungeFront)
    const lKnee = kneeBetween(lHip, lungeBack)
    const flexion = 180 - innerAt(xy(rHip), xy(rKnee), xy(lungeFront))
    return { rHip, lHip, rKnee, lKnee, flexion }
  }

  // ---- the pec fly: both arms sweep in front of the chest, at shoulder height ----
  function flyAt(sweep: number) {
    const t = trunk('front', [0, P.hipY], 90)
    // Straight arms all the way: open near level with the shoulders, coming down to chest height as they close.
    const drop = lerp(2, 12, Math.min(1, Math.max(0, sweep / 100)))
    const along = (s: number): V3 => [Math.cos(rad(sweep)) * Math.cos(rad(drop)) * s, -Math.sin(rad(drop)), Math.sin(rad(sweep)) * Math.cos(rad(drop))]
    const [rElbow, rWrist, rFingertip] = arm3(t.rShoulder, along(-1), along(-1))
    const [lElbow, lWrist, lFingertip] = arm3(t.lShoulder, along(1), along(1))
    const closed = 180 - innerAt(xy(lWrist), xy(t.lShoulder), xy(rWrist))
    return { joints: { ...t, ...frontLegs(), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, closed }
  }
  // The sweep ends where the hands meet, on the body's middle line in front of the chest: never
  // past it, crossing the arms.
  const FLY_MAX = solve((s) => flyAt(s).joints.lWrist[0], 0, 0, 140)

  return {
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
    // Side on, the straight right arm rises in front, measured hip, shoulder, wrist: it turns `m`
    // forward from the line down to the hip.
    front_raise: (m) => {
      const t = trunk('side', [0, P.hipY], 90)
      const down = angleOf(xy(t.rShoulder), [0, P.hipY])
      const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, down + m, down + m)
      const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, -90, -80)
      return { joints: { ...t, ...standingLegs(), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rHip', 'rShoulder', 'rWrist'], labels: ['hip', 'shoulder', 'wrist'], z: P.shoulderHalf + 0.42, reach: upperArm }
    },
    // Side on, both hands push straight forward at chest height; the elbow opens to `m`.
    chest_press: (m) => {
      const t = trunk('side', [0, P.hipY], 90)
      const drop = 0.3 * armK
      const reachLen = Math.sqrt(upperArm ** 2 + forearm ** 2 - 2 * upperArm * forearm * Math.cos(rad(m)))
      const toWrist = deg(Math.atan2(-drop, Math.sqrt(reachLen ** 2 - drop ** 2)))
      const spread = deg(Math.acos((upperArm ** 2 + reachLen ** 2 - forearm ** 2) / (2 * upperArm * reachLen)))
      const press = (shoulder: V3) => {
        const elbow = at(shoulder, toWrist - spread, upperArm)
        const wrist: V3 = [shoulder[0] + Math.cos(rad(toWrist)) * reachLen, shoulder[1] + Math.sin(rad(toWrist)) * reachLen, shoulder[2]]
        const fore = angleOf(xy(elbow), xy(wrist))
        return [elbow, wrist, at(wrist, fore, hand)] as const
      }
      const [rElbow, rWrist, rFingertip] = press(t.rShoulder)
      const [lElbow, lWrist, lFingertip] = press(t.lShoulder)
      return { joints: { ...t, ...standingLegs(), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rShoulder', 'rElbow', 'rWrist'], ...armRing }
    },
    // Face on: measured at the left shoulder between the two wrists, as the camera app does.
    pec_fly: (m) => {
      // Open wide, then the hands sweep together until they meet in front of the chest.
      const { joints } = flyAt(solve((s) => flyAt(s).closed, m, 0, FLY_MAX))
      return { joints, view: 'front', track: ['lWrist', 'lShoulder', 'rWrist'], labels: ['left wrist', 'left shoulder', 'right wrist'], z: 2.4, reach: upperArm }
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
      // The elbow drives back along the body, the forearm bending toward the hip: the elbow ends
      // level with the back, not raised above it. The bend at the elbow is exactly the reading.
      const back = 0.62 * (m - EXERCISES.bent_over_row.restDeg)
      const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -90 - back, -90 - back + m)
      const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, -88, -88)
      return { joints: { ...t, ...legsOnly(legs), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rShoulder', 'rElbow', 'rWrist'], ...armRing }
    },
    // Side on: the hips hinge from `m` (the shoulder-hip-knee angle) to standing tall; the knees soften at the bottom.
    deadlift: (m) => {
      const knee = 0.45 * (180 - m)
      const legs = plantedLegs(knee, 0.4 * knee)
      const t = trunk('side', legs.hip, legs.thighDown + m + shoulderLean)
      const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -90, -90)
      const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, -90, -90)
      return { joints: { ...t, ...legsOnly(legs), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rShoulder', 'rHip', 'rKnee'], labels: ['shoulder', 'hip', 'knee'], z: P.hipHalf + 0.55, reach: thigh * 0.75 }
    },
    // Side on: the knees bend `m`, the hips sit back, the trunk leans and the arms reach forward to balance.
    squat: (m) => {
      const legs = plantedLegs(m, 0.38 * m)
      const t = trunk('side', legs.hip, 90 - 0.4 * m)
      const reach = Math.min(-5, -90 + 0.8 * m)
      const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, reach, reach)
      const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, reach, reach)
      return { joints: { ...t, ...legsOnly(legs), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }, view: 'side', track: ['rHip', 'rKnee', 'rAnkle'], ...legRing }
    },
    // Side on, the right foot forward: the hips lower until the front knee bends `m`.
    lunge: (m) => {
      const hipY = solve((y) => lungeAt(y).flexion, m, ankleY + 1.2 * legK, ankleY + 2.68 * legK)
      const { rHip, lHip, rKnee, lKnee } = lungeAt(hipY)
      const t = trunk('side', [lungeHipX, hipY], 90)
      const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -90, -80)
      const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, -90, -80)
      const joints = { ...t, rHip, lHip, rKnee, lKnee, rAnkle: lungeFront, lAnkle: lungeBack, rToe: toeOf(lungeFront), lToe: toeOf(lungeBack), rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }
      return { joints, view: 'side', track: ['rHip', 'rKnee', 'rAnkle'], ...legRing }
    },
    // Seated on the stool, side on: thighs level, the left shin hanging with the foot on the floor,
    // the right shin swinging out; the trunk leans back a little and the hands rest on the thighs.
    seated_knee_extension: (m, fill) => {
      const hipY = ankleY + shin
      const rHip: V3 = [0, hipY, P.hipHalf]
      const lHip: V3 = [0, hipY, -P.hipHalf]
      const [rKnee, rAnkle, rToe] = leg(rHip, 0, m - 180)
      const [lKnee, lAnkle, lToe] = leg(lHip, 0, -90)
      const t = trunk('side', [0, hipY], 96)
      const zs: [number, number, number] = [P.shoulderHalf - 0.06, P.hipHalf + 0.11, P.hipHalf + 0.07]
      const [rElbow, rWrist, rFingertip] = arm(t.rShoulder, -80, -30, -15, zs)
      const [lElbow, lWrist, lFingertip] = arm(t.lShoulder, -80, -30, -15, [-zs[0], -zs[1], -zs[2]])
      const joints = { ...t, rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip, rHip, lHip, rKnee, lKnee, rAnkle, lAnkle, rToe, lToe }
      const k = thigh / 1.6
      return { joints, view: 'side', seat: { top: hipY - lerp(P.room.seat[0], P.room.seat[1], fill), x: [-0.55 * k, 1.05 * k], z: [-0.75, 0.75] }, track: ['rHip', 'rKnee', 'rAnkle'], ...legRing }
    },
    // Lying on the back, side on, legs out with soft knees: the trunk curls up off the floor. At
    // rest the shoulders lie level with the hips.
    crunch: (m, fill) => {
      const hip: V2 = [0, lerp(P.room.lying[0], P.room.lying[1], fill)]
      const trunkDeg = 195 - m + shoulderLean
      const t = trunk('side', hip, trunkDeg)
      // The heels rest on the floor: the ankle as high as it stands.
      const heel = P.room.ankle
      const lyingLeg = (z: number) => {
        const h: V3 = [hip[0], hip[1], z]
        const knee = at(h, 15, thigh)
        const shinDeg = deg(Math.asin((heel - knee[1]) / shin))
        const [, ankle, toe] = leg(h, 15, shinDeg)
        return { hip: h, knee, ankle, toe }
      }
      const r = lyingLeg(P.hipHalf)
      const l = lyingLeg(-P.hipHalf)
      // Arms crossed on the chest: each upper arm down the side toward the hips, each forearm across
      // the chest to the other shoulder, the left one over the right.
      const across = (fwd: number, up: number, lat: number): V3 => {
        const [x, y] = turn([fwd, up], trunkDeg - 90)
        return unit([x, y, -lat])
      }
      const [rElbow, rWrist, rFingertip] = arm3(t.rShoulder, across(0.3, -0.85, 0.25), across(0.15, 0.28, 0.9))
      const [lElbow, lWrist, lFingertip] = arm3(t.lShoulder, across(0.36, -0.8, -0.25), across(0.26, 0.24, -0.9))
      const joints = { ...t, rHip: r.hip, lHip: l.hip, rKnee: r.knee, lKnee: l.knee, rAnkle: r.ankle, lAnkle: l.ankle, rToe: r.toe, lToe: l.toe, rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }
      // The pelvis stays flat on the floor while the trunk curls up from it.
      const flat = rad(180 + shoulderLean)
      return { joints, view: 'side', track: ['rShoulder', 'rHip', 'rKnee'], labels: ['shoulder', 'hip', 'knee'], z: P.hipHalf + 0.55, reach: thigh * 0.75, pelvisUp: [Math.cos(flat), Math.sin(flat), 0] }
    },
    // Face on: the shoulders lean and turn to the right, `m` degrees off level; the hands stay together in front.
    // A twist down to the side, like a woodchop: the shoulders turn about the upright and lean, the
    // hands together in front. Seen face on, the shoulder line tilts by exactly the reading: the
    // turn foreshortens it, so the lean is what is left of the tilt.
    ab_twist: (m) => {
      const yaw = rad(Math.min(50, 1.5 * m))
      const lean = deg(Math.atan(Math.tan(rad(m)) * Math.cos(yaw)))
      const t = trunk('front', [0, P.hipY], 90 + lean)
      const spin = (v: V3): V3 => {
        const [x, y] = turn([v[0], v[1]], lean)
        return [x, y, v[2]]
      }
      const [rElbow, rWrist, rFingertip] = arm3(t.rShoulder, spin(unit([0.3, -0.75, 0.6])), spin(unit([0.29, 0.42, 0.86])))
      const [lElbow, lWrist, lFingertip] = arm3(t.lShoulder, spin(unit([-0.3, -0.75, 0.6])), spin(unit([-0.29, 0.42, 0.86])))
      // The upper body turns toward the side it leans to: the right shoulder back, the left forward.
      const c = Math.cos(-yaw)
      const sn = Math.sin(-yaw)
      const turned = (p: V3): V3 => [p[0] * c + p[2] * sn, p[1], -p[0] * sn + p[2] * c]
      const upper = { ...t, rElbow, lElbow, rWrist, lWrist, rFingertip, lFingertip }
      const joints = Object.fromEntries(Object.entries(upper).map(([k, p]) => [k, turned(p)])) as typeof upper
      return {
        joints: { ...joints, ...frontLegs() },
        view: 'front',
        twist: -yaw,
        track: ['rShoulder', 'rShoulder', 'lShoulder'],
        labels: ['level', 'right shoulder', 'left shoulder'],
        // The level: a horizontal line out from the right shoulder.
        base: [joints.rShoulder[0] + 2 * P.shoulderHalf, joints.rShoulder[1]],
        z: 1.6,
        reach: P.shoulderHalf,
      }
    },
  }
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

/** Visible height of the stage in scene units, with a margin; the width follows the canvas's shape. */
const VIEW_H = 2.55
/** The stage's usual shape (width over height), and the share of the visible width the body may use. */
const STAGE_ASPECT = 1.45
const WIDTH_SHARE = 0.84
/** The thickest parts (the head, the fingers past the knuckles) beyond their joints, so nothing is cut at the edge. */
const MARGIN = 0.45

/** A figure's poses with what follows from them: each movement's sweep from rest and its framing. */
interface FigurePoses {
  poses: Record<ExerciseId, (m: number, fill: number) => Pose>
  sweep: Record<ExerciseId, { restRel: number; sign: number }>
  /** The box every reading of a movement fills, joints and stool, with a margin. */
  bounds: Partial<Record<ExerciseId, { minX: number; maxX: number; minY: number; maxY: number }>>
}
const FIGURES = new Map<FigureKey, FigurePoses>()
function figurePoses(figure: FigureKey): FigurePoses {
  let f = FIGURES.get(figure)
  if (!f) {
    const poses = posesFor(PROPORTIONS[figure])
    // For each movement: the moving segment's direction against the base at rest, and which way it sweeps.
    const sweep = Object.fromEntries(
      EXERCISE_IDS.map((e) => {
        const rel = (m: number) => {
          const { base, mid, end } = overlayOf(poses[e](m, 0))
          return wrap(angleOf(mid, end) - angleOf(mid, base))
        }
        const rest = restFor(e)
        return [e, { restRel: rel(rest), sign: Math.sign(wrap(rel(rest + 1) - rel(rest))) || 1 }]
      }),
    ) as FigurePoses['sweep']
    f = { poses, sweep, bounds: {} }
    FIGURES.set(figure, f)
  }
  return f
}

/** How far the moving segment has swept from rest for a reading, signed the way the movement turns. */
export function sweepFor(exercise: ExerciseId, metricDeg: number, figure: FigureKey = 'neutral'): number {
  return figurePoses(figure).sweep[exercise].sign * (clampMetric(exercise, metricDeg) - restFor(exercise))
}

/**
 * The body for a reading of a movement: `figure`'s proportions, and `fill` (0 skinny, 1 most built)
 * for how much room the body takes lying on the floor and sitting on the stool.
 */
export function skeletonFor(exercise: ExerciseId, metricDeg: number, figure: FigureKey = 'neutral', fill = 0): Skeleton {
  const f = figurePoses(figure)
  const m = clampMetric(exercise, metricDeg)
  const p = f.poses[exercise](m, Math.min(1, Math.max(0, fill)))
  const { base, mid, end } = overlayOf(p)
  const restDeg = angleOf(mid, base) + f.sweep[exercise].restRel
  const skeleton: Skeleton = {
    joints: p.joints,
    view: p.view,
    overlay: { base, mid, end, joints: p.track, labels: p.labels, z: p.z, restDeg, currentDeg: restDeg + sweepFor(exercise, m, figure), reach: p.reach },
  }
  if (p.seat) skeleton.seat = p.seat
  if (p.pelvisUp) skeleton.pelvisUp = p.pelvisUp
  if (p.twist) skeleton.twist = p.twist
  return skeleton
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

/**
 * The box every reading of a movement fills for a figure (or just one reading, `at`): its joints and
 * the stool, with a margin for the flesh beyond them.
 */
function boundsOf(exercise: ExerciseId, figure: FigureKey, at?: number) {
  const f = figurePoses(figure)
  const known = at == null ? f.bounds[exercise] : undefined
  if (known) return known
  const { restDeg, maxDeg } = at == null ? EXERCISES[exercise] : { restDeg: at, maxDeg: at }
  let minX = Infinity
  let maxX = -Infinity
  let minY = 0 // the floor is always in the picture
  let maxY = -Infinity
  for (let i = 0; i <= 24; i++) {
    const s = skeletonFor(exercise, restDeg + ((maxDeg - restDeg) * i) / 24, figure)
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
  const box = { minX: minX - MARGIN, maxX: maxX + MARGIN, minY, maxY: maxY + MARGIN * 0.4 }
  if (at == null) f.bounds[exercise] = box
  return box
}

/**
 * How a movement is framed for a figure on a canvas of the given shape (width over height): a scale
 * and an offset that keep every reading's body in view (or one held reading's, `at`), so a narrow
 * phone stage shrinks the figure rather than cutting off a lying crunch's feet.
 */
export function framingFor(exercise: ExerciseId, figure: FigureKey = 'neutral', aspect = STAGE_ASPECT, at?: number): { scale: number; offset: V3 } {
  const b = boundsOf(exercise, figure, at)
  const viewW = (VIEW_H / 0.84) * aspect * WIDTH_SHARE
  const scale = Math.min(VIEW_H / (b.maxY - b.minY), viewW / (b.maxX - b.minX))
  return { scale, offset: [-((b.minX + b.maxX) / 2) * scale, -((b.minY + b.maxY) / 2) * scale, 0] }
}

/** A point of the body as it lands in the scene after framing. */
export function framed(exercise: ExerciseId, p: V3, figure: FigureKey = 'neutral'): V3 {
  const f = framingFor(exercise, figure)
  return [p[0] * f.scale + f.offset[0], p[1] * f.scale + f.offset[1], p[2] * f.scale]
}
