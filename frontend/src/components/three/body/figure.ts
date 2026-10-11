import { EXERCISES, MUSCLE_IDS, type ExerciseId, type MuscleId } from '@arc/dependencies'
import { bindJoints, type FigureKey, type JointName, type Skeleton, type V3 } from '../skeleton'
import { BODY_META } from './bodyMeta'

/*
 * The body itself: MakeHuman's young adult (CC0), baked by scripts/body/bake.mjs into body.bin.
 * This module turns it into what the scene draws, with no WebGL, so all of it is tested:
 *
 * - the shape: each sex's skinny, untrained body plus the offset to its most built, taken per
 *   vertex as far as the muscle group under it has grown;
 * - the skin: Arc's bones and three helpers per side, each vertex weighted to up to four of them,
 *   and the matrix each bone carries from the bind pose to a skeleton's pose;
 * - the paint: the muscles an exercise works (red targets, yellow helpers), the clothes, the eyes.
 */

export type Sex = 'female' | 'male'
export const BONE_NAMES = BODY_META.bones
export type SkinBone = (typeof BONE_NAMES)[number]

export interface BodyAsset {
  vertices: number
  bodyVertices: number
  /** Triangles: the body's first, then the eyes'. */
  index: Uint16Array
  bodyTriangles: number
  /** Per sex: the skinny, untrained positions, and the offset to the most built. */
  shapes: Record<Sex, { skinny: Float32Array; growth: Float32Array }>
  /** Four bones and their weights (adding to 1) per vertex. */
  skinIndex: Uint8Array
  skinWeight: Float32Array
  /** Up to three muscle groups per vertex (255 for none) and how much of the vertex each is. */
  maskIndex: Uint8Array
  maskWeight: Float32Array
  /** 0..1 per vertex: covered by the shorts, by the sports top. */
  shorts: Float32Array
  top: Float32Array
}

type Section = (typeof BODY_META.sections)[number]
const section = (name: string): Section => {
  const s = BODY_META.sections.find((x) => x.name === name)
  if (!s) throw new Error(`body.bin has no ${name}`)
  return s
}

/** Reads body.bin (as the bake wrote it) into typed arrays. */
export function decodeBody(buffer: ArrayBuffer): BodyAsset {
  const V = BODY_META.vertices
  const view = <T>(name: string, Make: new (b: ArrayBuffer, o: number, l: number) => T): T => {
    const s = section(name)
    return new Make(buffer, s.offset, s.length)
  }
  const shapes = {} as BodyAsset['shapes']
  for (const sex of ['female', 'male'] as const) {
    const box = section(`${sex}.skinny`) as Section & { min: number[]; max: number[] }
    const q = view(`${sex}.skinny`, Int16Array)
    const skinny = new Float32Array(V * 3)
    for (let i = 0; i < q.length; i++) {
      const k = i % 3
      skinny[i] = ((q[i]! + 32768) / 65535) * (box.max[k]! - box.min[k]!) + box.min[k]!
    }
    const step = (section(`${sex}.growth`) as Section & { step: number }).step
    shapes[sex] = { skinny, growth: Float32Array.from(view(`${sex}.growth`, Int16Array), (x) => x * step) }
  }
  const unitBytes = (name: string) => Float32Array.from(view(name, Uint8Array), (x) => x / 255)
  return {
    vertices: V,
    bodyVertices: BODY_META.bodyVertices,
    index: view('index', Uint16Array),
    bodyTriangles: BODY_META.bodyTriangles,
    shapes,
    skinIndex: view('skinIndex', Uint8Array),
    skinWeight: unitBytes('skinWeight'),
    maskIndex: view('maskIndex', Uint8Array),
    maskWeight: unitBytes('maskWeight'),
    shorts: unitBytes('shorts'),
    top: unitBytes('top'),
  }
}

// ---- the shape: skinny to built, muscle group by muscle group ----

/** How far each muscle group has grown (0 untrained, 1 the most the figure shows), and the whole body's level. */
export interface Growth {
  levels: Partial<Record<MuscleId, number>>
  overall: number
}

/** A body a few months into steady training, for the landing page's figures. */
export const DEMO_GROWTH: Growth = { levels: Object.fromEntries(MUSCLE_IDS.map((m) => [m, 0.45])), overall: 0.45 }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/**
 * The figure's positions in its bind pose for a growth: each vertex goes from skinny toward built
 * as far as its groups have grown (where a group lies under it) and as far as the whole body has
 * elsewhere, so the hands, the face and the joints follow the body as a whole and nothing creases
 * at a group's edge.
 */
