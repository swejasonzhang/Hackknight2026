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
 * - the clothes: shorts on everyone and a sports top on the female figure and the one between,
 *   each a surface of the body's own triangles lifted off the skin, the hollows under it filled;
 * - the paint: the muscles an exercise works (red targets, yellow helpers), on skin and fabric.
 */

export type Sex = 'female' | 'male'
export const BONE_NAMES = BODY_META.bones
export type SkinBone = (typeof BONE_NAMES)[number]
export type GarmentName = 'shorts' | 'top'

/**
 * A garment: the surface of the body under it, cut cleanly at its hem. Each vertex is a point of
 * the body: `s` of the way from body vertex `a` to body vertex `b` (on `a` itself when they are the
 * same), so it follows the body's shape, growth and pose.
 */
export interface Garment {
  a: Uint16Array
  b: Uint16Array
  s: Float32Array
  /** Its triangles, by its own vertex numbers. */
  faces: Uint16Array
  /** 1 for a vertex on its hem. */
  hem: Uint8Array
  /** Each vertex's neighbours, for smoothing it over the body. */
  neighbours: number[][]
  /** How many edges each vertex is from the hem (0 on it). */
  ring: Uint8Array
}

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
  garments: Record<GarmentName, Garment>
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
  const garment = (name: GarmentName): Garment => {
    const a = view(`${name}.a`, Uint16Array)
    const faces = view(`${name}.faces`, Uint16Array)
    const neighbours: Set<number>[] = Array.from({ length: a.length }, () => new Set())
    for (let k = 0; k < faces.length; k += 3) {
      const [a, b, c] = [faces[k]!, faces[k + 1]!, faces[k + 2]!]
      neighbours[a]!.add(b).add(c)
      neighbours[b]!.add(a).add(c)
      neighbours[c]!.add(a).add(b)
    }
    const s = Float32Array.from(view(`${name}.s`, Uint16Array), (x) => x / 65535)
    const hem = view(`${name}.hem`, Uint8Array)
    const lists = neighbours.map((n) => [...n])
    // Rings from the hem inward, breadth first.
    const ring = new Uint8Array(a.length).fill(255)
    let front = [...hem.keys()].filter((i) => hem[i])
    for (const i of front) ring[i] = 0
    for (let r = 1; front.length && r < 255; r++) {
      const nextFront: number[] = []
      for (const i of front) for (const j of lists[i]!) if (ring[j] === 255) (ring[j] = r), nextFront.push(j)
      front = nextFront
    }
    return { a, b: view(`${name}.b`, Uint16Array), s, faces, hem, neighbours: lists, ring }
  }
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
    garments: { shorts: garment('shorts'), top: garment('top') },
  }
}

