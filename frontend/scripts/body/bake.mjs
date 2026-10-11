// Bakes Arc's 3D body from MakeHuman's CC0 assets: `node scripts/body/bake.mjs` (from frontend/).
//
// Downloads the pinned MakeHuman files below into scripts/body/.cache (once), builds a young adult
// figure of each sex from the base mesh and MakeHuman's own targets (an even mix of the three ethnic
// targets), in two states: skinny and untrained, and built (MakeHuman's most muscle plus its muscle
// targets for single regions), and writes what the app needs to src/components/three/body/:
//
// - body.bin: the mesh (the skinny positions and the offset to the built ones, per sex), triangles,
//   skin weights onto Arc's skeleton, where each muscle group lies, and the clothes (the body's
//   own triangles under each garment, which the app lifts off the skin into a separate surface);
// - bodyMeta.ts: the layout of body.bin and each figure's joints, in Arc's body units (27 cm).
//
// Nothing here runs in the app; the app only decodes body.bin. Standard library only.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, '.cache')
const OUT = join(HERE, '../../src/components/three/body')

/** MakeHuman's repository at a fixed commit, so the bake is repeatable. Its assets are CC0 1.0. */
const MH_COMMIT = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
const MH_RAW = `https://raw.githubusercontent.com/makehumancommunity/makehuman/${MH_COMMIT}/makehuman/data`

/** MakeHuman works in decimetres; Arc's skeleton in units of 27 cm. */
const DM_PER_UNIT = 2.7
const SEXES = ['female', 'male']
const RACES = ['african', 'asian', 'caucasian']
/**
 * The untrained start and the most the figure is built to, as MakeHuman's muscle and weight macros
 * (0.5 is average for each) and how far the regional muscle targets turn (−1 all the way down).
 * Training moves each vertex from one to the other by its muscle group's level.
 */
const STATES = {
  skinny: { muscle: 0.25, weight: 0.15, regional: -1 },
  built: { muscle: 1, weight: 0.3, regional: 1 },
}
/** MakeHuman's targets for single regions, and how far each state takes them (a share of `regional`). */
const REGIONAL = [
  { target: 'armslegs/{side}-upperarm-muscle', down: 0.6, up: 1 },
  { target: 'armslegs/{side}-upperarm-shoulder-muscle', down: 0.5, up: 1 },
  { target: 'armslegs/{side}-lowerarm-muscle', down: 0.5, up: 1 },
  { target: 'armslegs/{side}-upperleg-muscle', down: 0.5, up: 1 },
  { target: 'armslegs/{side}-lowerleg-muscle', down: 0.5, up: 1 },
  { target: 'torso/torso-muscle-pectoral', down: 0.5, up: 1 },
  { target: 'torso/torso-muscle-dorsi', down: 0.5, up: 1 },
  { target: 'buttocks/buttocks-volume', down: 0.4, up: 0.8 },
]
const regionalFiles = (r, way) => (r.target.includes('{side}') ? ['r', 'l'].map((side) => r.target.replace('{side}', side)) : [r.target]).map((t) => `targets/${t}-${way}.target`)

// ---- the files ----

const universal = (sex, muscle, weight) => `targets/macrodetails/universal-${sex}-young-${muscle}muscle-${weight}weight.target`
const FILES = [
  '3dobjs/base.obj',
  'rigs/default.mhskel',
  'rigs/default_weights.mhw',
  ...SEXES.flatMap((sex) => [
    ...RACES.map((race) => `targets/macrodetails/${race}-${sex}-young.target`),
    ...['min', 'average', 'max'].flatMap((m) => ['min', 'average', 'max'].map((w) => universal(sex, m, w))),
  ]),
  ...REGIONAL.flatMap((r) => [...regionalFiles(r, 'decr'), ...regionalFiles(r, 'incr')]),
]

async function fetchAll() {
  for (const file of FILES) {
    const path = join(CACHE, file)
    if (existsSync(path)) continue
    mkdirSync(dirname(path), { recursive: true })
    const res = await fetch(`${MH_RAW}/${file}`)
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)
    writeFileSync(path, Buffer.from(await res.arrayBuffer()))
    console.log(`fetched ${file}`)
  }
}
const read = (file) => readFileSync(join(CACHE, file), 'utf8')

// ---- the base mesh ----

function parseObj(text) {
  const verts = []
  const groups = new Map()
  let group = null
  for (const line of text.split('\n')) {
    if (line.startsWith('v ')) verts.push(line.trim().split(/\s+/).slice(1, 4).map(Number))
    else if (line.startsWith('g ')) group = line.trim().split(/\s+/)[1]
    else if (line.startsWith('f ')) {
      const face = line.trim().split(/\s+/).slice(1).map((p) => Number(p.split('/')[0]) - 1)
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group).push(face)
    }
  }
  return { verts, groups }
}

function parseTarget(text, count) {
  const d = new Float64Array(count * 3)
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const [i, x, y, z] = s.split(/\s+/).map(Number)
    d[i * 3] = x
    d[i * 3 + 1] = y
    d[i * 3 + 2] = z
  }
  return d
}

/** MakeHuman's macro weights for a slider value: least, average, most (0, 0.5, 1 as the corners). */
const corners = (v) => (v < 0.5 ? { min: 1 - 2 * v, average: 2 * v, max: 0 } : { min: 0, average: 2 - 2 * v, max: 2 * v - 1 })