export function bodyPositions(asset: BodyAsset, figure: FigureKey, growth: Growth | null, out: Float32Array = new Float32Array(asset.vertices * 3)): Float32Array {
  const V = asset.vertices
  const groups = MUSCLE_IDS.map((m) => clamp01(growth?.levels[m] ?? 0))
  const overall = clamp01(growth?.overall ?? 0)
  const sexes: [Sex, number][] = figure === 'neutral' ? [['female', 0.5], ['male', 0.5]] : [[figure, 1]]
  out.fill(0)
  for (let v = 0; v < V; v++) {
    let level = overall
    for (let k = 0; k < 3; k++) {
      const g = asset.maskIndex[v * 3 + k]!
      if (g !== 255) level += asset.maskWeight[v * 3 + k]! * (groups[g]! - overall)
    }
    for (const [sex, share] of sexes) {
      const s = asset.shapes[sex]
      for (let k = 0; k < 3; k++) {
        const i = v * 3 + k
        out[i] = out[i]! + share * (s.skinny[i]! + level * s.growth[i]!)
      }
    }
  }
  return out
}

// ---- the skin: frames for every bone, bind pose and posed ----

type Vec = [number, number, number]
const subV = (a: readonly number[], b: readonly number[]): Vec => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
const dotV = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const crossV = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const lenV = (a: Vec) => Math.hypot(a[0], a[1], a[2])
const unitV = (a: Vec): Vec => {
  const l = lenV(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const scaleV = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k]
/** `v` turned by the rotation that takes unit `from` onto unit `to`; a half turn goes round +Z, as every movement does. */
function carry(from: Vec, to: Vec, v: Vec): Vec {
  const c = dotV(from, to)
  if (c < -0.9999) return [-v[0], -v[1], v[2]]
  const axis = crossV(from, to)
  const s = lenV(axis)
  if (s < 1e-9) return v
  const k = scaleV(axis, 1 / s)
  const kv = crossV(k, v)
  const kd = dotV(k, v) * (1 - c)
  return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd]
}

/** A bone's frame: its origin, +Y along it, +Z its front, +X their cross, and its length. */
export interface Frame {
  o: Vec
  x: Vec
  y: Vec
  z: Vec
  length: number
}
function frame(o: Vec, to: Vec, front: Vec): Frame {
  const d = subV(to, o)
  const y = unitV(d)
  const z = unitV(subV(front, scaleV(y, dotV(front, y))))
  return { o, x: crossV(y, z), y, z, length: lenV(d) }
}

type JointSet = Record<JointName, V3>
const ARM_CHAIN: [SkinBone, JointName, JointName][] = [
  ['rUpperArm', 'rShoulder', 'rElbow'],
  ['lUpperArm', 'lShoulder', 'lElbow'],
  ['rForearm', 'rElbow', 'rWrist'],
  ['lForearm', 'lElbow', 'lWrist'],
  ['rHand', 'rWrist', 'rFingertip'],
  ['lHand', 'lWrist', 'lFingertip'],
]
const LEG_CHAIN: [SkinBone, JointName, JointName][] = [
  ['rThigh', 'rHip', 'rKnee'],
  ['lThigh', 'lHip', 'lKnee'],
  ['rShin', 'rKnee', 'rAnkle'],
  ['lShin', 'lKnee', 'lAnkle'],
]

/**
 * Every main bone's frame for a set of joints, as the scene poses the body: the trunk's front
 * faces +Z face on or along the body side on; an arm's front is the trunk's front carried round
 * from hanging, a leg's the pelvis's; a foot's top faces up when it points forward. The pelvis
 * turns with the trunk side on (a hinge), stays level face on (a twist), and stays where the pose
 * says when it says (flat on the floor for a crunch).
 */
