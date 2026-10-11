import { EXERCISE_IDS, EXERCISES, MUSCLE_IDS, type ExerciseId, type MuscleId } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { bindJoints, BONES, PROPORTIONS, restFor, skeletonFor, type FigureKey, type JointName, type V3 } from '../skeleton'
import bodyData from './body.bin?inline'
import { BODY_META } from './bodyMeta'
import { applyMat, bodyPositions, BONE_NAMES, decodeBody, facingFor, GARMENT_LIFT, garmentPositions, garmentsOf, handleOf, muscleLoad, paintBody, paintGarment, skin, skinMatrices, vertexNormals, visibleTriangles, wearsTop, type Growth, type Mat4, type Palette } from './figure'
import { HOLDS } from './hold'

// body.bin as a data URL, decoded the way the browser receives it.
const bytes = Uint8Array.from(atob(bodyData.slice(bodyData.indexOf(',') + 1)), (c) => c.charCodeAt(0))
const asset = decodeBody(bytes.buffer)
const V = asset.vertices
const FIGURES: FigureKey[] = ['female', 'male', 'neutral']
/** Seven readings from rest to the furthest each movement shows. */
const readings = (e: ExerciseId) => Array.from({ length: 7 }, (_, i) => EXERCISES[e].restDeg + ((EXERCISES[e].maxDeg - EXERCISES[e].restDeg) * i) / 6)
const PALETTE: Palette = { skin: [1, 1, 1], eye: [0, 0, 1], target: [1, 0, 0], helper: [1, 1, 0], grown: [0, 0, 1], fabric: { shorts: [0, 0, 0.2], top: [0, 0.2, 0] } }
/** The body vertices lying mostly (`over`) in one muscle group. */
const inGroup = (m: MuscleId, over = 0.8, vs?: number[]) =>
  (vs ?? Array.from({ length: asset.bodyVertices }, (_, v) => v)).filter((v) => [0, 1, 2].some((k) => asset.maskIndex[v * 3 + k] === MUSCLE_IDS.indexOf(m) && asset.maskWeight[v * 3 + k]! > over))
/** The lowest point of a set of posed vertices (all of the body by default). */
const lowestOf = (posed: Float32Array, vs?: number[]) => {
  let y = Infinity
  if (vs) for (const v of vs) y = Math.min(y, posed[v * 3 + 1]!)
  else for (let v = 0; v < asset.bodyVertices; v++) y = Math.min(y, posed[v * 3 + 1]!)
  return y
}
/** The angle, in degrees, of the rotation that takes one skin matrix's turn to another's. */
const turnBetween = (a: Mat4, b: Mat4) => {
  // trace(Aᵀ·B) over the upper 3x3, each column normalised so a bone's stretch does not count.
  let trace = 0
  for (let c = 0; c < 3; c++) {
    const la = Math.hypot(a[c * 4]!, a[c * 4 + 1]!, a[c * 4 + 2]!)
    const lb = Math.hypot(b[c * 4]!, b[c * 4 + 1]!, b[c * 4 + 2]!)
    for (let r = 0; r < 3; r++) trace += (a[c * 4 + r]! / la) * (b[c * 4 + r]! / lb)
  }
  return (Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2))) * 180) / Math.PI
}
const at = (a: Float32Array, v: number): V3 => [a[v * 3]!, a[v * 3 + 1]!, a[v * 3 + 2]!]
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const grown = (level: number, only?: MuscleId[]): Growth => ({ levels: Object.fromEntries(MUSCLE_IDS.map((m) => [m, !only || only.includes(m) ? level : 0])), overall: only ? 0 : level })