/** A young adult of one sex in a state, as MakeHuman composes it: the base plus weighted targets. */
function compose(base, targets, sex, state) {
  const pos = Float64Array.from(base.flat())
  const add = (file, k) => {
    if (!k) return
    const d = targets.get(file)
    for (let i = 0; i < pos.length; i++) pos[i] += d[i] * k
  }
  for (const race of RACES) add(`targets/macrodetails/${race}-${sex}-young.target`, 1 / 3)
  const mw = corners(state.muscle)
  const ww = corners(state.weight)
  for (const [mn, mk] of Object.entries(mw)) for (const [wn, wk] of Object.entries(ww)) add(universal(sex, mn, wn), mk * wk)
  for (const r of REGIONAL) {
    const way = state.regional < 0 ? 'decr' : 'incr'
    const k = Math.abs(state.regional) * (state.regional < 0 ? r.down : r.up)
    for (const file of regionalFiles(r, way)) add(file, k)
  }
  return pos
}

// ---- Arc's skeleton ----

/** The bones Arc poses, then the helpers that share a joint's turn between two of them. */
const BONES = ['pelvis', 'torso', 'neck', 'head', 'rUpperArm', 'lUpperArm', 'rForearm', 'lForearm', 'rHand', 'lHand', 'rThigh', 'lThigh', 'rShin', 'lShin', 'rFoot', 'lFoot', 'rClavicle', 'lClavicle', 'rDeltoid', 'lDeltoid', 'rGlute', 'lGlute']

/** Which of Arc's bones each MakeHuman bone's weights go to. */
function arcBone(mh) {
  const side = mh.endsWith('.R') ? 'r' : mh.endsWith('.L') ? 'l' : ''
  const name = mh.replace(/\.[LR]$/, '')
  if (name === 'root' || name === 'spine05') return 'pelvis'
  if (name === 'pelvis') return `${side}Glute`
  if (/^spine0[1-4]$/.test(name) || name === 'breast') return 'torso'
  if (name === 'clavicle') return `${side}Clavicle`
  if (name === 'shoulder01') return `${side}Deltoid`
  if (/^neck0\d$/.test(name)) return 'neck'
  if (/^upperarm0\d$/.test(name)) return `${side}UpperArm`
  if (/^lowerarm0\d$/.test(name)) return `${side}Forearm`
  if (name === 'wrist' || /^metacarpal\d$/.test(name) || /^finger\d-\d$/.test(name)) return `${side}Hand`
  if (/^upperleg0\d$/.test(name)) return `${side}Thigh`
  if (/^lowerleg0\d$/.test(name)) return `${side}Shin`
  if (name === 'foot' || /^toe\d-\d$/.test(name)) return `${side}Foot`
  return 'head' // the skull, the jaw, the eyes and every face bone
}

/** Arc's joints and the MakeHuman joint marker each sits on. */
const JOINTS = {
  pelvis: 'joint-pelvis',
  neck: 'joint-neck',
  headBase: 'joint-head',
  headTop: 'joint-head-2',
  rShoulder: 'joint-r-shoulder',
  lShoulder: 'joint-l-shoulder',
  rClavicle: 'joint-r-clavicle',
  lClavicle: 'joint-l-clavicle',
  rElbow: 'joint-r-elbow',
  lElbow: 'joint-l-elbow',
  rWrist: 'joint-r-hand',
  lWrist: 'joint-l-hand',
  // The hand's bone runs from the wrist to the middle finger's knuckle.
  rFingertip: 'joint-r-finger-3-1',
  lFingertip: 'joint-l-finger-3-1',
  rHip: 'joint-r-upper-leg',
  lHip: 'joint-l-upper-leg',
  rKnee: 'joint-r-knee',
  lKnee: 'joint-l-knee',
  rAnkle: 'joint-r-ankle',
  lAnkle: 'joint-l-ankle',
  rToe: 'joint-r-toe-2-4',
  lToe: 'joint-l-toe-2-4',
}

// ---- small vector maths ----

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const unit = (a) => {
  const l = len(a)
  return [a[0] / l, a[1] / l, a[2] / l]
}
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
/** `v` turned by the rotation that takes unit `from` onto unit `to` (Rodrigues). */
function carry(from, to, v) {
  const axis = cross(from, to)
  const s = len(axis)
  const c = dot(from, to)
  if (s < 1e-9) return c > 0 ? v : scale(v, -1)
  const k = scale(axis, 1 / s)
  const kv = cross(k, v)
  const kd = dot(k, v) * (1 - c)
  return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd]
}
const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}
/** 1 between a and b, fading over `soft` at each end. */
const along = (t, a, b, soft = 0.05) => smooth(a - soft, a + soft, t) * (1 - smooth(b - soft, b + soft, t))

// ---- the bake ----

await fetchAll()
const { verts, groups } = parseObj(read('3dobjs/base.obj'))
const N = verts.length
const targets = new Map(FILES.filter((f) => f.endsWith('.target')).map((f) => [f, parseTarget(read(f), N)]))