export function frames(pose: Pick<Skeleton, 'joints' | 'view' | 'pelvisUp'>): Partial<Record<SkinBone, Frame>> {
  const j = pose.joints as JointSet
  const side = pose.view === 'side'
  const up = unitV(subV(j.neck, j.pelvis))
  const fwd: Vec = side ? [up[1], -up[0], 0] : [0, 0, 1]
  const pUp: Vec = pose.pelvisUp ? [pose.pelvisUp[0], pose.pelvisUp[1], pose.pelvisUp[2]] : side ? up : [0, 1, 0]
  const pFwd: Vec = side ? [pUp[1], -pUp[0], 0] : [0, 0, 1]
  const hips: Vec = [(j.rHip[0] + j.lHip[0]) / 2, (j.rHip[1] + j.lHip[1]) / 2, (j.rHip[2] + j.lHip[2]) / 2]
  const out: Partial<Record<SkinBone, Frame>> = {
    pelvis: frame(hips, [hips[0] + pUp[0], hips[1] + pUp[1], hips[2] + pUp[2]], pFwd),
    torso: frame(j.pelvis, j.neck, fwd),
    neck: frame(j.neck, j.headBase, fwd),
    head: frame(j.headBase, j.headTop, fwd),
    rClavicle: frame(j.rClavicle, j.rShoulder, fwd),
    lClavicle: frame(j.lClavicle, j.lShoulder, fwd),
  }
  out.pelvis!.length = 1
  for (const [bone, a, b] of ARM_CHAIN) out[bone] = frame(j[a], j[b], carry(scaleV(up, -1), unitV(subV(j[b], j[a])), fwd))
  for (const [bone, a, b] of LEG_CHAIN) out[bone] = frame(j[a], j[b], carry(scaleV(pUp, -1), unitV(subV(j[b], j[a])), pFwd))
  for (const [bone, a, b] of [['rFoot', 'rAnkle', 'rToe'], ['lFoot', 'lAnkle', 'lToe']] as [SkinBone, JointName, JointName][]) {
    out[bone] = frame(j[a], j[b], carry(pFwd, unitV(subV(j[b], j[a])), pUp))
  }
  return out
}

/** A 4x4 column-major matrix (three.js's layout). */
export type Mat4 = Float32Array

/** The matrix that takes a point in `from`'s frame to the same place in `to`'s, stretched along the bone to its length. */
function carryFrame(from: Frame, to: Frame, stretch: boolean): Mat4 {
  const k = stretch && from.length > 0 ? to.length / from.length : 1
  // M = [to.x, to.y·k, to.z | to.o] · [from.x, from.y, from.z | from.o]^-1
  const A = [to.x, scaleV(to.y, k), to.z]
  const B = [from.x, from.y, from.z]
  const m = new Float32Array(16)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) m[c * 4 + r] = A[0]![r]! * B[0]![c]! + A[1]![r]! * B[1]![c]! + A[2]![r]! * B[2]![c]!
  }
  // Translation: to.o − R·from.o
  for (let r = 0; r < 3; r++) m[12 + r] = to.o[r]! - (m[r]! * from.o[0] + m[4 + r]! * from.o[1] + m[8 + r]! * from.o[2])
  m[15] = 1
  return m
}

/** A rotation as a quaternion [x, y, z, w] from a matrix's upper 3x3 (orthonormal). */
function quatOf(m: Mat4): [number, number, number, number] {
  const [m00, m10, m20, , m01, m11, m21, , m02, m12, m22] = m as unknown as number[]
  const tr = m00! + m11! + m22!
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1)
    return [(m21! - m12!) * s, (m02! - m20!) * s, (m10! - m01!) * s, 0.25 / s]
  }
  if (m00! > m11! && m00! > m22!) {
    const s = 2 * Math.sqrt(1 + m00! - m11! - m22!)
    return [0.25 * s, (m01! + m10!) / s, (m02! + m20!) / s, (m21! - m12!) / s]
  }
  if (m11! > m22!) {
    const s = 2 * Math.sqrt(1 + m11! - m00! - m22!)
    return [(m01! + m10!) / s, 0.25 * s, (m12! + m21!) / s, (m02! - m20!) / s]
  }
  const s = 2 * Math.sqrt(1 + m22! - m00! - m11!)
  return [(m02! + m20!) / s, (m12! + m21!) / s, 0.25 * s, (m10! - m01!) / s]
}
function slerp(a: number[], b: number[], t: number): number[] {
  let d = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]! + a[3]! * b[3]!
  const bb = d < 0 ? b.map((x) => -x) : b
  d = Math.abs(d)
  if (d > 0.9995) {
    const r = a.map((x, i) => x + (bb[i]! - x) * t)
    const l = Math.hypot(...r)
    return r.map((x) => x / l)
  }
  const th = Math.acos(d)
  const s = Math.sin(th)
  return a.map((x, i) => (x * Math.sin((1 - t) * th) + bb[i]! * Math.sin(t * th)) / s)
}

/**
 * A helper bone between two others at their shared joint (the deltoid between the trunk and the
 * upper arm, the glute between the pelvis and the thigh): it turns part of the way from one to the
 * other, so the flesh over a big joint folds smoothly instead of collapsing.
 */
