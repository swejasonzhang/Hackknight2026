import { describe, expect, it } from 'vitest'
import { buildShape, facingFor, muscleLoad, SHAPES, type Built, type ShapeName } from './anatomy'

const built = Object.fromEntries((Object.keys(SHAPES) as ShapeName[]).map((k) => [k, buildShape(SHAPES[k])])) as Record<ShapeName, Built>

/** The vertices nearest a place on a part: `t` along the bone, `c` toward +X, `s` toward the front. */
function near(b: Built, t: number, c: number, s: number): number[] {
  const out: number[] = []
  for (let i = 0; i < b.t.length; i++) if (Math.abs(b.t[i]! - t) < 0.05 && Math.hypot(b.c[i]! - c, b.s[i]! - s) < 0.25) out.push(i)
  expect(out.length).toBeGreaterThan(0)
  return out
}
const at = (load: Float32Array, idx: number[]) => Math.min(...idx.map((i) => load[i]!))
const most = (load: Float32Array, idx: number[]) => Math.max(...idx.map((i) => load[i]!))

describe('the body surface', () => {
  it('closes every part: each edge is shared by exactly two triangles', () => {
    for (const [name, b] of Object.entries(built)) {
      const index = b.geometry.getIndex()!.array
      const edges = new Map<string, number>()
      for (let i = 0; i < index.length; i += 3) {
        const tri = [index[i]!, index[i + 1]!, index[i + 2]!]
        for (let k = 0; k < 3; k++) {
          const a = tri[k]!
          const c = tri[(k + 1) % 3]!
          const key = a < c ? `${a}-${c}` : `${c}-${a}`
          edges.set(key, (edges.get(key) ?? 0) + 1)
        }
      }
      expect([...edges.values()].every((n) => n === 2), name).toBe(true)
    }
  })

  it('faces every surface outward, away from the middle of its cross-section', () => {
    for (const [name, b] of Object.entries(built)) {
      const pos = b.geometry.getAttribute('position')
      const normal = b.geometry.getAttribute('normal')
      // Each ring's centre: the vertices at the same height along the bone.
      const centres = new Map<string, [number, number, number]>()
      for (let i = 0; i < pos.count; i++) {
        const c = centres.get(pos.getY(i).toFixed(5)) ?? [0, 0, 0]
        centres.set(pos.getY(i).toFixed(5), [c[0] + pos.getX(i), c[1] + pos.getZ(i), c[2] + 1])
      }
      let out = 0
      for (let i = 0; i < pos.count; i++) {
        const [x, z, n] = centres.get(pos.getY(i).toFixed(5))!
        if ((pos.getX(i) - x / n) * normal.getX(i) + (pos.getZ(i) - z / n) * normal.getZ(i) >= -1e-6) out++
      }
      expect(out / pos.count, name).toBeGreaterThan(0.99)
    }
  })

  it('has an adult\'s proportions: a waist narrower than chest and hips, a calf fuller than the ankle', () => {
    const cm = (v: number) => v * 27
    const torso = SHAPES.torso.sections
    const width = (t: number) => cm(2 * torso.find((x) => x.t === t)!.l)
    expect(width(0.28)).toBeLessThan(width(0.62))
    expect(width(0.28)).toBeLessThan(cm(2 * SHAPES.pelvis.sections.find((x) => x.t === -0.12)!.l))
    // Chest about 30 cm across, hips about 33 cm.
    expect(width(0.62)).toBeGreaterThan(28)
    expect(width(0.62)).toBeLessThan(33)
    const shin = SHAPES.shin.sections
    const depth = (t: number) => shin.find((x) => x.t === t)!
    expect(depth(0.28).b).toBeGreaterThan(2 * depth(1).b)
  })
})

describe('the muscles an exercise works', () => {
  it('paints a curl on the front of the working upper arm only: biceps red, forearm yellow', () => {
    const arm = muscleLoad('rUpperArm', built.upperArm, 'elbow_flexion')
    expect(at(arm.primary, near(built.upperArm, 0.6, 0, 1))).toBeGreaterThan(0.9)
    expect(most(arm.primary, near(built.upperArm, 0.6, 0, -1))).toBe(0)
    expect(at(muscleLoad('rForearm', built.forearm, 'elbow_flexion').secondary, near(built.forearm, 0.3, 0, 1))).toBeGreaterThan(0.9)
    const other = muscleLoad('lUpperArm', built.upperArm, 'elbow_flexion')
    expect(Math.max(...other.primary, ...other.secondary)).toBe(0)
  })

  it('puts the chest on the front of the trunk and the lower back behind it', () => {
    const press = muscleLoad('torso', built.torso, 'chest_press')
    expect(at(press.primary, near(built.torso, 0.75, 0.4, 0.9))).toBeGreaterThan(0.9)
    expect(most(press.primary, near(built.torso, 0.75, 0, -1))).toBe(0)
    const dead = muscleLoad('torso', built.torso, 'deadlift')
    expect(at(dead.primary, near(built.torso, 0.25, 0.1, -1))).toBeGreaterThan(0.9)
    expect(most(dead.primary, near(built.torso, 0.25, 0, 1))).toBe(0)
    expect(at(muscleLoad('pelvis', built.pelvis, 'deadlift').primary, near(built.pelvis, -0.2, 0, -1))).toBeGreaterThan(0.9)
  })

  it('lights a one-arm row on the right lat only, and the lower back on both sides', () => {
    const row = muscleLoad('torso', built.torso, 'bent_over_row')
    // The trunk's right half is −X.
    expect(at(row.primary, near(built.torso, 0.55, -0.7, -0.6))).toBeGreaterThan(0.9)
    expect(most(row.primary, near(built.torso, 0.55, 0.7, -0.6))).toBe(0)
    expect(at(row.secondary, near(built.torso, 0.25, -0.15, -0.98))).toBeGreaterThan(0.9)
    expect(at(row.secondary, near(built.torso, 0.25, 0.15, -0.98))).toBeGreaterThan(0.9)
  })

  it('puts the quads on the front of the thigh and the calves on the back of the shin', () => {
    const squat = muscleLoad('lThigh', built.thigh, 'squat')
    expect(at(squat.primary, near(built.thigh, 0.5, 0, 1))).toBeGreaterThan(0.9)
    expect(at(squat.secondary, near(built.thigh, 0.5, 0, -1))).toBeGreaterThan(0.9)
    expect(at(muscleLoad('rShin', built.shin, 'squat').secondary, near(built.shin, 0.3, 0, -1))).toBeGreaterThan(0.9)
  })

  it('turns a back exercise to show its back, and a front one three-quarters from the front', () => {
    expect(facingFor('deadlift')).toBeGreaterThan(0)
    expect(facingFor('bent_over_row')).toBeGreaterThan(0)
    expect(facingFor('elbow_flexion')).toBeLessThan(0)
    expect(facingFor('squat')).toBeLessThan(0)
  })
})