// The body and the two eyes, renumbered from 0; every helper cube and proxy is left out.
const bodyFaces = groups.get('body')
const eyeFaces = [...groups.get('helper-r-eye'), ...groups.get('helper-l-eye')]
const used = [...new Set([...bodyFaces, ...eyeFaces].flat())].sort((a, b) => a - b)
const newIndex = new Map(used.map((v, i) => [v, i]))
const V = used.length
const BODY_V = new Set(bodyFaces.flat()).size
const tri = (faces) => faces.flatMap((f) => [newIndex.get(f[0]), newIndex.get(f[1]), newIndex.get(f[2]), newIndex.get(f[0]), newIndex.get(f[2]), newIndex.get(f[3])])
const bodyTris = tri(bodyFaces)
const eyeTris = tri(eyeFaces)

/** A joint marker's centre: the mean of its cube's vertices. */
const centre = (pos, group) => {
  const vs = [...new Set(groups.get(group).flat())]
  const c = [0, 0, 0]
  for (const v of vs) for (let k = 0; k < 3; k++) c[k] += pos[v * 3 + k] / vs.length
  return c
}

// Each sex in both states; joints from half way between them (the pose bends the mesh at its joints,
// which barely move as the muscle grows). Everything is moved into Arc's units with the floor at
// y = 0 and the hip joints' midpoint over the origin.
const figures = {}
for (const sex of SEXES) {
  const states = Object.fromEntries(Object.entries(STATES).map(([k, state]) => [k, compose(verts, targets, sex, state)]))
  const avg = states.skinny.map((x, i) => (x + states.built[i]) / 2)
  states.average = avg
  const floor = Math.min(...bodyFaces.flat().map((v) => avg[v * 3 + 1]))
  const hips = [centre(avg, 'joint-r-upper-leg'), centre(avg, 'joint-l-upper-leg')]
  const origin = [(hips[0][0] + hips[1][0]) / 2, floor, (hips[0][2] + hips[1][2]) / 2]
  const place = (p) => [(p[0] - origin[0]) / DM_PER_UNIT, (p[1] - origin[1]) / DM_PER_UNIT, (p[2] - origin[2]) / DM_PER_UNIT]
  const out = {}
  for (const [k, pos] of Object.entries(states)) {
    const a = new Float64Array(V * 3)
    used.forEach((v, i) => a.set(place([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]), i * 3))
    out[k] = a
  }
  const joints = Object.fromEntries(Object.entries(JOINTS).map(([name, group]) => [name, place(centre(avg, group)).map((x) => +x.toFixed(5))]))
  figures[sex] = { states: out, joints, avg, place }
}

// ---- skin weights onto Arc's bones ----