/** The vertices whose heaviest bone is `bone`. */
const ofBone = (bone: string) => {
  const b = BONE_NAMES.indexOf(bone as (typeof BONE_NAMES)[number])
  return Array.from({ length: asset.bodyVertices }, (_, v) => v).filter((v) => asset.skinIndex[v * 4] === b)
}
/** Mean distance of a set of vertices from the line between two joints: a limb's girth, as a radius. */
const radius = (positions: Float32Array, vs: number[], a: V3, b: V3) => {
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const l = Math.hypot(...d)
  let sum = 0
  for (const v of vs) {
    const p = at(positions, v)
    const r: V3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
    const t = (r[0] * d[0] + r[1] * d[1] + r[2] * d[2]) / l
    sum += Math.sqrt(Math.max(0, r[0] ** 2 + r[1] ** 2 + r[2] ** 2 - t * t))
  }
  return sum / vs.length
}

describe('the baked body', () => {
  it('is the very file the bake wrote', async () => {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    expect([...digest].map((b) => b.toString(16).padStart(2, '0')).join('')).toBe(BODY_META.sha256)
  })

  it('is what the bake says it is: every section in place, every triangle on a real vertex', () => {
    expect(BODY_META.source.license).toBe('CC0 1.0')
    expect(V).toBe(BODY_META.vertices)
    expect(asset.index.length).toBe((BODY_META.bodyTriangles + BODY_META.eyeTriangles) * 3)
    expect(Math.max(...asset.index)).toBeLessThan(V)
    expect(asset.maskIndex.every((g) => g === 255 || g < MUSCLE_IDS.length)).toBe(true)
    expect(BODY_META.muscles).toEqual([...MUSCLE_IDS])
  })

  it('weights every vertex to Arc\'s bones, the weights adding to one', () => {
    const wrong: number[] = []
    for (let v = 0; v < V; v++) {
      let sum = 0
      for (let k = 0; k < 4; k++) {
        sum += asset.skinWeight[v * 4 + k]!
        if (asset.skinIndex[v * 4 + k]! >= BONE_NAMES.length) wrong.push(v)
      }
      if (Math.abs(sum - 1) > 1e-5) wrong.push(v)
    }
    expect(wrong).toEqual([])
  })

  it('has a young adult\'s height and proportions for each sex', () => {
    for (const [sex, lo, hi] of [
      ['female', 155, 165],
      ['male', 168, 180],
    ] as const) {
      const ys = Array.from({ length: asset.bodyVertices }, (_, v) => asset.shapes[sex].skinny[v * 3 + 1]!)
      const cm = (Math.max(...ys) - Math.min(...ys)) * BODY_META.unitCm
      expect(cm, sex).toBeGreaterThan(lo)
      expect(cm, sex).toBeLessThan(hi)
      // Standing on the floor.
      expect(Math.min(...ys), sex).toBeCloseTo(0, 2)
    }
  })
})