function between(a: Mat4, b: Mat4, joint: Vec, share: number): Mat4 {
  const [x, y, z, w] = slerp(quatOf(a), quatOf(b), share) as [number, number, number, number]
  const m = new Float32Array(16)
  m[0] = 1 - 2 * (y * y + z * z)
  m[1] = 2 * (x * y + z * w)
  m[2] = 2 * (x * z - y * w)
  m[4] = 2 * (x * y - z * w)
  m[5] = 1 - 2 * (x * x + z * z)
  m[6] = 2 * (y * z + x * w)
  m[8] = 2 * (x * z + y * w)
  m[9] = 2 * (y * z - x * w)
  m[10] = 1 - 2 * (x * x + y * y)
  m[15] = 1
  // The joint lands where the second bone puts it.
  const target = applyMat(b, joint)
  for (let r = 0; r < 3; r++) m[12 + r] = target[r]! - (m[r]! * joint[0] + m[4 + r]! * joint[1] + m[8 + r]! * joint[2])
  return m
}

export function applyMat(m: Mat4, p: readonly number[]): Vec {
  return [m[0]! * p[0]! + m[4]! * p[1]! + m[8]! * p[2]! + m[12]!, m[1]! * p[0]! + m[5]! * p[1]! + m[9]! * p[2]! + m[13]!, m[2]! * p[0]! + m[6]! * p[1]! + m[10]! * p[2]! + m[14]!]
}

/** Each figure's bind-pose frames, worked out once. */
const BIND = new Map<FigureKey, { frames: Partial<Record<SkinBone, Frame>>; joints: JointSet }>()
export function bindFrames(figure: FigureKey) {
  let b = BIND.get(figure)
  if (!b) {
    const joints = bindJoints(figure) as JointSet
    b = { frames: frames({ joints, view: 'front' }), joints }
    BIND.set(figure, b)
  }
  return b
}

/** How far the helpers turn: the deltoid half way to the upper arm, the glute a third of the way to the thigh. */
const HELPERS: { bone: SkinBone; from: SkinBone; to: SkinBone; joint: JointName; share: number }[] = [
  { bone: 'rDeltoid', from: 'rClavicle', to: 'rUpperArm', joint: 'rShoulder', share: 0.5 },
  { bone: 'lDeltoid', from: 'lClavicle', to: 'lUpperArm', joint: 'lShoulder', share: 0.5 },
  { bone: 'rGlute', from: 'pelvis', to: 'rThigh', joint: 'rHip', share: 0.35 },
  { bone: 'lGlute', from: 'pelvis', to: 'lThigh', joint: 'lHip', share: 0.35 },
]

/**
 * The skin matrix of every bone (in BONE_NAMES order) for a pose: what carries a point of the
 * figure's bind pose to where that pose puts it. The scene hands these to the GPU; the tests skin
 * on the CPU with the same numbers.
 */
export function skinMatrices(figure: FigureKey, pose: Pick<Skeleton, 'joints' | 'view' | 'pelvisUp'>): Mat4[] {
  const bind = bindFrames(figure)
  const now = frames(pose)
  const out = new Map<SkinBone, Mat4>()
  for (const name of BONE_NAMES) {
    const b = bind.frames[name]
    const n = now[name]
    if (b && n) out.set(name, carryFrame(b, n, name !== 'pelvis' && name !== 'neck'))
  }
  for (const h of HELPERS) out.set(h.bone, between(out.get(h.from)!, out.get(h.to)!, bind.joints[h.joint] as unknown as Vec, h.share))
  return BONE_NAMES.map((name) => out.get(name)!)
}

/** Linear blend skinning on the CPU: the same sum the GPU does. */
export function skin(asset: BodyAsset, positions: Float32Array, matrices: Mat4[], out: Float32Array = new Float32Array(positions.length)): Float32Array {
  for (let v = 0; v < asset.vertices; v++) {
    const p = [positions[v * 3]!, positions[v * 3 + 1]!, positions[v * 3 + 2]!]
    let x = 0
    let y = 0
    let z = 0
    for (let k = 0; k < 4; k++) {
      const w = asset.skinWeight[v * 4 + k]!
      if (!w) continue
      const q = applyMat(matrices[asset.skinIndex[v * 4 + k]!]!, p)
      x += q[0] * w
      y += q[1] * w
      z += q[2] * w
    }
    out[v * 3] = x
    out[v * 3 + 1] = y
    out[v * 3 + 2] = z
  }
  return out
}