const mhWeights = JSON.parse(read('rigs/default_weights.mhw')).weights
const perVertex = Array.from({ length: V }, () => new Map())
for (const [mh, list] of Object.entries(mhWeights)) {
  const bone = BONES.indexOf(arcBone(mh))
  for (const [v, w] of list) {
    const i = newIndex.get(v)
    if (i == null) continue
    perVertex[i].set(bone, (perVertex[i].get(bone) ?? 0) + w)
  }
}
const skinIndex = new Uint8Array(V * 4)
const skinWeight = new Uint8Array(V * 4)
for (let i = 0; i < V; i++) {
  const top = [...perVertex[i].entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  if (!top.length) throw new Error(`vertex ${i} has no weight`)
  const total = top.reduce((s, [, w]) => s + w, 0)
  // Whole bytes that add to exactly 255, the remainder on the heaviest bone.
  const bytes = top.map(([, w]) => Math.floor((w / total) * 255))
  bytes[0] += 255 - bytes.reduce((s, b) => s + b, 0)
  top.forEach(([b], k) => {
    skinIndex[i * 4 + k] = b
    skinWeight[i * 4 + k] = bytes[k]
  })
}

// ---- the grip: the fingers closed round a handle ----

// MakeHuman's own finger bones (three to a finger, the thumb first) and their skin weights curl
// the fingers toward the palm by these angles, knuckle to tip, round a handle about 3.5 cm across:
// a hand holding a dumbbell, a cable handle or a bar. The app blends the closed hand in for the
// movements that hold a weight; the handle's centre and its line across the palm tell it where
// to put the weight.
const rig = JSON.parse(read('rigs/default.mhskel'))
const CURL = { 1: [28, 30, 38], 2: [70, 88, 48], 3: [74, 90, 48], 4: [76, 90, 48], 5: [74, 88, 48] }
const deg = (d) => (d * Math.PI) / 180
/** `p` turned about the line through `o` along the unit `axis` by `angle`. */
function turnAbout(p, o, axis, angle) {
  const v = sub(p, o)
  const c = Math.cos(angle)
  const sn = Math.sin(angle)
  const kv = cross(axis, v)
  const kd = dot(axis, v) * (1 - c)
  return [o[0] + v[0] * c + kv[0] * sn + axis[0] * kd, o[1] + v[1] * c + kv[1] * sn + axis[1] * kd, o[2] + v[2] * c + kv[2] * sn + axis[2] * kd]
}
/** A rig joint (the mean of its vertices) in a figure's space and Arc's units. */
const rigPoint = (sex, name) => {
  const f = figures[sex]
  const vs = rig.joints[name]
  const c = [0, 0, 0]
  for (const v of vs) for (let k = 0; k < 3; k++) c[k] += f.avg[v * 3 + k] / vs.length
  return f.place(c)
}
const SIDES = { r: 'R', l: 'L' }
/** Each finger bone of a hand as MakeHuman names it, with the turns that close it: its own and its parents'. */
function closingTurns(sex, side) {
  const S = SIDES[side]
  const bone = (f, k) => ({ head: rigPoint(sex, `finger${f}-${k}.${S}____head`), tail: rigPoint(sex, `finger${f}-${k}.${S}____tail`) })
  const fingers = Object.fromEntries([1, 2, 3, 4, 5].map((f) => [f, [1, 2, 3].map((k) => bone(f, k))]))
  const wrist = rigPoint(sex, `wrist.${S}____head`)
  const along = unit(sub(fingers[3][0].head, wrist))
  const knuckles = unit(sub(fingers[5][0].head, fingers[2][0].head))
  let palm = unit(cross(along, knuckles))
  // The palm is the side the relaxed fingers already curl toward.
  const reach = sub(fingers[3][2].tail, fingers[3][0].head)
  if (dot(reach, palm) < 0) palm = scale(palm, -1)
  const turns = new Map()
  for (const f of [1, 2, 3, 4, 5]) {
    const chain = []
    fingers[f].forEach((b, k) => {
      chain.push({ o: b.head, axis: unit(cross(unit(sub(b.tail, b.head)), palm)), angle: deg(CURL[f][k]) })
      turns.set(`finger${f}-${k + 1}.${S}`, [...chain])
    })
  }
  return { turns, fingers, palm, knuckles }
}
/** A point carried by one finger bone's closing turns, the tip's turn first. */
const close = (p, chain) => chain.reduceRight((q, t) => turnAbout(q, t.o, t.axis, t.angle), p)

// Which vertices each finger bone moves, and by how much (MakeHuman's weights, original indices).
const fingerWeights = new Map()
for (const [mh, list] of Object.entries(mhWeights)) {
  if (!/^finger\d-\d\.[LR]$/.test(mh)) continue
  for (const [v, w] of list) {
    const i = newIndex.get(v)
    if (i == null || i >= BODY_V) continue
    if (!fingerWeights.has(i)) fingerWeights.set(i, [])
    fingerWeights.get(i).push([mh, w])
  }
}
const totalWeight = new Map()
for (const [, list] of Object.entries(mhWeights)) for (const [v, w] of list) totalWeight.set(v, (totalWeight.get(v) ?? 0) + w)
const GRIP_VERTICES = [...fingerWeights.keys()].sort((a, b) => a - b)
for (const sex of SEXES) {
  const pos = figures[sex].states.average
  const hands = { r: closingTurns(sex, 'r'), l: closingTurns(sex, 'l') }
  const offsets = new Float64Array(GRIP_VERTICES.length * 3)
  GRIP_VERTICES.forEach((i, n) => {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]
    const total = totalWeight.get(used[i]) ?? 1
    // The fingers' share moves with them; the rest of the vertex (palm, wrist) stays.
    const moved = [0, 0, 0]
    let share = 0
    for (const [mh, w] of fingerWeights.get(i)) {
      const side = mh.endsWith('.R') ? 'r' : 'l'
      const q = close(p, hands[side].turns.get(mh))
      for (let k = 0; k < 3; k++) moved[k] += (q[k] - p[k]) * (w / total)
      share += w / total
    }
    for (let k = 0; k < 3; k++) offsets[n * 3 + k] = moved[k]
  })
  figures[sex].grip = offsets
  // The handle: through the middle of the closed fingers, across the palm from the index finger to the little finger.
  figures[sex].handle = Object.fromEntries(
    Object.entries(hands).map(([side, h]) => {
      const pts = []
      for (const f of [2, 3, 4, 5]) {
        const chain = h.turns.get(`finger${f}-3.${SIDES[side]}`)
        for (const b of h.fingers[f]) pts.push(close(b.head, chain), close(b.tail, chain))
      }
      const mid = pts.reduce((c, q) => [c[0] + q[0] / pts.length, c[1] + q[1] / pts.length, c[2] + q[2] / pts.length], [0, 0, 0])
      return [side, { at: mid.map((x) => +x.toFixed(5)), axis: h.knuckles.map((x) => +x.toFixed(5)), palm: h.palm.map((x) => +x.toFixed(5)) }]
    }),
  )
}
console.log('grip', GRIP_VERTICES.length, 'finger vertices; handle', JSON.stringify(figures.male.handle.r))

// ---- how much room the body needs lying on its back and sitting ----