describe('the shape: skinny untrained, built by training', () => {
  const arm = ofBone('rUpperArm')
  const thigh = ofBone('rThigh')

  it.each(FIGURES)('starts skinny and fills out as the muscle groups grow (%s)', (figure) => {
    const j = bindJoints(figure)
    const untrained = bodyPositions(asset, figure, null)
    const full = bodyPositions(asset, figure, grown(1))
    expect(radius(full, arm, j.rShoulder, j.rElbow) / radius(untrained, arm, j.rShoulder, j.rElbow)).toBeGreaterThan(1.15)
    expect(radius(full, thigh, j.rHip, j.rKnee) / radius(untrained, thigh, j.rHip, j.rKnee)).toBeGreaterThan(1.1)
  })

  it.each(FIGURES)('grows only the groups that were trained (%s)', (figure) => {
    const j = bindJoints(figure)
    const untrained = bodyPositions(asset, figure, null)
    const arms = bodyPositions(asset, figure, grown(1, ['biceps', 'triceps']))
    expect(radius(arms, arm, j.rShoulder, j.rElbow) / radius(untrained, arm, j.rShoulder, j.rElbow)).toBeGreaterThan(1.08)
    expect(radius(arms, thigh, j.rHip, j.rKnee)).toBeCloseTo(radius(untrained, thigh, j.rHip, j.rKnee), 3)
  })

  it.each(FIGURES)('grows a little with a little training, more with more (%s)', (figure) => {
    const j = bindJoints(figure)
    const r = (level: number) => radius(bodyPositions(asset, figure, grown(level)), arm, j.rShoulder, j.rElbow)
    expect(r(0.25)).toBeGreaterThan(r(0))
    expect(r(0.5)).toBeGreaterThan(r(0.25))
    expect(r(1)).toBeGreaterThan(r(0.5))
  })

  it('grows the trunk group by group: a chest built by presses leaves the upper back as it was', () => {
    const untrained = bodyPositions(asset, 'male', null)
    const chest = bodyPositions(asset, 'male', grown(1, ['chest']))
    const moved = (vs: number[]) => vs.reduce((sum, v) => sum + Math.hypot(chest[v * 3]! - untrained[v * 3]!, chest[v * 3 + 1]! - untrained[v * 3 + 1]!, chest[v * 3 + 2]! - untrained[v * 3 + 2]!), 0) / vs.length
    const front = inGroup('chest')
    const back = ofBone('torso').filter((v) => untrained[v * 3 + 2]! < -0.2)
    expect(front.length).toBeGreaterThan(50)
    expect(back.length).toBeGreaterThan(50)
    expect(moved(front)).toBeGreaterThan(0.01)
    expect(moved(back)).toBe(0)
  })

  it('draws the figure between the sexes as their mean', () => {
    const f = bodyPositions(asset, 'female', null)
    const m = bodyPositions(asset, 'male', null)
    const n = bodyPositions(asset, 'neutral', null)
    for (const v of [0, 500, 6000, 13000]) for (let k = 0; k < 3; k++) expect(n[v * 3 + k]).toBeCloseTo((f[v * 3 + k]! + m[v * 3 + k]!) / 2, 5)
  })
})