/** Smooth normals of a mesh: each vertex's faces' normals, weighted by their area. */
export function vertexNormals(positions: Float32Array, index: ArrayLike<number>, out: Float32Array = new Float32Array(positions.length)): Float32Array {
  out.fill(0)
  for (let k = 0; k < index.length; k += 3) {
    const a = index[k]! * 3
    const b = index[k + 1]! * 3
    const c = index[k + 2]! * 3
    const ux = positions[b]! - positions[a]!
    const uy = positions[b + 1]! - positions[a + 1]!
    const uz = positions[b + 2]! - positions[a + 2]!
    const vx = positions[c]! - positions[a]!
    const vy = positions[c + 1]! - positions[a + 1]!
    const vz = positions[c + 2]! - positions[a + 2]!
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    for (const i of [a, b, c]) {
      out[i] = out[i]! + nx
      out[i + 1] = out[i + 1]! + ny
      out[i + 2] = out[i + 2]! + nz
    }
  }
  for (let i = 0; i < out.length; i += 3) {
    const l = Math.hypot(out[i]!, out[i + 1]!, out[i + 2]!) || 1
    out[i] = out[i]! / l
    out[i + 1] = out[i + 1]! / l
    out[i + 2] = out[i + 2]! / l
  }
  return out
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
  // Face on, the arms swing in the picture's plane: their front is carried from the trunk's line laid
  // flat in that plane, so an arm or a forearm pointing straight up turns about the picture's axis.
  // From the trunk's own line, tilted a degree or two out of the plane, the turn would be about an
  // axis that flips as the limb passes vertical, and the forearm would spin through a press.
  const armDown: Vec = side ? scaleV(up, -1) : unitV([-up[0], -up[1], 0])
  for (const [bone, a, b] of ARM_CHAIN) out[bone] = frame(j[a], j[b], carry(armDown, unitV(subV(j[b], j[a])), fwd))
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
/** The garments a figure wears. */
export const garmentsOf = (figure: FigureKey): GarmentName[] => (wearsTop(figure) ? ['shorts', 'top'] : ['shorts'])

/** How far each garment sits off the skin, in body units (27 cm): about half a centimetre. */
export const GARMENT_LIFT: Record<GarmentName, number> = { shorts: 0.022, top: 0.018 }
/** Rounds of smoothing that iron the body's small details out of the fabric (Taubin: no shrinking). */
const GARMENT_SMOOTHING = 14
/** Edges from the hem within which the fabric is held off the visible skin. */
const HEM_RINGS = 3

/** A point on the body: `s` of the way from vertex `a` to vertex `b` of a per-vertex array. */
function onBody(values: Float32Array, a: number, b: number, s: number, k: number): number {
  return values[a * 3 + k]! + (values[b * 3 + k]! - values[a * 3 + k]!) * s
}

/**
 * A garment's positions over the body in its bind pose. The fabric is the body's surface under
 * it, smoothed (Taubin's way, so it irons out small details such as the shape of the breasts' tips
 * or of the groin without shrinking the whole) and lifted off the skin along the normals. Near the
 * hem, where the skin is still drawn, it never goes in toward the body; further in, where the skin
 * under it is not drawn, it follows the smoothed shape. The hem itself sits closer, like an elastic
 * edge, and stays put.
 */
export function garmentPositions(garment: Garment, bodyPositions: Float32Array, bodyNormals: Float32Array, lift: number, out: Float32Array = new Float32Array(garment.a.length * 3)): Float32Array {
  const n = garment.a.length
  const base = new Float32Array(n * 3)
  const normal = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const [a, b, s] = [garment.a[i]!, garment.b[i]!, garment.s[i]!]
    for (let k = 0; k < 3; k++) {
      base[i * 3 + k] = onBody(bodyPositions, a, b, s, k)
      normal[i * 3 + k] = onBody(bodyNormals, a, b, s, k)
    }
    const l = Math.hypot(normal[i * 3]!, normal[i * 3 + 1]!, normal[i * 3 + 2]!) || 1
    for (let k = 0; k < 3; k++) normal[i * 3 + k] = normal[i * 3 + k]! / l
  }
  let cur = Float32Array.from(base)
  let next = new Float32Array(n * 3)
  // Alternate a smoothing step and a slightly larger step back: details go, the size stays.
  for (let round = 0; round < GARMENT_SMOOTHING * 2; round++) {
    const step = round % 2 ? -0.53 : 0.5
    for (let i = 0; i < n; i++) {
      const nb = garment.neighbours[i]!
      if (garment.hem[i] || !nb.length) {
        next.set(cur.subarray(i * 3, i * 3 + 3), i * 3)
        continue
      }
      for (let k = 0; k < 3; k++) {
        let mean = 0
        for (const j of nb) mean += cur[j * 3 + k]!
        mean /= nb.length
        next[i * 3 + k] = cur[i * 3 + k]! + step * (mean - cur[i * 3 + k]!)
      }
    }
    ;[cur, next] = [next, cur]
  }
  for (let i = 0; i < n; i++) {
    let outward = 0
    for (let k = 0; k < 3; k++) outward += (cur[i * 3 + k]! - base[i * 3 + k]!) * normal[i * 3 + k]!
    const d = garment.hem[i] ? lift * 0.5 : lift + (garment.ring[i]! < HEM_RINGS ? Math.max(0, outward) : outward)
    for (let k = 0; k < 3; k++) out[i * 3 + k] = base[i * 3 + k]! + normal[i * 3 + k]! * d
  }
  return out
}