// Measured on the skinny and the built body: the skeleton takes the room between them by the
// figure's growth, so no figure floats above the floor or sinks into the stool.
const dominant = Array.from({ length: V }, (_, i) => BONES[[...perVertex[i].entries()].sort((a, b) => b[1] - a[1])[0][0]])
const TRUNK_BONES = new Set(['pelvis', 'torso', 'neck', 'head', 'rClavicle', 'lClavicle', 'rGlute', 'lGlute'])
const roomOf = (pos, j) => {
  const hipY = (j.rHip[1] + j.lHip[1]) / 2
  // Lying flat, the trunk turns until the shoulders are level with the hips (skeleton.ts, the crunch).
  const shoulder = [(j.rShoulder[2] + j.lShoulder[2]) / 2, (j.rShoulder[1] + j.lShoulder[1]) / 2 - hipY]
  const lean = Math.atan2(shoulder[0], shoulder[1])
  let lying = 0
  let seat = 0
  const thigh = sub(j.rKnee, j.rHip)
  const axis = unit(thigh)
  for (let i = 0; i < BODY_V; i++) {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]
    if (TRUNK_BONES.has(dominant[i])) lying = Math.max(lying, -(p[2] * Math.cos(lean) - (p[1] - hipY) * Math.sin(lean)))
    if (dominant[i] === 'rThigh') {
      const d = sub(p, j.rHip)
      const t = dot(d, axis) / len(thigh)
      // The back of the thigh, below the bone once the thigh is level.
      if (t > 0 && t < 0.6) seat = Math.max(seat, -sub(d, scale(axis, dot(d, axis)))[2])
    }
  }
  return { lying, seat }
}
// The figure between the sexes is their mean, mesh and joints alike (figure.ts, skeleton.ts): its
// room is measured on that mean body, not taken from either sex's.
const mean = (a, b) => a.map((x, i) => (x + b[i]) / 2)
const ROOM_FIGURES = {
  ...Object.fromEntries(SEXES.map((sex) => [sex, { states: figures[sex].states, joints: figures[sex].joints }])),
  neutral: {
    states: { skinny: mean(figures.female.states.skinny, figures.male.states.skinny), built: mean(figures.female.states.built, figures.male.states.built) },
    joints: Object.fromEntries(Object.keys(figures.female.joints).map((n) => [n, mean(figures.female.joints[n], figures.male.joints[n])])),
  },
}
const rooms = Object.fromEntries(
  Object.entries(ROOM_FIGURES).map(([figure, f]) => {
    const skinny = roomOf(f.states.skinny, f.joints)
    const built = roomOf(f.states.built, f.joints)
    return [figure, { lying: [+skinny.lying.toFixed(4), +built.lying.toFixed(4)], seat: [+skinny.seat.toFixed(4), +built.seat.toFixed(4)] }]
  }),
)

// ---- where each muscle lies ----

// Measured on the average of the two sexes at average muscle, so both sexes share one map.
const mid = new Float64Array(V * 3)
for (let i = 0; i < mid.length; i++) mid[i] = (figures.female.states.average[i] + figures.male.states.average[i]) / 2
const J = Object.fromEntries(Object.keys(JOINTS).map((n) => [n, figures.female.joints[n].map((x, k) => (x + figures.male.joints[n][k]) / 2)]))
const P = (i) => [mid[i * 3], mid[i * 3 + 1], mid[i * 3 + 2]]
const UP = [0, 1, 0]
const FRONT = [0, 0, 1]
const DOWN = [0, -1, 0]

/**
 * Each part's frame in the bind pose, as the scene sets it when posing: +Y along the bone, +Z its
 * front (the trunk's front carried round from hanging for a limb; the top of the foot), and which
 * side is outward. Local coordinates: t along the bone (0 at its first joint, 1 at its second),
 * c toward the outer side and s toward the front, both on the unit circle round the bone.
 */
function frame(from, to, front, mirror) {
  const y = unit(sub(J[to], J[from]))
  let z = sub(front, scale(y, dot(front, y)))
  z = unit(z)
  const x = cross(y, z)
  return { o: J[from], y, z, x: mirror ? scale(x, -1) : x, length: len(sub(J[to], J[from])) }
}
const limbFront = (from, to) => carry(DOWN, unit(sub(J[to], J[from])), FRONT)
const FRAMES = {
  torso: frame('pelvis', 'neck', FRONT, false),
  neck: frame('neck', 'headBase', FRONT, false),
  rUpperArm: frame('rShoulder', 'rElbow', limbFront('rShoulder', 'rElbow'), false),
  lUpperArm: frame('lShoulder', 'lElbow', limbFront('lShoulder', 'lElbow'), true),
  rForearm: frame('rElbow', 'rWrist', limbFront('rElbow', 'rWrist'), false),
  lForearm: frame('lElbow', 'lWrist', limbFront('lElbow', 'lWrist'), true),
  rThigh: frame('rHip', 'rKnee', limbFront('rHip', 'rKnee'), false),
  lThigh: frame('lHip', 'lKnee', limbFront('lHip', 'lKnee'), true),
  rShin: frame('rKnee', 'rAnkle', limbFront('rKnee', 'rAnkle'), false),
  lShin: frame('lKnee', 'lAnkle', limbFront('lKnee', 'lAnkle'), true),
}
function local(f, p) {
  const d = sub(p, f.o)
  const along = dot(d, f.y)
  const r = sub(d, scale(f.y, along))
  const rl = len(r) || 1
  return { t: along / f.length, c: dot(r, f.x) / rl, s: dot(r, f.z) / rl, r: rl }
}

const MUSCLES = ['chest', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'forearms', 'traps', 'upper_back', 'lats', 'lower_back', 'abs', 'obliques', 'glutes', 'quads', 'hamstrings', 'calves']
const M = Object.fromEntries(MUSCLES.map((m, i) => [m, i]))

/** Which part's map to read for a vertex: Arc's bones, with the helpers folded into their part. */
const PART_OF = {
  pelvis: 'pelvis', torso: 'torso', neck: 'neck', head: null, rUpperArm: 'rUpperArm', lUpperArm: 'lUpperArm', rForearm: 'rForearm', lForearm: 'lForearm',
  rHand: null, lHand: null, rThigh: 'rThigh', lThigh: 'lThigh', rShin: 'rShin', lShin: 'lShin', rFoot: null, lFoot: null,
  rClavicle: 'torso', lClavicle: 'torso', rDeltoid: 'rUpperArm', lDeltoid: 'lUpperArm', rGlute: 'pelvis', lGlute: 'pelvis',
}

