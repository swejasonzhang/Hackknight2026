import { EXERCISES, type ExerciseId, type MuscleId } from '@arc/dependencies'
import { BufferAttribute, BufferGeometry } from 'three'
import type { BoneName } from './skeleton'

/*
 * The body's surface, part by part, and where each muscle lies on it. Every part is swept along
 * its bone from anatomical cross-sections (an adult of 170 cm; one body unit is 27 cm), so a calf
 * bulges at the back, a deltoid caps the shoulder and the chest is wider than it is deep. Each
 * vertex keeps where it sits on its part (along the bone, and which way round), and the muscles
 * are soft-edged areas of that map, so the scene can paint what an exercise works. Pure geometry,
 * tested without WebGL.
 *
 * A part's frame: +Y runs along the bone, +Z is its front (the chest, the face, the front of the
 * thigh, the top of the foot) and +X its outer side for a right limb; left limbs are drawn
 * mirrored. The trunk's +X is the body's left.
 */

/**
 * A cross-section `t` of the way along the bone (0 at its first joint, 1 at its second), in body
 * units from the bone's line: `l` toward +X, `m` toward −X, `f` toward the front, `b` toward the
 * back. `z` moves the section's centre forward (the jaw sits in front of the neck).
 */
export interface Section {
  t: number
  l: number
  m: number
  f: number
  b: number
  z?: number
}

export interface Shape {
  /** The bone's length in body units, so the sections are drawn at their true size. */
  length: number
  sections: Section[]
  /** Rounded ends, in body units beyond the first and last sections. */
  caps: [number, number]
  /** Superellipse exponent of the cross-section: 2 is an ellipse, more is boxier. */
  power: number
}

export type ShapeName = 'torso' | 'pelvis' | 'neck' | 'head' | 'upperArm' | 'forearm' | 'thigh' | 'shin' | 'foot'

const s = (t: number, l: number, m: number, f: number, b: number, z = 0): Section => ({ t, l, m, f, b, z })