describe('the skin', () => {
  it('leaves the body where it is in its own bind pose', () => {
    for (const figure of ['female', 'male'] as FigureKey[]) {
      const joints = bindJoints(figure)
      const matrices = skinMatrices(figure, { joints, view: 'front' })
      for (const m of matrices) {
        const p = applyMat(m, [0.3, 3.1, -0.2])
        expect(dist(p, [0.3, 3.1, -0.2])).toBeLessThan(1e-4)
      }
    }
  })

  it('carries both ends of every bone to where the pose puts them, for every movement at every reading', () => {
    // The sixteen bones, and the collarbones the shoulders turn on.
    const bones: [string, JointName, JointName][] = [...BONES.map((b): [string, JointName, JointName] => [b.name, b.from, b.to]), ['rClavicle', 'rClavicle', 'rShoulder'], ['lClavicle', 'lClavicle', 'lShoulder']]
    for (const figure of FIGURES) {
      const bind = bindJoints(figure) as Record<JointName, V3>
      for (const exercise of EXERCISE_IDS) {
        for (const deg of readings(exercise)) {
          const pose = skeletonFor(exercise, deg, figure)
          const matrices = skinMatrices(figure, pose)
          for (const [bone, from, to] of bones) {
            const m = matrices[BONE_NAMES.indexOf(bone as (typeof BONE_NAMES)[number])]!
            for (const joint of [from, to]) expect(dist(applyMat(m, bind[joint]), pose.joints[joint]), `${figure} ${exercise} ${deg}° ${bone} ${joint}`).toBeLessThan(1e-4)
          }
        }
      }
    }
  })

  it('turns each limb about its own length the right way: the biceps faces forward in a curl', () => {
    // Side on, the body faces +X: the biceps is in front of the bone, the triceps behind it.
    for (const figure of FIGURES) {
      const positions = bodyPositions(asset, figure, null)
      const posed = skin(asset, positions, skinMatrices(figure, skeletonFor('elbow_flexion', 90, figure)))
      const arm = ofBone('rUpperArm')
      const meanX = (vs: number[]) => vs.reduce((sum, v) => sum + posed[v * 3]!, 0) / vs.length
      const biceps = inGroup('biceps', 0.8, arm)
      const triceps = inGroup('triceps', 0.8, arm)
      expect(biceps.length, figure).toBeGreaterThan(10)
      expect(triceps.length, figure).toBeGreaterThan(10)
      expect(meanX(biceps) - meanX(triceps), figure).toBeGreaterThan(0.1)
    }
  })

  it('keeps the pelvis flat on the floor while a crunch curls the trunk up', () => {
    const pelvis = BONE_NAMES.indexOf('pelvis')
    for (const figure of FIGURES) {
      const [a, ...rest] = [15, 40, 65].map((deg) => skinMatrices(figure, skeletonFor('crunch', deg, figure))[pelvis]!)
      for (const m of rest) for (let i = 0; i < 16; i++) expect(m[i]!, `${figure} [${i}]`).toBeCloseTo(a![i]!, 6)
    }
  })

  it('turns the helpers part of the way between their bones, so the shoulders and hips fold smoothly', () => {
    const index = (bone: string) => BONE_NAMES.indexOf(bone as (typeof BONE_NAMES)[number])
    // Together these reach every branch of the rotation maths.
    for (const [exercise, deg] of [
      ['shoulder_press', 175],
      ['squat', 120],
      ['crunch', 65],
    ] as const) {
      for (const figure of FIGURES) {
        const pose = skeletonFor(exercise, deg, figure)
        const m = skinMatrices(figure, pose)
        const bind = bindJoints(figure) as Record<JointName, V3>
        for (const [helper, from, to, joint, share] of [
          ['rDeltoid', 'rClavicle', 'rUpperArm', 'rShoulder', 0.5],
          ['lDeltoid', 'lClavicle', 'lUpperArm', 'lShoulder', 0.5],
          ['rGlute', 'pelvis', 'rThigh', 'rHip', 0.35],
          ['lGlute', 'pelvis', 'lThigh', 'lHip', 0.35],
        ] as const) {
          const whole = turnBetween(m[index(from)]!, m[index(to)]!)
          const label = `${figure} ${exercise} ${helper}`
          if (whole > 5) expect(turnBetween(m[index(from)]!, m[index(helper)]!) / whole, label).toBeCloseTo(share, 2)
          // The helper turns about the joint it shares: the joint lands where the pose puts it.
          expect(dist(applyMat(m[index(helper)]!, bind[joint]), pose.joints[joint]), label).toBeLessThan(1e-4)
        }
      }
    }
  })

  it('bends the elbow in a curl: the hand rises to where the pose puts the wrist', () => {
    const positions = bodyPositions(asset, 'neutral', null)
    const pose = skeletonFor('elbow_flexion', 140)
    const posed = skin(asset, positions, skinMatrices('neutral', pose))
    const hand = ofBone('rHand')
    const centre = hand.reduce<V3>((c, v) => [c[0] + posed[v * 3]! / hand.length, c[1] + posed[v * 3 + 1]! / hand.length, c[2] + posed[v * 3 + 2]! / hand.length], [0, 0, 0])
    // The hand sits around its bone, from the wrist toward the knuckles and the fingers beyond.
    expect(dist(centre, pose.joints.rFingertip)).toBeLessThan(0.4)
    expect(centre[1]).toBeGreaterThan(pose.joints.rElbow[1])
  })

  it('stands, sits and lies on the floor, skinny or built: the soles just touching, the back flat on it', () => {
    for (const figure of FIGURES) {
      for (const [growth, fill] of [
        [null, 0],
        [grown(1), 1],
      ] as const) {
        const positions = bodyPositions(asset, figure, growth)
        for (const exercise of EXERCISE_IDS) {
          for (const deg of readings(exercise)) {
            const lowest = lowestOf(skin(asset, positions, skinMatrices(figure, skeletonFor(exercise, deg, figure, fill))))
            const label = `${figure} ${fill ? 'built' : 'skinny'} ${exercise} ${deg}°`
            if (exercise === 'crunch') {
              // Lying flat at rest, the back on the floor; curled up, the seat on it.
              expect(lowest, label).toBeGreaterThanOrEqual(0)
              expect(lowest, label).toBeLessThan(deg === restFor('crunch') ? 0.025 : 0.06)
            } else {
              // The soles press a few millimetres into the floor, never more.
              expect(lowest, label).toBeGreaterThanOrEqual(-0.035)
              expect(lowest, label).toBeLessThanOrEqual(0)
            }
          }
        }
      }
    }
  })

  it('sits on the stool, skinny or built: the thighs on its top, never floating above it', () => {
    const under = [...ofBone('rThigh'), ...ofBone('lThigh'), ...ofBone('rGlute'), ...ofBone('lGlute')]
    for (const figure of FIGURES) {
      for (const fill of [0, 0.5, 1]) {
        const pose = skeletonFor('seated_knee_extension', 90, figure, fill)
        const posed = skin(asset, bodyPositions(asset, figure, fill ? grown(fill) : null), skinMatrices(figure, pose))
        const onSeat = under.filter((v) => posed[v * 3]! > pose.seat!.x[0] && posed[v * 3]! < pose.seat!.x[1])
        const gap = lowestOf(posed, onSeat) - pose.seat!.top
        expect(gap, `${figure} ${fill}`).toBeGreaterThan(-0.06)
        expect(gap, `${figure} ${fill}`).toBeLessThan(0.02)
      }
    }
  })
})