// ---- the paint ----

/** Muscles down the body's midline, worked on both sides even by a one-sided exercise. */
const MIDLINE: ReadonlySet<MuscleId> = new Set(['abs', 'lower_back'])
const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}

/**
 * How hard an exercise works each vertex: `primary` (the target, red) and `secondary` (helping or
 * holding steady, yellow), each 0..1. The figure always works on its right side (−X in the bind
 * pose), so a one-sided exercise lights only the right limb and the right half of the trunk, apart
 * from the muscles down the middle.
 */
export function muscleLoad(asset: BodyAsset, positions: Float32Array, exercise: ExerciseId): { primary: Float32Array; secondary: Float32Array } {
  const V = asset.vertices
  const primary = new Float32Array(V)
  const secondary = new Float32Array(V)
  const { sided, muscles } = EXERCISES[exercise]
  const role = new Map<number, 'primary' | 'secondary'>()
  muscles.secondary.forEach((m) => role.set(MUSCLE_IDS.indexOf(m), 'secondary'))
  muscles.primary.forEach((m) => role.set(MUSCLE_IDS.indexOf(m), 'primary'))
  for (let v = 0; v < asset.bodyVertices; v++) {
    const right = smooth(-0.05, 0.05, -positions[v * 3]!)
    for (let k = 0; k < 3; k++) {
      const g = asset.maskIndex[v * 3 + k]!
      const r = role.get(g)
      if (!r) continue
      const w = asset.maskWeight[v * 3 + k]! * (sided && !MIDLINE.has(MUSCLE_IDS[g]!) ? right : 1)
      const into = r === 'primary' ? primary : secondary
      into[v] = Math.min(1, into[v]! + w)
    }
  }
  return { primary, secondary }
}

/** Muscles on the back of the body: an exercise that mostly targets these turns its back toward the camera. */
const BEHIND: ReadonlySet<MuscleId> = new Set(['rear_delts', 'triceps', 'traps', 'upper_back', 'lats', 'lower_back', 'glutes', 'hamstrings', 'calves'])

/** Which way the figure faces before it sways, as a turn about the vertical: three-quarters from the front, or turned to show the back. */
export function facingFor(exercise: ExerciseId): number {
  const { primary } = EXERCISES[exercise].muscles
  return primary.filter((m) => BEHIND.has(m)).length * 2 > primary.length ? 0.6 : -0.2
}

/** Whether a figure wears the sports top: the female figure, and the one between the sexes. */
export const wearsTop = (figure: FigureKey) => figure !== 'male'

export type Rgb = [number, number, number]
export interface Palette {
  skin: Rgb
  cloth: Rgb
  eye: Rgb
  target: Rgb
  helper: Rgb
  /** The colour a fully grown muscle group takes in the growth view. */
  grown: Rgb
}

/**
 * Per-vertex colours: skin, the clothes over it, and either the muscles an exercise works
 * (`exercise`) or how far each group has grown (`growth`), or neither.
 */
export function paintBody(
  asset: BodyAsset,
  positions: Float32Array,
  figure: FigureKey,
  palette: Palette,
  show: { exercise: ExerciseId } | { growth: Growth } | null,
  out: Float32Array = new Float32Array(asset.vertices * 3),
): Float32Array {
  const V = asset.vertices
  const top = wearsTop(figure)
  const load = show && 'exercise' in show ? muscleLoad(asset, positions, show.exercise) : null
  const grown = show && 'growth' in show ? MUSCLE_IDS.map((m) => clamp01(show.growth.levels[m] ?? 0)) : null
  const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  for (let v = 0; v < V; v++) {
    let c: Rgb
    if (v >= asset.bodyVertices) c = palette.eye
    else {
      c = mix(palette.skin, palette.cloth, Math.max(asset.shorts[v]!, top ? asset.top[v]! : 0) * 0.92)
      if (load) c = mix(mix(c, palette.helper, load.secondary[v]! * 0.95), palette.target, load.primary[v]! * 0.95)
      if (grown) {
        let g = 0
        for (let k = 0; k < 3; k++) {
          const i = asset.maskIndex[v * 3 + k]!
          if (i !== 255) g += asset.maskWeight[v * 3 + k]! * grown[i]!
        }
        c = mix(c, palette.grown, Math.min(1, g) * 0.85)
      }
    }
    out[v * 3] = c[0]
    out[v * 3 + 1] = c[1]
    out[v * 3 + 2] = c[2]
  }
  return out
}