export const SHAPES: Record<ShapeName, Shape> = {
  // Pelvis joint to the base of the neck: waist, ribs, chest, the trapezius sloping up to the neck.
  torso: {
    length: 1.75,
    power: 2.2,
    caps: [0.12, 0.12],
    // The bottom is a little wider than the pelvis's top so the hips tuck in without a seam; the
    // shoulders stay broad up to the joints and the trapezius slopes into the neck.
    sections: [s(-0.06, 0.52, 0.52, 0.34, 0.37), s(0.08, 0.51, 0.51, 0.35, 0.35), s(0.28, 0.47, 0.47, 0.35, 0.31), s(0.46, 0.52, 0.52, 0.38, 0.35), s(0.62, 0.56, 0.56, 0.45, 0.39), s(0.76, 0.58, 0.58, 0.46, 0.42), s(0.86, 0.58, 0.58, 0.41, 0.42), s(0.93, 0.54, 0.54, 0.31, 0.37), s(0.975, 0.4, 0.4, 0.22, 0.28), s(1, 0.27, 0.27, 0.2, 0.22)],
  },
  // Around the hip joints, centred between them: the glutes behind, the iliac crest on top.
  pelvis: {
    length: 1,
    power: 2.3,
    caps: [0.1, 0.06],
    sections: [s(-0.42, 0.46, 0.46, 0.22, 0.3), s(-0.3, 0.56, 0.56, 0.27, 0.39), s(-0.12, 0.62, 0.62, 0.31, 0.44), s(0.08, 0.59, 0.59, 0.33, 0.4), s(0.28, 0.5, 0.5, 0.32, 0.33), s(0.42, 0.44, 0.44, 0.3, 0.3)],
  },
  neck: { length: 0.23, power: 2, caps: [0.05, 0.05], sections: [s(-0.6, 0.24, 0.24, 0.21, 0.23), s(1.4, 0.22, 0.22, 0.2, 0.22)] },
  // Chin to crown: the jaw in front of the neck, the skull widest above the ears.
  head: {
    length: 0.82,
    power: 2.1,
    caps: [0.04, 0.07],
    sections: [s(-0.04, 0.1, 0.1, 0.08, 0.08, 0.2), s(0.05, 0.17, 0.17, 0.12, 0.14, 0.17), s(0.2, 0.235, 0.235, 0.2, 0.24, 0.1), s(0.4, 0.27, 0.27, 0.27, 0.34, 0.05), s(0.6, 0.29, 0.29, 0.3, 0.4, 0.02), s(0.78, 0.27, 0.27, 0.26, 0.35, 0.02), s(0.9, 0.2, 0.2, 0.18, 0.24, 0.02)],
  },
  // Shoulder to elbow: the deltoid's dome over the joint, biceps in front, triceps behind.
  upperArm: {
    length: 1.1,
    power: 2.1,
    caps: [0.17, 0.11],
    sections: [s(-0.04, 0.2, 0.14, 0.18, 0.19), s(0.08, 0.21, 0.15, 0.2, 0.21), s(0.25, 0.19, 0.15, 0.19, 0.2), s(0.42, 0.165, 0.155, 0.19, 0.18), s(0.62, 0.155, 0.15, 0.185, 0.165), s(0.82, 0.14, 0.145, 0.15, 0.14), s(1, 0.13, 0.135, 0.12, 0.125)],
  },
  // Elbow to wrist: the muscle near the elbow, flattening to the wrist.
  forearm: {
    length: 1,
    power: 2.2,
    caps: [0.1, 0.06],
    sections: [s(0, 0.13, 0.13, 0.115, 0.115), s(0.14, 0.155, 0.135, 0.13, 0.12), s(0.32, 0.145, 0.13, 0.12, 0.11), s(0.6, 0.12, 0.11, 0.09, 0.085), s(0.85, 0.105, 0.1, 0.072, 0.07), s(1, 0.1, 0.1, 0.065, 0.065)],
  },
  // Hip to knee: full at the top, the inner teardrop above the knee.
  thigh: {
    length: 1.6,
    power: 2.1,
    caps: [0.16, 0.12],
    sections: [s(-0.02, 0.3, 0.25, 0.28, 0.3), s(0.12, 0.31, 0.28, 0.31, 0.3), s(0.35, 0.28, 0.26, 0.3, 0.27), s(0.6, 0.24, 0.22, 0.27, 0.23), s(0.8, 0.2, 0.215, 0.23, 0.19), s(0.93, 0.18, 0.19, 0.2, 0.17), s(1, 0.18, 0.18, 0.19, 0.17)],
  },
  // Knee to ankle: the calf high at the back, the shin bone flat in front.
  shin: {
    length: 1.5,
    power: 2.1,
    caps: [0.1, 0.09],
    sections: [s(0, 0.18, 0.18, 0.16, 0.16), s(0.12, 0.18, 0.19, 0.15, 0.23), s(0.28, 0.18, 0.21, 0.135, 0.29), s(0.45, 0.155, 0.17, 0.12, 0.22), s(0.68, 0.12, 0.12, 0.1, 0.13), s(0.88, 0.1, 0.105, 0.09, 0.095), s(1, 0.105, 0.11, 0.095, 0.1)],
  },
  // Ankle to toes: the heel behind and below the ankle, the sole flat on the floor.
  foot: {
    length: 0.747,
    power: 2.6,
    // Toes squared off rather than pointed.
    caps: [0.05, 0.05],
    sections: [s(-0.2, 0.09, 0.09, 0.06, 0.24), s(-0.08, 0.115, 0.11, 0.09, 0.25), s(0.12, 0.135, 0.13, 0.1, 0.22), s(0.4, 0.155, 0.145, 0.075, 0.165), s(0.68, 0.17, 0.16, 0.05, 0.11), s(0.88, 0.168, 0.162, 0.042, 0.075), s(0.96, 0.16, 0.155, 0.038, 0.062)],
  },
}