describe('the hands: closed round what they hold', () => {
  /** The real fingertips: the hand's vertices farthest from the wrist. */
  const tips = (side: 'r' | 'l') => {
    const wrist = bindJoints('male')[side === 'r' ? 'rWrist' : 'lWrist']
    const hand = [...asset.grip.index].filter((_, n) => asset.grip.side[n] === (side === 'r' ? 0 : 1))
    return hand.sort((a, b) => dist(at(asset.shapes.male.skinny, b), wrist) - dist(at(asset.shapes.male.skinny, a), wrist)).slice(0, 40)
  }

  it('closes each hand round its handle, the other hand untouched', () => {
    const open = bodyPositions(asset, 'male', null)
    const closed = bodyPositions(asset, 'male', null, undefined, { right: 1, left: 0 })
    const handle = handleOf('male', 'r').at
    const right = tips('r')
    const left = tips('l')
    expect(right.length).toBeGreaterThan(5)
    // The fingertips come in to the handle, within a hand's breadth of its centre.
    for (const v of right) {
      expect(dist(at(closed, v), handle), `vertex ${v}`).toBeLessThan(dist(at(open, v), handle))
      expect(dist(at(closed, v), handle), `vertex ${v}`).toBeLessThan(0.45)
    }
    for (const v of left) expect(at(closed, v)).toEqual(at(open, v))
    // Nothing above the wrist moves.
    const forearm = ofBone('rForearm')
    for (const v of forearm.slice(0, 200)) expect(at(closed, v)).toEqual(at(open, v))
  })

  it('turns each hand about its forearm so the handle lies as the movement holds it, the wrist where it was', () => {
    for (const [exercise, deg] of [
      ['shoulder_press', 150],
      ['front_raise', 80],
      ['bent_over_row', 100],
      ['pec_fly', 150],
    ] as const) {
      for (const figure of ['female', 'male', 'neutral'] as FigureKey[]) {
        const pose = skeletonFor(exercise, deg, figure)
        const line = HOLDS[exercise].line!
        const plain = skinMatrices(figure, pose)
        const turned = skinMatrices(figure, pose, { r: line })
        const hand = BONE_NAMES.indexOf('rHand')
        const h = handleOf(figure, 'r')
        const a = applyMat(turned[hand]!, h.at)
        const b = applyMat(turned[hand]!, [h.at[0] + h.axis[0], h.at[1] + h.axis[1], h.at[2] + h.axis[2]])
        const axis: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
        const j = pose.joints
        const across: V3 = [j.lShoulder[0] - j.rShoulder[0], j.lShoulder[1] - j.rShoulder[1], j.lShoulder[2] - j.rShoulder[2]]
        const upright: V3 = [j.neck[0] - j.pelvis[0], j.neck[1] - j.pelvis[1], j.neck[2] - j.pelvis[2]]
        const forward: V3 = [across[1] * upright[2] - across[2] * upright[1], across[2] * upright[0] - across[0] * upright[2], across[0] * upright[1] - across[1] * upright[0]]
        const fore: V3 = [j.rWrist[0] - j.rElbow[0], j.rWrist[1] - j.rElbow[1], j.rWrist[2] - j.rElbow[2]]
        // Compared square to the forearm, where a wrist can turn it: the handle along the wanted line.
        const flat = (v: V3) => {
          const n = Math.hypot(...fore)
          const k = (v[0] * fore[0] + v[1] * fore[1] + v[2] * fore[2]) / (n * n)
          const w: V3 = [v[0] - fore[0] * k, v[1] - fore[1] * k, v[2] - fore[2] * k]
          const l = Math.hypot(...w)
          return w.map((x) => x / l) as V3
        }
        const want = flat(line === 'across' ? across : line === 'forward' ? forward : upright)
        const got = flat(axis)
        expect(Math.abs(got[0] * want[0] + got[1] * want[1] + got[2] * want[2]), `${figure} ${exercise}`).toBeGreaterThan(0.999)
        // The turn is about the forearm: the wrist and the elbow stay where the pose puts them.
        const bind = bindJoints(figure)
        expect(dist(applyMat(turned[hand]!, bind.rWrist), applyMat(plain[hand]!, bind.rWrist))).toBeLessThan(1e-4)
        expect(dist(applyMat(turned[BONE_NAMES.indexOf('rForearm')]!, bind.rElbow), pose.joints.rElbow)).toBeLessThan(1e-4)
      }
    }
  })

  it('holds weights in the working hand of a one-arm movement and in both for a two-arm one', () => {
    for (const exercise of EXERCISE_IDS) {
      const hold = HOLDS[exercise]
      if (EXERCISES[exercise].sided) expect(hold.left, exercise).toBeNull()
      if (hold.right || hold.left || hold.bar) expect(hold.grip.right, exercise).toBe(1)
      if (hold.left || hold.bar) expect(hold.grip.left, exercise).toBe(1)
    }
  })
})