/** Each part's muscles, as soft areas of (t, c, s); the pelvis reads height above the hip joints instead of t. */
const MAPS = {
  torso: {
    chest: (t, c, s) => along(t, 0.6, 0.87, 0.06) * smooth(0.3, 0.6, s) * smooth(0.02, 0.08, Math.abs(c)),
    abs: (t, c, s) => along(t, 0.06, 0.58, 0.06) * smooth(0.82, 0.93, s) * smooth(0.0, 0.04, Math.abs(c)),
    obliques: (t, c, s) => along(t, 0.04, 0.55, 0.07) * smooth(0.45, 0.75, Math.abs(c)) * smooth(-0.55, -0.2, s) * (1 - smooth(0.8, 0.92, s)),
    lats: (t, c, s) => along(t, 0.3, 0.8, 0.07) * smooth(0.35, 0.6, Math.abs(c)) * (1 - smooth(-0.05, 0.25, s)),
    upper_back: (t, c, s) => along(t, 0.56, 0.9, 0.06) * smooth(0.55, 0.8, -s),
    lower_back: (t, c, s) => along(t, -0.1, 0.48, 0.07) * smooth(0.72, 0.88, -s),
    traps: (t, c, s) => along(t, 0.84, 1.15, 0.06) * smooth(-0.55, -0.05, -s),
  },
  neck: { traps: (t, c, s) => along(t, -0.5, 0.55, 0.12) * smooth(-0.2, 0.3, -s) },
  pelvis: {
    glutes: (h, c, s) => along(h, -0.42, 0.22, 0.08) * smooth(0.05, 0.4, -s),
    lower_back: (h, c, s) => along(h, 0.12, 0.6, 0.08) * smooth(0.72, 0.88, -s),
    abs: (h, c, s) => along(h, 0.02, 0.5, 0.06) * smooth(0.82, 0.93, s) * smooth(0.0, 0.04, Math.abs(c)),
    obliques: (h, c, s) => along(h, 0.0, 0.5, 0.07) * smooth(0.45, 0.75, Math.abs(c)) * smooth(-0.55, -0.2, s),
  },
  upperArm: {
    front_delts: (t, c, s) => along(t, -0.3, 0.34, 0.07) * smooth(0.15, 0.5, s),
    side_delts: (t, c) => along(t, -0.3, 0.34, 0.07) * smooth(0.3, 0.65, c),
    rear_delts: (t, c, s) => along(t, -0.3, 0.34, 0.07) * smooth(0.15, 0.5, -s),
    biceps: (t, c, s) => along(t, 0.3, 0.9, 0.06) * smooth(0.25, 0.55, s),
    triceps: (t, c, s) => along(t, 0.22, 0.92, 0.06) * smooth(0.15, 0.45, -s),
  },
  forearm: { forearms: (t) => along(t, -0.05, 0.75, 0.08) },
  thigh: {
    quads: (t, c, s) => along(t, 0.04, 0.92, 0.06) * smooth(-0.35, 0.05, s),
    hamstrings: (t, c, s) => along(t, 0.12, 0.88, 0.06) * smooth(0.2, 0.5, -s),
    glutes: (t, c, s) => along(t, -0.25, 0.12, 0.06) * smooth(0.15, 0.45, -s),
  },
  shin: { calves: (t, c, s) => along(t, 0.04, 0.62, 0.06) * smooth(0.0, 0.35, -s) },
}
const MAP_OF = { torso: 'torso', neck: 'neck', pelvis: 'pelvis', rUpperArm: 'upperArm', lUpperArm: 'upperArm', rForearm: 'forearm', lForearm: 'forearm', rThigh: 'thigh', lThigh: 'thigh', rShin: 'shin', lShin: 'shin' }

const hipMid = [(J.rHip[0] + J.lHip[0]) / 2, (J.rHip[1] + J.lHip[1]) / 2, (J.rHip[2] + J.lHip[2]) / 2]
const masks = Array.from({ length: MUSCLES.length }, () => new Float64Array(V))
for (let i = 0; i < BODY_V; i++) {
  const p = P(i)
  // How much of the vertex each part holds, from the skin weights.
  const parts = new Map()
  for (const [b, w] of perVertex[i]) {
    const part = PART_OF[BONES[b]]
    if (part) parts.set(part, (parts.get(part) ?? 0) + w)
  }
  const total = [...perVertex[i].values()].reduce((s, w) => s + w, 0)
  for (const [part, w] of parts) {
    const share = w / total
    const map = MAPS[MAP_OF[part]]
    let coords
    if (part === 'pelvis') {
      const d = sub(p, hipMid)
      const r = Math.hypot(d[0], d[2]) || 1
      coords = { t: d[1], c: d[0] / r, s: d[2] / r }
    } else coords = local(FRAMES[part], p)
    for (const [muscle, mask] of Object.entries(map)) masks[M[muscle]][i] += share * mask(coords.t, coords.c, coords.s)
  }
}