/** Monotone cubic interpolation through (xs, ys): smooth, and never overshoots a section. */
function monotone(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  if (n === 1) return () => ys[0]!
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]!))
  const m: number[] = [d[0]!]
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2)
  m.push(d[n - 2]!)
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i]! / d[i]!
    const b = m[i + 1]! / d[i]!
    const h = a * a + b * b
    if (h > 9) {
      const k = 3 / Math.sqrt(h)
      m[i] = k * a * d[i]!
      m[i + 1] = k * b * d[i]!
    }
  }
  return (x) => {
    if (x <= xs[0]!) return ys[0]!
    if (x >= xs[n - 1]!) return ys[n - 1]!
    let i = 0
    while (x > xs[i + 1]!) i++
    const h = xs[i + 1]! - xs[i]!
    const u = (x - xs[i]!) / h
    const u2 = u * u
    const u3 = u2 * u
    return (2 * u3 - 3 * u2 + 1) * ys[i]! + (u3 - 2 * u2 + u) * h * m[i]! + (-2 * u3 + 3 * u2) * ys[i + 1]! + (u3 - u2) * h * m[i + 1]!
  }
}

const RINGS = 44
const CAP_RINGS = 7
const SEGMENTS = 36
/** How far round a cap's last ring is; a single point closes it. */
const CAP_END = (Math.PI / 2) * 0.94

export interface Built {
  geometry: BufferGeometry
  /** Per vertex: how far along the bone (t), and which way round (c: toward +X, s: toward the front), each −1..1. */
  t: Float32Array
  c: Float32Array
  s: Float32Array
}

/** Sweeps a shape into an indexed, closed mesh, with outward normals and each vertex's place on the part. */
export function buildShape(shape: Shape): Built {
  const { sections, length, caps, power } = shape
  const ts = sections.map((x) => x.t)
  const fn = (k: keyof Section) => monotone(ts, sections.map((x) => x[k] ?? 0))
  const L = fn('l')
  const M = fn('m')
  const F = fn('f')
  const B = fn('b')
  const Z = fn('z')
  const t0 = ts[0]!
  const t1 = ts.at(-1)!
  // Rings as [the section's t, extra length past it, scale]: the caps shrink the end section round a quarter ellipse.
  const rings: [number, number, number][] = []
  for (let i = CAP_RINGS; i >= 1; i--) {
    const a = (CAP_END * i) / CAP_RINGS
    rings.push([t0, -caps[0] * Math.sin(a), Math.cos(a)])
  }
  for (let i = 0; i <= RINGS; i++) rings.push([t0 + ((t1 - t0) * i) / RINGS, 0, 1])
  for (let i = 1; i <= CAP_RINGS; i++) {
    const a = (CAP_END * i) / CAP_RINGS
    rings.push([t1, caps[1] * Math.sin(a), Math.cos(a)])
  }
  const count = rings.length * SEGMENTS + 2
  const pos = new Float32Array(count * 3)
  const T = new Float32Array(count)
  const C = new Float32Array(count)
  const S = new Float32Array(count)
  const e = 2 / power
  const pow = (v: number) => Math.sign(v) * Math.abs(v) ** e
  let v = 0
  for (const [t, extra, k] of rings) {
    const y = t * length + extra
    const l = L(t) * k
    const m = M(t) * k
    const f = F(t) * k
    const b = B(t) * k
    const z0 = Z(t)
    for (let j = 0; j < SEGMENTS; j++) {
      const th = (j / SEGMENTS) * Math.PI * 2
      const c = Math.cos(th)
      const sn = Math.sin(th)
      pos[v * 3] = (c >= 0 ? l : m) * pow(c)
      pos[v * 3 + 1] = y
      pos[v * 3 + 2] = z0 + (sn >= 0 ? f : b) * pow(sn)
      T[v] = y / length
      C[v] = c
      S[v] = sn
      v++
    }
  }
  // The two poles.
  const first = 0
  const lastRing = (rings.length - 1) * SEGMENTS
  const south = v
  pos.set([0, t0 * length - caps[0], Z(t0)], v * 3)
  T[v] = (t0 * length - caps[0]) / length
  v++
  const north = v
  pos.set([0, t1 * length + caps[1], Z(t1)], v * 3)
  T[v] = (t1 * length + caps[1]) / length

  const index: number[] = []
  for (let r = 0; r < rings.length - 1; r++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = r * SEGMENTS + j
      const b = r * SEGMENTS + ((j + 1) % SEGMENTS)
      const c = a + SEGMENTS
      const d = b + SEGMENTS
      index.push(a, c, b, b, c, d)
    }
  }
  for (let j = 0; j < SEGMENTS; j++) {
    index.push(south, first + j, first + ((j + 1) % SEGMENTS))
    index.push(north, lastRing + ((j + 1) % SEGMENTS), lastRing + j)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(pos, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return { geometry, t: T, c: C, s: S }
}

// ---- where the muscles lie ----

const smooth = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}
/** 1 between a and b along the bone, fading over `soft` at each end. */
const along = (t: number, a: number, b: number, soft = 0.04) => smooth(a - soft, a + soft, t) * (1 - smooth(b - soft, b + soft, t))