describe('the paint', () => {
  const positions = bodyPositions(asset, 'neutral', null)
  const loadOn = (exercise: (typeof EXERCISE_IDS)[number], bone: string) => {
    const load = muscleLoad(asset, positions, exercise)
    const vs = ofBone(bone)
    return { primary: Math.max(...vs.map((v) => load.primary[v]!)), secondary: Math.max(...vs.map((v) => load.secondary[v]!)) }
  }

  it('paints a curl on the working arm only: biceps red, forearm yellow', () => {
    expect(loadOn('elbow_flexion', 'rUpperArm').primary).toBeGreaterThan(0.9)
    expect(loadOn('elbow_flexion', 'rForearm').secondary).toBeGreaterThan(0.9)
    expect(loadOn('elbow_flexion', 'lUpperArm').primary).toBe(0)
    // The biceps on the front of the arm, not the back.
    const load = muscleLoad(asset, positions, 'elbow_flexion')
    const front = ofBone('rUpperArm').filter((v) => positions[v * 3 + 2]! > 0.15)
    const back = ofBone('rUpperArm').filter((v) => positions[v * 3 + 2]! < -0.1)
    expect(Math.max(...front.map((v) => load.primary[v]!))).toBeGreaterThan(0.9)
    expect(Math.max(...back.map((v) => load.primary[v]!))).toBeLessThan(0.2)
  })

  it('puts the quads on the front of the thighs and the hamstrings behind', () => {
    const load = muscleLoad(asset, positions, 'squat')
    const thigh = ofBone('lThigh')
    const front = thigh.filter((v) => positions[v * 3 + 2]! > 0.2)
    const back = thigh.filter((v) => positions[v * 3 + 2]! < -0.15)
    expect(Math.max(...front.map((v) => load.primary[v]!))).toBeGreaterThan(0.9)
    expect(Math.max(...back.map((v) => load.secondary[v]!))).toBeGreaterThan(0.9)
    // A knee extension works the quads alone: red on the front of the thigh, nothing behind it.
    const extension = muscleLoad(asset, positions, 'seated_knee_extension')
    const rThigh = ofBone('rThigh')
    expect(Math.max(...rThigh.filter((v) => positions[v * 3 + 2]! > 0.2).map((v) => extension.primary[v]!))).toBeGreaterThan(0.9)
    expect(Math.max(...rThigh.filter((v) => positions[v * 3 + 2]! < -0.15).map((v) => extension.primary[v]!))).toBeLessThan(0.2)
  })

  it('colours what is shown: the muscles an exercise works, or how far each group has grown', () => {
    const quads = inGroup('quads')
    const biceps = inGroup('biceps', 0.95)
    // An exercise: its targets red over the skin.
    const squat = paintBody(asset, positions, PALETTE, { exercise: 'squat' })
    const red = quads.filter((v) => squat[v * 3]! > 0.9 && squat[v * 3 + 1]! < 0.2)
    expect(red.length).toBeGreaterThan(quads.length / 2)
    // The growth map: a fully grown group deep blue, an untrained one left as skin.
    const map = paintBody(asset, positions, PALETTE, { growth: grown(1, ['biceps']) })
    for (const v of biceps) expect(map[v * 3]!, `vertex ${v}`).toBeLessThan(0.2)
    for (const v of quads.slice(0, 50)) expect([map[v * 3], map[v * 3 + 1], map[v * 3 + 2]]).toEqual([1, 1, 1])
  })

  it('puts the chest on the front of the trunk and the lower back behind it', () => {
    const press = muscleLoad(asset, positions, 'chest_press')
    const torso = ofBone('torso')
    expect(Math.max(...torso.filter((v) => positions[v * 3 + 2]! > 0.25).map((v) => press.primary[v]!))).toBeGreaterThan(0.9)
    expect(Math.max(...torso.filter((v) => positions[v * 3 + 2]! < -0.2).map((v) => press.primary[v]!))).toBeLessThan(0.1)
  })

  it('dresses each figure: shorts on everyone, a sports top on the female figure and the one between', () => {
    expect(garmentsOf('male')).toEqual(['shorts'])
    expect(garmentsOf('female')).toEqual(['shorts', 'top'])
    expect(garmentsOf('neutral')).toEqual(['shorts', 'top'])
    expect(wearsTop('neutral')).toBe(true)
    expect(wearsTop('male')).toBe(false)
    const { shorts, top } = asset.garments
    // Every triangle on its own vertices, every vertex on a body vertex, a hem round the edge.
    for (const g of [shorts, top]) {
      expect(Math.max(...g.faces)).toBeLessThan(g.a.length)
      expect(Math.max(...g.a, ...g.b)).toBeLessThan(asset.bodyVertices)
      expect(g.s.every((s) => s >= 0 && s <= 1)).toBe(true)
      // The hem is exactly the points cut along an edge.
      g.hem.forEach((h, i) => expect(h === 1).toBe(g.a[i] !== g.b[i]))
      expect(g.hem.some(Boolean)).toBe(true)
    }
    // The shorts cover the hips between the legs; the top the chest.
    const hips = bodyPositions(asset, 'male', null)
    const crotch = [...shorts.a].filter((v) => Math.abs(hips[v * 3]!) < 0.05 && hips[v * 3 + 1]! < PROPORTIONS.male.hipY && hips[v * 3 + 2]! > -0.05)
    expect(crotch.length).toBeGreaterThan(0)
    const chest = [...top.a].filter((v) => hips[v * 3 + 2]! > 0.3)
    expect(chest.length).toBeGreaterThan(10)
  })

  it('lifts the clothes off the skin and fills the hollows under them, never sinking into the body', () => {
    const positions = bodyPositions(asset, 'female', grown(0.6))
    const normals = vertexNormals(positions, asset.index)
    for (const name of ['shorts', 'top'] as const) {
      const g = asset.garments[name]
      const cloth = garmentPositions(g, positions, normals, GARMENT_LIFT[name])
      let lowest = Infinity
      let filled = 0
      g.a.forEach((v, i) => {
        if (g.hem[i]) return
        const along = (k: number) => cloth[i * 3 + k]! - positions[v * 3 + k]!
        const out = along(0) * normals[v * 3]! + along(1) * normals[v * 3 + 1]! + along(2) * normals[v * 3 + 2]!
        // Near the hem, where the skin is drawn, never inside it.
        if (g.ring[i]! < 3) lowest = Math.min(lowest, out)
        if (out > GARMENT_LIFT[name] + 0.01) filled++
      })
      expect(lowest, name).toBeGreaterThanOrEqual(GARMENT_LIFT[name] - 1e-5)
      // The shorts fill the hollow between the legs.
      if (name === 'shorts') expect(filled).toBeGreaterThan(0)
    }
  })

  it('stops drawing the skin under the clothes, but never at the hem, and keeps the eyes', () => {
    const all = asset.index.length / 3
    const male = visibleTriangles(asset, 'male').length / 3
    const female = visibleTriangles(asset, 'female').length / 3
    expect(male).toBeLessThan(all)
    expect(female).toBeLessThan(male)
    // A triangle the hem crosses stays: the skin meets the fabric with no gap.
    const shorts = asset.garments.shorts
    const cut = shorts.hem.indexOf(1)
    const drawn = visibleTriangles(asset, 'male')
    expect([...drawn].includes(shorts.a[cut]!) && [...drawn].includes(shorts.b[cut]!)).toBe(true)
    // The eyes are drawn for everyone.
    expect(Math.max(...drawn)).toBeGreaterThanOrEqual(asset.bodyVertices)
  })

  it('paints the fabric with the muscles under it, like the skin', () => {
    const palette = PALETTE
    const positions = bodyPositions(asset, 'neutral', null)
    const plain = paintGarment(asset, 'shorts', positions, palette, null)
    expect([plain[0], plain[1], plain[2]]).toEqual([0, 0, expect.closeTo(0.2, 5)])
    const squat = paintGarment(asset, 'shorts', positions, palette, { exercise: 'squat' })
    // The quads and glutes under the shorts show red through the fabric.
    let reddest = 0
    for (let i = 0; i < squat.length; i += 3) reddest = Math.max(reddest, squat[i]!)
    expect(reddest).toBeGreaterThan(0.6)
    const skin = paintBody(asset, positions, palette, null)
    expect([skin[0], skin[1], skin[2]]).toEqual([1, 1, 1])
  })

  it('turns a back exercise to show its back, and a front one three-quarters from the front', () => {
    expect(facingFor('deadlift')).toBeGreaterThan(0)
    expect(facingFor('bent_over_row')).toBeGreaterThan(0)
    expect(facingFor('elbow_flexion')).toBeLessThan(0)
    expect(facingFor('squat')).toBeLessThan(0)
  })
})