// Neighbours, for smoothing the maps along the surface.
const neighbours = Array.from({ length: V }, () => new Set())
for (let k = 0; k < bodyTris.length; k += 3) {
  const [a, b, c] = [bodyTris[k], bodyTris[k + 1], bodyTris[k + 2]]
  neighbours[a].add(b).add(c)
  neighbours[b].add(a).add(c)
  neighbours[c].add(a).add(b)
}
const relax = (values, rounds) => {
  let cur = values
  for (let r = 0; r < rounds; r++) {
    const next = new Float64Array(V)
    for (let i = 0; i < V; i++) {
      let sum = cur[i]
      for (const n of neighbours[i]) sum += cur[n]
      next[i] = sum / (neighbours[i].size + 1)
    }
    cur = next
  }
  return cur
}
for (let m = 0; m < masks.length; m++) masks[m] = relax(masks[m], 6).map((w) => smooth(0.06, 0.55, w))

// Never more than all of a vertex: scale the groups down where they overlap.
for (let i = 0; i < V; i++) {
  let sum = 0
  for (const mk of masks) sum += Math.min(1, mk[i])
  for (const mk of masks) mk[i] = Math.min(1, mk[i]) / Math.max(1, sum)
}
const MASK_SLOTS = 3
const maskIndex = new Uint8Array(V * MASK_SLOTS).fill(255)
const maskWeight = new Uint8Array(V * MASK_SLOTS)
for (let i = 0; i < V; i++) {
  const top = masks
    .map((mk, m) => [m, mk[i]])
    .filter(([, w]) => w > 0.01)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MASK_SLOTS)
  top.forEach(([m, w], k) => {
    maskIndex[i * MASK_SLOTS + k] = m
    maskWeight[i * MASK_SLOTS + k] = Math.round(w * 255)
  })
}

// ---- clothes: shorts on everyone, a sports top on the female figure and the one between ----

const torsoT = (i) => local(FRAMES.torso, P(i)).t
/**
 * Each garment as a signed distance on the body, in body units: positive under it, negative off
 * it, zero on its hem. Straight measures (height on the trunk, length down the thigh), so the hem
 * cuts across the triangles in a clean line.
 */
const shorts = new Float64Array(V).fill(-1)
const top = new Float64Array(V).fill(-1)
// The waistband sits level a hand's width above the hip joints; the legs end a third of the way down the thigh.
const waistY = hipMid[1] + 0.42
const LEG_END = 0.31
const TOP = [0.47, 0.755]
for (let i = 0; i < BODY_V; i++) {
  const p = P(i)
  const part = dominant[i]
  // Only the trunk, the hips and the thighs: never a hand or a forearm that hangs beside them.
  if (['pelvis', 'torso', 'rGlute', 'lGlute'].includes(part)) shorts[i] = waistY - p[1]
  if (part === 'rThigh' || part === 'lThigh') {
    const l = local(FRAMES[`${part[0]}Thigh`], p)
    shorts[i] = Math.min(waistY - p[1], (LEG_END - l.t) * FRAMES[`${part[0]}Thigh`].length)
  }
  // The sports top: from under the bust to well above it, all the way round, below the armpits.
  if (part === 'torso' || part === 'rClavicle' || part === 'lClavicle') {
    const t = torsoT(i)
    top[i] = Math.min(t - TOP[0], TOP[1] - t) * FRAMES.torso.length
  }
}

/**
 * A garment: the surface of the body under it, cut cleanly where its coverage crosses one half,
 * so the hem runs smooth across the triangles rather than stepping round them. Each of its
 * vertices is a point of the body: on a body vertex, or part of the way along a body edge (a, b, s)
 * where the hem crosses it. The app lifts it off the skin along the normals, fills the hollows
 * under it (so nothing of the body's shape shows through where it should not), skins it with the
 * body and stops drawing the skin it covers entirely.
 */
function garment(field) {
  const m = field
  const inside = (v) => m[v] >= 0
  const points = []
  const index = new Map()
  const point = (a, b, s) => {
    if (a === b || s <= 0) return keep(a, a, 0)
    if (s >= 1) return keep(b, b, 0)
    return a < b ? keep(a, b, s) : keep(b, a, 1 - s)
  }
  const keep = (a, b, s) => {
    const key = a === b ? `${a}` : `${a},${b}`
    if (!index.has(key)) {
      index.set(key, points.length)
      points.push([a, b, s])
    }
    return index.get(key)
  }
  const cut = (a, b) => point(a, b, -m[a] / (m[b] - m[a]))
  const faces = []
  for (let k = 0; k < bodyTris.length; k += 3) {
    const t = [bodyTris[k], bodyTris[k + 1], bodyTris[k + 2]]
    const ins = t.map(inside)
    const n = ins.filter(Boolean).length
    if (n === 3) faces.push(point(t[0], t[0], 0), point(t[1], t[1], 0), point(t[2], t[2], 0))
    else if (n === 1) {
      // The corner inside, then the two cuts, in the triangle's own winding.
      const i = ins.indexOf(true)
      const [x, y, z] = [t[i], t[(i + 1) % 3], t[(i + 2) % 3]]
      faces.push(point(x, x, 0), cut(x, y), cut(x, z))
    } else if (n === 2) {
      // The two corners inside and the cuts toward the one outside: a quad, as two triangles.
      const j = ins.indexOf(false)
      const [x, y, z] = [t[(j + 1) % 3], t[(j + 2) % 3], t[j]]
      const yz = cut(y, z)
      const xz = cut(x, z)
      faces.push(point(x, x, 0), point(y, y, 0), yz, point(x, x, 0), yz, xz)
    }
  }
  return {
    a: Uint16Array.from(points, (p) => p[0]),
    b: Uint16Array.from(points, (p) => p[1]),
    // The share of the way from a to b, in 65,535ths.
    s: Uint16Array.from(points, (p) => Math.round(p[2] * 65535)),
    faces: Uint16Array.from(faces),
    // The hem: the points where the cut crosses an edge.
    hem: Uint8Array.from(points, (p) => (p[0] !== p[1] ? 1 : 0)),
  }
}
const GARMENTS = { shorts: garment(shorts), top: garment(top) }