type Mask = (t: number, c: number, s: number) => number

/** Each part's muscles as soft areas of (t along the bone, c toward +X, s toward the front). */
export const MUSCLE_MAP: Partial<Record<ShapeName, Partial<Record<MuscleId, Mask>>>> = {
  torso: {
    // Two pecs either side of the breastbone.
    chest: (t, c, s) => along(t, 0.6, 0.9) * smooth(0.25, 0.5, s) * smooth(0.03, 0.09, Math.abs(c)),
    // The six-pack down the front, split by the midline.
    abs: (t, c, s) => along(t, 0.08, 0.6) * smooth(0.8, 0.9, s) * smooth(0.015, 0.05, Math.abs(c)),
    obliques: (t, c, s) => along(t, 0.1, 0.56) * smooth(0.5, 0.72, Math.abs(c)) * smooth(-0.5, -0.15, s),
    // The lats sweep from under the arms down the sides of the back.
    lats: (t, c, s) => along(t, 0.3, 0.82) * smooth(0.3, 0.55, Math.abs(c)) * (1 - smooth(-0.1, 0.2, s)),
    upper_back: (t, _c, s) => along(t, 0.58, 0.9) * smooth(0.6, 0.8, -s),
    lower_back: (t, _c, s) => along(t, -0.05, 0.5) * smooth(0.75, 0.88, -s),
    traps: (t, _c, s) => along(t, 0.84, 1.1) * smooth(-0.6, -0.1, -s),
  },
  pelvis: {
    glutes: (t, _c, s) => along(t, -0.5, 0.12, 0.08) * smooth(0, 0.35, -s),
    lower_back: (t, _c, s) => along(t, 0.15, 0.6) * smooth(0.75, 0.88, -s),
  },
  neck: { traps: (t, _c, s) => along(t, -0.6, 0.45, 0.1) * smooth(-0.1, 0.3, -s) },
  upperArm: {
    front_delts: (t, _c, s) => along(t, -0.2, 0.32) * smooth(0.1, 0.45, s),
    side_delts: (t, c) => along(t, -0.2, 0.32) * smooth(0.3, 0.6, c),
    rear_delts: (t, _c, s) => along(t, -0.2, 0.32) * smooth(0.1, 0.45, -s),
    biceps: (t, _c, s) => along(t, 0.3, 0.88) * smooth(0.25, 0.55, s),
    triceps: (t, _c, s) => along(t, 0.22, 0.9) * smooth(0.15, 0.45, -s),
  },
  forearm: { forearms: (t) => along(t, -0.1, 0.72) },
  thigh: {
    quads: (t, _c, s) => along(t, 0.04, 0.9) * smooth(-0.3, 0.1, s),
    hamstrings: (t, _c, s) => along(t, 0.1, 0.88) * smooth(0.2, 0.5, -s),
    glutes: (t, _c, s) => along(t, -0.12, 0.1) * smooth(0.1, 0.4, -s),
  },
  shin: { calves: (t, _c, s) => along(t, 0.02, 0.62) * smooth(0, 0.35, -s) },
}

