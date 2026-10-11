import { EXERCISE_IDS, MUSCLE_IDS, type MuscleId } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { bindJoints, skeletonFor, type FigureKey, type V3 } from '../skeleton'
import bodyData from './body.bin?inline'
import { BODY_META } from './bodyMeta'
import { applyMat, bodyPositions, BONE_NAMES, decodeBody, facingFor, muscleLoad, paintBody, skin, skinMatrices, wearsTop, type Growth, type Palette } from './figure'

// body.bin as a data URL, decoded the way the browser receives it.
const asset = decodeBody(Uint8Array.from(atob(bodyData.slice(bodyData.indexOf(',') + 1)), (c) => c.charCodeAt(0)).buffer)
const V = asset.vertices
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
  const untrained = bodyPositions(asset, 'male', null)
  const j = bindJoints('male')
  const arm = ofBone('rUpperArm')
  const thigh = ofBone('rThigh')

  it('starts skinny and fills out as the muscle groups grow', () => {
    const full = bodyPositions(asset, 'male', grown(1))
    const before = radius(untrained, arm, j.rShoulder, j.rElbow)
    const after = radius(full, arm, j.rShoulder, j.rElbow)
    expect(after / before).toBeGreaterThan(1.15)
    expect(radius(full, thigh, j.rHip, j.rKnee) / radius(untrained, thigh, j.rHip, j.rKnee)).toBeGreaterThan(1.1)
  })

  it('grows only the groups that were trained', () => {
    const arms = bodyPositions(asset, 'male', grown(1, ['biceps', 'triceps']))
    expect(radius(arms, arm, j.rShoulder, j.rElbow) / radius(untrained, arm, j.rShoulder, j.rElbow)).toBeGreaterThan(1.08)
    expect(radius(arms, thigh, j.rHip, j.rKnee)).toBeCloseTo(radius(untrained, thigh, j.rHip, j.rKnee), 3)
  })

  it('grows a little with a little training, more with more', () => {
    const r = (level: number) => radius(bodyPositions(asset, 'male', grown(level)), arm, j.rShoulder, j.rElbow)
    expect(r(0.25)).toBeGreaterThan(r(0))
    expect(r(0.5)).toBeGreaterThan(r(0.25))
    expect(r(1)).toBeGreaterThan(r(0.5))
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

  it('carries each joint of the mesh to where the pose puts it, for every movement', () => {
    for (const figure of ['neutral', 'female', 'male'] as FigureKey[]) {
      const bind = bindJoints(figure)
      for (const exercise of EXERCISE_IDS) {
        const pose = skeletonFor(exercise, 60, figure)
        const matrices = skinMatrices(figure, pose)
        // A joint moves with the bone that starts there.
        for (const [bone, joint] of [
          ['rUpperArm', 'rShoulder'],
          ['rForearm', 'rElbow'],
          ['rHand', 'rWrist'],
          ['rThigh', 'rHip'],
          ['rShin', 'rKnee'],
          ['rFoot', 'rAnkle'],
          ['torso', 'pelvis'],
          ['head', 'headBase'],
        ] as const) {
          const m = matrices[BONE_NAMES.indexOf(bone)]!
          expect(dist(applyMat(m, bind[joint]), pose.joints[joint]), `${figure} ${exercise} ${joint}`).toBeLessThan(1e-3)
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

  it('keeps every movement on or above the floor', () => {
    const positions = bodyPositions(asset, 'male', grown(1))
    for (const exercise of EXERCISE_IDS) {
      const posed = skin(asset, positions, skinMatrices('male', skeletonFor(exercise, 60, 'male')))
      let lowest = Infinity
      for (let v = 0; v < asset.bodyVertices; v++) lowest = Math.min(lowest, posed[v * 3 + 1]!)
      expect(lowest, exercise).toBeGreaterThan(-0.06)
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
  })

  it('puts the chest on the front of the trunk and the lower back behind it', () => {
    const press = muscleLoad(asset, positions, 'chest_press')
    const torso = ofBone('torso')
    expect(Math.max(...torso.filter((v) => positions[v * 3 + 2]! > 0.25).map((v) => press.primary[v]!))).toBeGreaterThan(0.9)
    expect(Math.max(...torso.filter((v) => positions[v * 3 + 2]! < -0.2).map((v) => press.primary[v]!))).toBeLessThan(0.1)
  })

  it('dresses each figure: shorts on everyone, a sports top on the female and the neutral figure', () => {
    const palette: Palette = { skin: [1, 1, 1], cloth: [0, 0, 0], eye: [0, 0, 1], target: [1, 0, 0], helper: [1, 1, 0], grown: [0, 0, 1] }
    const chest = ofBone('torso').filter((v) => asset.top[v]! > 0.99)
    expect(chest.length).toBeGreaterThan(50)
    expect(wearsTop('male')).toBe(false)
    const male = paintBody(asset, positions, 'male', palette, null)
    const female = paintBody(asset, positions, 'female', palette, null)
    expect(male[chest[0]! * 3]).toBeGreaterThan(0.9)
    expect(female[chest[0]! * 3]).toBeLessThan(0.2)
    const hips = ofBone('pelvis').filter((v) => asset.shorts[v]! > 0.99)
    expect(hips.length).toBeGreaterThan(50)
    expect(male[hips[0]! * 3]).toBeLessThan(0.2)
  })

  it('turns a back exercise to show its back, and a front one three-quarters from the front', () => {
    expect(facingFor('deadlift')).toBeGreaterThan(0)
    expect(facingFor('bent_over_row')).toBeGreaterThan(0)
    expect(facingFor('elbow_flexion')).toBeLessThan(0)
    expect(facingFor('squat')).toBeLessThan(0)
  })
})