// ---- write ----

const sections = []
let offset = 0
const chunks = []
function put(name, array, extra = {}) {
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength)
  // Keep every section aligned for typed-array views.
  const pad = (4 - (offset % 4)) % 4
  if (pad) {
    chunks.push(Buffer.alloc(pad))
    offset += pad
  }
  sections.push({ name, type: array.constructor.name.replace('Array', ''), offset, length: array.length, ...extra })
  chunks.push(bytes)
  offset += bytes.length
}
/** Positions to int16 over the box they span. */
function quantizePositions(a) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < a.length; i++) {
    min[i % 3] = Math.min(min[i % 3], a[i])
    max[i % 3] = Math.max(max[i % 3], a[i])
  }
  const q = new Int16Array(a.length)
  for (let i = 0; i < a.length; i++) q[i] = Math.round(((a[i] - min[i % 3]) / (max[i % 3] - min[i % 3])) * 65535) - 32768
  return { q, min: min.map((x) => +x.toFixed(6)), max: max.map((x) => +x.toFixed(6)) }
}
/** Offsets to int16 over their largest size. */
function quantizeOffsets(a) {
  let most = 0
  for (const x of a) most = Math.max(most, Math.abs(x))
  const step = most / 32767
  return { q: Int16Array.from(a, (x) => Math.round(x / step)), step: +step.toPrecision(8) }
}
for (const sex of SEXES) {
  const s = figures[sex].states
  const skinny = quantizePositions(s.skinny)
  put(`${sex}.skinny`, skinny.q, { min: skinny.min, max: skinny.max })
  const growth = quantizeOffsets(s.built.map((x, i) => x - s.skinny[i]))
  put(`${sex}.growth`, growth.q, { step: growth.step })
}
put('gripIndex', Uint16Array.from(GRIP_VERTICES))
for (const sex of SEXES) {
  const grip = quantizeOffsets(figures[sex].grip)
  put(`${sex}.grip`, grip.q, { step: grip.step })
}
put('index', Uint16Array.from([...bodyTris, ...eyeTris]))
put('skinIndex', skinIndex)
put('skinWeight', skinWeight)
put('maskIndex', maskIndex)
put('maskWeight', maskWeight)
for (const [name, g] of Object.entries(GARMENTS)) {
  put(`${name}.a`, g.a)
  put(`${name}.b`, g.b)
  put(`${name}.s`, g.s)
  put(`${name}.faces`, g.faces)
  put(`${name}.hem`, g.hem)
}
const bin = Buffer.concat(chunks)

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'body.bin'), bin)
const meta = {
  source: { project: 'MakeHuman', license: 'CC0 1.0', commit: MH_COMMIT },
  unitCm: 27,
  states: STATES,
  vertices: V,
  bodyVertices: BODY_V,
  bodyTriangles: bodyTris.length / 3,
  eyeTriangles: eyeTris.length / 3,
  bones: BONES,
  muscles: MUSCLES,
  maskSlots: MASK_SLOTS,
  garments: Object.fromEntries(Object.entries(GARMENTS).map(([name, g]) => [name, { vertices: g.a.length, triangles: g.faces.length / 3 }])),
  sha256: createHash('sha256').update(bin).digest('hex'),
  sections,
  joints: Object.fromEntries(SEXES.map((sex) => [sex, figures[sex].joints])),
  /** For each figure (the two sexes and their mean): the hip joints' height that keeps the back off the floor lying flat, and the thigh's depth below its bone: [skinny, built]. */
  room: rooms,
  /** For each sex and hand, in its bind pose: the handle's centre when the hand is closed, its line across the palm, and the palm's facing. */
  handle: Object.fromEntries(SEXES.map((sex) => [sex, figures[sex].handle])),
}
const ts = `// Written by scripts/body/bake.mjs from MakeHuman's CC0 assets; do not edit by hand.
// The layout of body.bin and each figure's joints in its bind pose, in body units of 27 cm.
export const BODY_META = ${JSON.stringify(meta, null, 2)} as const
`
writeFileSync(join(OUT, 'bodyMeta.ts'), ts)
console.log(`body.bin ${(bin.length / 1024).toFixed(0)} KB, ${V} vertices, ${meta.bodyTriangles + meta.eyeTriangles} triangles`)
for (const sex of SEXES) {
  const j = figures[sex].joints
  const d = (a, b) => len(sub(j[a], j[b])).toFixed(3)
  console.log(sex, 'height', Math.max(...bodyFaces.flat().map((v) => figures[sex].states.average[newIndex.get(v) * 3 + 1])).toFixed(3), 'upperArm', d('rShoulder', 'rElbow'), 'forearm', d('rElbow', 'rWrist'), 'hand', d('rWrist', 'rFingertip'), 'thigh', d('rHip', 'rKnee'), 'shin', d('rKnee', 'rAnkle'))
}