/** A garment vertex's four bones and weights: its two body vertices' weights, mixed and the four heaviest kept. */
export function garmentSkin(asset: BodyAsset, garment: Garment): { index: Uint8Array; weight: Float32Array } {
  const n = garment.a.length
  const index = new Uint8Array(n * 4)
  const weight = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const mixed = new Map<number, number>()
    for (const [v, share] of [
      [garment.a[i]!, 1 - garment.s[i]!],
      [garment.b[i]!, garment.s[i]!],
    ] as const) {
      for (let k = 0; k < 4; k++) {
        const w = asset.skinWeight[v * 4 + k]! * share
        if (w > 0) mixed.set(asset.skinIndex[v * 4 + k]!, (mixed.get(asset.skinIndex[v * 4 + k]!) ?? 0) + w)
      }
    }
    const top = [...mixed.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4)
    const total = top.reduce((t, [, w]) => t + w, 0) || 1
    top.forEach(([bone, w], k) => {
      index[i * 4 + k] = bone
      weight[i * 4 + k] = w / total
    })
  }
  return { index, weight }
}

/**
 * The triangles to draw of the body for a figure: every one but the skin a worn garment covers
 * entirely (which could only show through the fabric at a bend), and the eyes.
 */
export function visibleTriangles(asset: BodyAsset, figure: FigureKey): Uint16Array {
  const covered = new Uint8Array(asset.vertices)
  for (const name of garmentsOf(figure)) {
    const g = asset.garments[name]
    // A garment vertex on a body vertex (not a cut along an edge) is a body vertex under the fabric.
    g.a.forEach((v, i) => {
      if (v === g.b[i]) covered[v] = 1
    })
  }
  const keep: number[] = []
  const index = asset.index
  for (let k = 0; k < index.length; k += 3) {
    const [a, b, c] = [index[k]!, index[k + 1]!, index[k + 2]!]
    if (!(covered[a] && covered[b] && covered[c])) keep.push(a, b, c)
  }
  return Uint16Array.from(keep)
}

export type Rgb = [number, number, number]
export interface Palette {
  skin: Rgb
  eye: Rgb
  target: Rgb
  helper: Rgb
  /** The colour a fully grown muscle group takes in the growth view. */
  grown: Rgb
  /** Each garment's fabric. */
  fabric: Record<GarmentName, Rgb>
}

/** What is shown on the body: the muscles an exercise works, how far each group has grown, or neither. */
export type Show = { exercise: ExerciseId } | { growth: Growth } | null

/** Per body vertex: how hard the exercise works it (target and helper), or how far its groups have grown. */
function tints(asset: BodyAsset, positions: Float32Array, show: Show) {
  const load = show && 'exercise' in show ? muscleLoad(asset, positions, show.exercise) : null
  let grown: Float32Array | null = null
  if (show && 'growth' in show) {
    const levels = MUSCLE_IDS.map((m) => clamp01(show.growth.levels[m] ?? 0))
    grown = new Float32Array(asset.vertices)
    for (let v = 0; v < asset.bodyVertices; v++) {
      let g = 0
      for (let k = 0; k < 3; k++) {
        const i = asset.maskIndex[v * 3 + k]!
        if (i !== 255) g += asset.maskWeight[v * 3 + k]! * levels[i]!
      }
      grown[v] = Math.min(1, g)
    }
  }
  return { load, grown }
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
function tinted(base: Rgb, v: number, t: ReturnType<typeof tints>, palette: Palette, strength: number): Rgb {
  let c = base
  if (t.load) c = mix(mix(c, palette.helper, t.load.secondary[v]! * strength), palette.target, t.load.primary[v]! * strength)
  if (t.grown) c = mix(c, palette.grown, t.grown[v]! * strength * 0.9)
  return c
}

/** Per-vertex colours of the body: skin and the eyes, tinted by what is shown. */
export function paintBody(asset: BodyAsset, positions: Float32Array, palette: Palette, show: Show, out: Float32Array = new Float32Array(asset.vertices * 3)): Float32Array {
  const t = tints(asset, positions, show)
  for (let v = 0; v < asset.vertices; v++) {
    const c = v >= asset.bodyVertices ? palette.eye : tinted(palette.skin, v, t, palette, 0.95)
    out.set(c, v * 3)
  }
  return out
}

/** Per-vertex colours of a garment: its fabric, tinted by what is shown on the muscles under it. */
export function paintGarment(asset: BodyAsset, name: GarmentName, positions: Float32Array, palette: Palette, show: Show, out?: Float32Array): Float32Array {
  const g = asset.garments[name]
  const colors = out ?? new Float32Array(g.a.length * 3)
  const t = tints(asset, positions, show)
  for (let i = 0; i < g.a.length; i++) colors.set(tinted(palette.fabric[name], g.s[i]! < 0.5 ? g.a[i]! : g.b[i]!, t, palette, 0.85), i * 3)
  return colors
}