/** Muscles down the body's midline, worked on both sides even by a one-sided exercise. */
const MIDLINE: ReadonlySet<MuscleId> = new Set(['abs', 'lower_back'])

/** Each body part's shape, and whether it is drawn mirrored (the left limbs). */
export const PART_SHAPE: Partial<Record<BoneName, { shape: ShapeName; left?: boolean }>> = {
  torso: { shape: 'torso' },
  pelvis: { shape: 'pelvis' },
  neck: { shape: 'neck' },
  head: { shape: 'head' },
  rUpperArm: { shape: 'upperArm' },
  lUpperArm: { shape: 'upperArm', left: true },
  rForearm: { shape: 'forearm' },
  lForearm: { shape: 'forearm', left: true },
  rThigh: { shape: 'thigh' },
  lThigh: { shape: 'thigh', left: true },
  rShin: { shape: 'shin' },
  lShin: { shape: 'shin', left: true },
  rFoot: { shape: 'foot' },
  lFoot: { shape: 'foot', left: true },
}

/**
 * How hard an exercise works each vertex of a part: `primary` (the target, drawn red) and
 * `secondary` (helping or holding steady, drawn yellow), each 0..1. The figure always does the
 * work on its right side, so a one-sided exercise (a curl, a one-arm row) lights only the right
 * limb and the right half of the trunk, apart from the muscles down the middle.
 */
export function muscleLoad(part: BoneName, built: Built, exercise: ExerciseId): { primary: Float32Array; secondary: Float32Array } {
  const n = built.t.length
  const primary = new Float32Array(n)
  const secondary = new Float32Array(n)
  const info = PART_SHAPE[part]
  const map = info ? MUSCLE_MAP[info.shape] : undefined
  const { sided, muscles } = EXERCISES[exercise]
  if (!info || !map || (sided && info.left)) return { primary, secondary }
  const trunk = info.shape === 'torso' || info.shape === 'pelvis' || info.shape === 'neck'
  const paint = (list: readonly MuscleId[], into: Float32Array) => {
    for (const muscle of list) {
      const mask = map[muscle]
      if (!mask) continue
      const oneSide = sided && trunk && !MIDLINE.has(muscle)
      for (let i = 0; i < n; i++) {
        // The trunk's right half is −X.
        const side = oneSide ? smooth(-0.12, 0.12, -built.c[i]!) : 1
        const w = mask(built.t[i]!, built.c[i]!, built.s[i]!) * side
        if (w > into[i]!) into[i] = w
      }
    }
  }
  paint(muscles.primary, primary)
  paint(muscles.secondary, secondary)
  return { primary, secondary }
}

/** Muscles on the back of the body: an exercise that mostly targets these turns its back toward the camera. */
const BEHIND: ReadonlySet<MuscleId> = new Set(['rear_delts', 'triceps', 'traps', 'upper_back', 'lats', 'lower_back', 'glutes', 'hamstrings', 'calves'])

/** Which way the figure faces before it sways, as a turn about the vertical: three-quarters from the front, or turned to show the back. */
export function facingFor(exercise: ExerciseId): number {
  const { primary } = EXERCISES[exercise].muscles
  return primary.filter((m) => BEHIND.has(m)).length * 2 > primary.length ? 0.6 : -0.2
}
