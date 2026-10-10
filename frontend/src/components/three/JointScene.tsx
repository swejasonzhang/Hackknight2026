import type { ExerciseId } from '@arc/dependencies'
import { Grid, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion, type MotionValue } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, Color, DoubleSide, Group, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import { HELPER_YELLOW, TARGET_RED } from './colors'
import { buildShape, facingFor, muscleLoad, PART_SHAPE, SHAPES, type Built, type ShapeName } from './anatomy'
import { BONES, FRAMING, restFor, skeletonFor, sweepFor, type BoneName, type Skeleton, type V3 } from './skeleton'

export interface JointSceneProps {
  exercise: ExerciseId
  /** The reading to pose at: a Motion value that changes every frame, or a fixed number. */
  angle: MotionValue<number> | number
  /** Drawn as a navy tick on the gauge. */
  goalDeg?: number
  /** The range covered, rest to this reading: a faint band with a tick at each end, under the live arc. */
  rangeDeg?: number
  /** Slow sway of the whole body so the depth reads; off under reduced motion. */
  idle?: boolean
  /** Paint the muscles the exercise works: red where it targets, yellow where they help. On by default. */
  muscles?: boolean
  /** Draw the body mirrored: working on its left, or as a mirror shows the member's right. */
  mirrored?: boolean
  className?: string
  /** What the picture shows, for assistive tech. */
  label: string
}

const SKIN = '#cdd4de'
const SEAT = '#dfe4ef'
const NAVY = '#0b1b3a'
const COBALT = '#0b3dff'
const STEPS = 64
const Z_AXIS = new Vector3(0, 0, 1)
const rad = (deg: number) => (deg * Math.PI) / 180

/*
 * Everything the body is made of is built once and shared: one material per surface and one
 * geometry per shape, reused by every mount and every canvas (each mount only adds its own muscle
 * colours). Switching exercise changes transforms and colours, so nothing is rebuilt or
 * recompiled mid-animation (that rebuild was the stutter).
 */
let shared: ReturnType<typeof build> | null = null
function build() {
  const shapes = Object.fromEntries((Object.keys(SHAPES) as ShapeName[]).map((k) => [k, buildShape(SHAPES[k])])) as Record<ShapeName, Built>
  return {
    shapes,
    // The body: white, tinted per vertex by the muscle colours.
    body: new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.55, metalness: 0.02 }),
    skin: new MeshStandardMaterial({ color: SKIN, roughness: 0.55, metalness: 0.02 }),
    seat: new MeshStandardMaterial({ color: SEAT, roughness: 0.7 }),
    navy: new MeshStandardMaterial({ color: NAVY, roughness: 0.6 }),
    ink: new MeshBasicMaterial({ color: COBALT }),
    dot: new MeshBasicMaterial({ color: NAVY }),
    arc: new MeshBasicMaterial({ color: COBALT, side: DoubleSide, transparent: true, opacity: 0.85 }),
    band: new MeshBasicMaterial({ color: COBALT, side: DoubleSide, transparent: true, opacity: 0.16, depthWrite: false }),
    sphere: new SphereGeometry(1, 24, 18),
    torus: new TorusGeometry(1, 0.14, 12, 40),
    disc: new CircleGeometry(0.38, 24),
    box: new BoxGeometry(1, 1, 1),
  }
}
const parts = () => (shared ??= build())

const SHAPED = BONES.filter((b) => PART_SHAPE[b.name]).map((b) => b.name)

/** This mount's copy of each shaped part: the shared surface with its own colours. */
function paintable(): Record<string, BufferGeometry> {
  const p = parts()
  return Object.fromEntries(
    SHAPED.map((name) => {
      const src = p.shapes[PART_SHAPE[name]!.shape].geometry
      const g = new BufferGeometry()
      g.setAttribute('position', src.getAttribute('position'))
      g.setAttribute('normal', src.getAttribute('normal'))
      g.setIndex(src.getIndex())
      g.boundingSphere = src.boundingSphere
      g.setAttribute('color', new BufferAttribute(new Float32Array(src.getAttribute('position').count * 3), 3))
      return [name, g]
    }),
  )
}

const skin = new Color(SKIN)
const red = new Color(TARGET_RED)
const yellow = new Color(HELPER_YELLOW)
const tint = new Color()
/** Colours each part for an exercise: skin, yellow where muscles help, red where it targets. */
function paint(geometries: Record<string, BufferGeometry>, exercise: ExerciseId, on: boolean) {
  const p = parts()
  for (const name of SHAPED) {
    const g = geometries[name]!
    const built = p.shapes[PART_SHAPE[name]!.shape]
    const color = g.getAttribute('color') as BufferAttribute
    const load = on ? muscleLoad(name, built, exercise) : null
    for (let i = 0; i < color.count; i++) {
      tint.copy(skin)
      if (load) tint.lerp(yellow, load.secondary[i]! * 0.95).lerp(red, load.primary[i]! * 0.95)
      color.setXYZ(i, tint.r, tint.g, tint.b)
    }
    color.needsUpdate = true
  }
}

/** The stool is the same for every seated pose; it is shown only for the seated exercise. */
const SEAT_DIMS = skeletonFor('seated_knee_extension', 90).seat!

// Reused every frame, so posing allocates nothing.
const vx = new Vector3()
const vy = new Vector3()
const vz = new Vector3()
const up = new Vector3()
const fwd = new Vector3()
const pUp = new Vector3()
const pFwd = new Vector3()
const down = new Vector3()
const dir = new Vector3()
const front = new Vector3()
const basis = new Matrix4()
const turn = new Quaternion()
const UP = new Vector3(0, 1, 0)
const tmpQuat = new Quaternion()
const v3 = (p: V3, out: Vector3) => out.set(p[0], p[1], p[2])

/** Puts an object at `from` with its local +Y pointing at `to`; `stretch` scales +Y to the bone's length. */
function place(o: Object3D, from: V3, to: V3, stretch: boolean) {
  dir.set(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  const len = dir.length()
  o.position.set(from[0], from[1], from[2])
  o.quaternion.copy(tmpQuat.setFromUnitVectors(UP, dir.normalize()))
  o.scale.set(1, stretch ? len : 1, 1)
}

/** `v` carried by the turn that takes `from` onto `to`; a half turn goes round the picture's axis, as every movement does. */
function carry(from: Vector3, to: Vector3, v: Vector3, out: Vector3): Vector3 {
  if (from.dot(to) < -0.9999) turn.setFromAxisAngle(Z_AXIS, Math.PI)
  else turn.setFromUnitVectors(from, to)
  return out.copy(v).applyQuaternion(turn)
}

/**
 * Sets a part's frame: at `at`, +Y along `along` (unit), +Z toward `toward` made square to it,
 * +X their cross; `mirror` flips X for a left limb, and `stretch` scales +Y to the bone's length.
 */
function orient(o: Object3D, at: V3, along: Vector3, toward: Vector3, mirror: boolean, stretch = 1) {
  vy.copy(along)
  vz.copy(toward).addScaledVector(vy, -toward.dot(vy))
  if (vz.lengthSq() < 1e-8) vz.copy(Z_AXIS).addScaledVector(vy, -Z_AXIS.dot(vy))
  vz.normalize()
  vx.crossVectors(vy, vz)
  basis.makeBasis(vx, vy, vz)
  o.position.set(at[0], at[1], at[2])
  o.quaternion.setFromRotationMatrix(basis)
  o.scale.set(mirror ? -1 : 1, stretch, 1)
}

function gaugeGeometry(): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array((STEPS + 1) * 6), 3))
  const index: number[] = []
  for (let i = 0; i < STEPS; i++) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  g.setIndex(index)
  return g
}

/** The goniometer ribbon round the moving joint, from the rest direction to the current one. */
function writeGauge(geometry: BufferGeometry, centre: [number, number], radius: number, width: number, fromDeg: number, toDeg: number, z: number) {
  const attr = geometry.getAttribute('position') as BufferAttribute
  for (let i = 0; i <= STEPS; i++) {
    const t = rad(fromDeg + ((toDeg - fromDeg) * i) / STEPS)
    attr.setXYZ(i * 2, centre[0] + (radius - width) * Math.cos(t), centre[1] + (radius - width) * Math.sin(t), z)
    attr.setXYZ(i * 2 + 1, centre[0] + (radius + width) * Math.cos(t), centre[1] + (radius + width) * Math.sin(t), z)
  }
  attr.needsUpdate = true
}

/** Stable callback refs by key: re-renders never detach and re-attach objects. */
function useBinder() {
  const objects = useRef<Record<string, Object3D | undefined>>({})
  const binders = useRef(new Map<string, (o: Object3D | null) => void>())
  const bind = (key: string) => {
    let fn = binders.current.get(key)
    if (!fn) {
      fn = (o) => {
        if (o) objects.current[key] = o
        else delete objects.current[key]
      }
      binders.current.set(key, fn)
    }
    return fn
  }
  return { objects, bind }
}

const ARMS = new Set<BoneName>(['rUpperArm', 'lUpperArm', 'rForearm', 'lForearm', 'rHand', 'lHand'])
const LEGS = new Set<BoneName>(['rThigh', 'lThigh', 'rShin', 'lShin'])

function Body({ exercise, angle, goalDeg, rangeDeg, idle, reduce, muscles, mirrored }: Pick<JointSceneProps, 'exercise' | 'angle' | 'goalDeg' | 'rangeDeg' | 'idle'> & { reduce: boolean; muscles: boolean; mirrored: boolean }) {
  const p = parts()
  const sway = useRef<Group>(null)
  const { objects, bind } = useBinder()
  const gauge = useMemo(gaugeGeometry, [])
  const band = useMemo(gaugeGeometry, [])
  const surfaces = useMemo(paintable, [])
  const shown = useRef<{ exercise: ExerciseId; deg: number } | null>(null)
  const applied = useRef<{ exercise: ExerciseId; deg: number } | null>(null)
  const invalidate = useThree((s) => s.invalidate)
  const frame = FRAMING[exercise]
  const rest = useMemo(() => skeletonFor(exercise, restFor(exercise)), [exercise])
  const ring = 0.075 / frame.scale
  const facing = facingFor(exercise)

  useEffect(() => () => {
    gauge.dispose()
    band.dispose()
    // This mount's copies (and its colours) go with its canvas; the shared surfaces stay.
    for (const g of Object.values(surfaces)) g.dispose()
  }, [gauge, band, surfaces])

  useEffect(() => {
    paint(surfaces, exercise, muscles)
    invalidate()
  }, [surfaces, exercise, muscles, invalidate])

  // Reduced motion renders on demand: draw again whenever the reading, the range or the movement changes.
  useEffect(() => {
    applied.current = null
    invalidate()
  }, [invalidate, exercise, angle, goalDeg, rangeDeg])

  const apply = (s: Skeleton) => {
    const j = s.joints
    const o = objects.current
    // The trunk's up and front; the pelvis turns with the trunk side on (a hinge, a crunch) and
    // stays level face on (a twist turns the shoulders over still hips).
    v3(j.neck, up).sub(v3(j.pelvis, dir)).normalize()
    if (s.view === 'side') fwd.set(up.y, -up.x, 0)
    else fwd.set(0, 0, 1)
    pUp.copy(s.view === 'side' ? up : UP)
    pFwd.copy(fwd)
    for (const bone of BONES) {
      const obj = o[bone.name]
      if (!obj) continue
      const from = j[bone.from]
      const to = j[bone.to]
      const left = bone.name.startsWith('l')
      dir.set(to[0] - from[0], to[1] - from[1], to[2] - from[2])
      const len = dir.length()
      dir.divideScalar(len)
      const shape = PART_SHAPE[bone.name]
      const stretch = shape ? len / SHAPES[shape.shape].length : 1
      if (bone.name === 'pelvis') {
        orient(obj, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], pUp, pFwd, false)
      } else if (bone.name === 'torso' || bone.name === 'neck' || bone.name === 'head') {
        orient(obj, from, dir, fwd, false, bone.name === 'neck' ? 1 : stretch)
      } else if (ARMS.has(bone.name)) {
        // An arm's front is the trunk's front, carried round from hanging at the side.
        orient(obj, from, dir, carry(down.copy(up).negate(), dir, fwd, front), left, stretch)
      } else if (LEGS.has(bone.name)) {
        orient(obj, from, dir, carry(down.copy(pUp).negate(), dir, pFwd, front), left, stretch)
      } else {
        // A foot's top faces up when it points forward.
        orient(obj, from, dir, carry(pFwd, dir, pUp, front), left, stretch)
      }
    }

    const ov = s.overlay
    const z = ov.z
    o['ring-base']?.position.set(ov.base[0], ov.base[1], z + 0.01)
    o['ring-mid']?.position.set(ov.mid[0], ov.mid[1], z + 0.01)
    o['ring-end']?.position.set(ov.end[0], ov.end[1], z + 0.01)
    if (o['line-proximal']) place(o['line-proximal'], [ov.base[0], ov.base[1], z], [ov.mid[0], ov.mid[1], z], true)
    if (o['line-distal']) place(o['line-distal'], [ov.mid[0], ov.mid[1], z], [ov.end[0], ov.end[1], z], true)
    const radius = ov.reach * 0.55
    writeGauge(gauge, ov.mid, radius, radius * 0.07, ov.restDeg, ov.currentDeg, z)
    // The covered range (rest to rangeDeg) rides on the joint, so it follows a squat or a hinge.
    const bandEnd = rangeDeg != null ? ov.restDeg + sweepFor(exercise, rangeDeg) : ov.restDeg
    writeGauge(band, ov.mid, radius, radius * 0.17, ov.restDeg, bandEnd, z - 0.01)
    ;[ov.restDeg, bandEnd].forEach((d, i) => {
      const end = o[`band-end-${i}`]
      if (!end) return
      end.position.set(ov.mid[0] + radius * Math.cos(rad(d)), ov.mid[1] + radius * Math.sin(rad(d)), z)
      end.rotation.z = rad(d)
      end.scale.set(radius * 0.5, radius * 0.045, 0.02)
    })
    const tick = o['goal-tick']
    if (tick && goalDeg != null) {
      const g = ov.restDeg + sweepFor(exercise, goalDeg)
      tick.position.set(ov.mid[0] + radius * Math.cos(rad(g)), ov.mid[1] + radius * Math.sin(rad(g)), z + 0.01)
      tick.rotation.z = rad(g)
      tick.scale.set(radius * 0.36, radius * 0.073, radius * 0.073)
    }
  }

  useFrame((state, dt) => {
    const target = typeof angle === 'number' ? angle : angle.get()
    const prev = shown.current
    // A new reading sweeps there (a live Motion value is followed exactly); a new movement starts in place.
    const deg = !prev || prev.exercise !== exercise || reduce || typeof angle !== 'number' ? target : prev.deg + (target - prev.deg) * (1 - Math.exp(-dt * 6))
    shown.current = { exercise, deg }
    const last = applied.current
    if (!last || last.exercise !== exercise || Math.abs(last.deg - deg) > 0.01) {
      apply(skeletonFor(exercise, deg))
      applied.current = { exercise, deg }
    }
    // A mirrored figure turns the mirror way, so it shows the same side of the body.
    if (sway.current) sway.current.rotation.y = (mirrored ? -1 : 1) * (facing + (idle ? Math.sin(state.clock.elapsedTime * 0.45) * 0.34 : 0))
  })

  // A hand: palm and fingers along +Y from the wrist, the palm facing +Z, the thumb on the outer side.
  const hand = (name: 'rHand' | 'lHand') => (
    <group key={name} ref={bind(name)}>
      <RoundedBox args={[0.27, 0.34, 0.1]} radius={0.045} smoothness={4} position={[0, 0.17, 0]} material={p.skin} />
      {[-0.095, -0.032, 0.032, 0.095].map((x, i) => (
        <mesh key={x} position={[x, 0.45 - Math.abs(i - 1.5) * 0.025, 0.012]} rotation={[0.22, 0, 0]} material={p.skin}>
          <capsuleGeometry args={[0.036, 0.19 - Math.abs(i - 1.5) * 0.03, 6, 12]} />
        </mesh>
      ))}
      <mesh position={[0.155, 0.17, 0.035]} rotation={[0.35, 0, -0.6]} material={p.skin}>
        <capsuleGeometry args={[0.042, 0.15, 6, 12]} />
      </mesh>
    </group>
  )

  return (
    <group ref={sway}>
      <group scale={[mirrored ? -1 : 1, 1, 1]}>
      <group position={frame.offset} scale={frame.scale}>
        {BONES.map((bone) => {
          if (bone.name === 'rHand' || bone.name === 'lHand') return hand(bone.name)
          if (bone.name === 'head')
            return (
              <group key="head" ref={bind('head')}>
                <mesh geometry={surfaces.head} material={p.body} />
                {/* The nose shows which way the body faces; the ears sit level with it. */}
                <mesh position={[0, 0.35, 0.33]} rotation={[-0.25, 0, 0]} scale={[0.05, 0.1, 0.07]} geometry={p.sphere} material={p.skin} />
                {[-1, 1].map((x) => (
                  <mesh key={x} position={[x * 0.265, 0.33, -0.03]} scale={[0.035, 0.1, 0.07]} geometry={p.sphere} material={p.skin} />
                ))}
              </group>
            )
          return <mesh key={bone.name} ref={bind(bone.name)} geometry={surfaces[bone.name]} material={p.body} />
        })}

        {/* The stool: always built, shown only for the seated exercise. */}
        <group visible={rest.seat != null}>
          <mesh position={[(SEAT_DIMS.x[0] + SEAT_DIMS.x[1]) / 2, SEAT_DIMS.top - 0.06, 0]} scale={[SEAT_DIMS.x[1] - SEAT_DIMS.x[0], 0.12, SEAT_DIMS.z[1] - SEAT_DIMS.z[0]]} geometry={p.box} material={p.seat} />
          {(
            [
              [SEAT_DIMS.x[0] + 0.12, SEAT_DIMS.z[0] + 0.12],
              [SEAT_DIMS.x[0] + 0.12, SEAT_DIMS.z[1] - 0.12],
              [SEAT_DIMS.x[1] - 0.12, SEAT_DIMS.z[0] + 0.12],
              [SEAT_DIMS.x[1] - 0.12, SEAT_DIMS.z[1] - 0.12],
            ] as [number, number][]
          ).map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, (SEAT_DIMS.top - 0.12) / 2, z]} scale={[0.08, SEAT_DIMS.top - 0.12, 0.08]} geometry={p.box} material={p.navy} />
          ))}
        </group>

        {/* The tracker's view on top of the body: landmark rings, the tracked segments, the arc. */}
        <group ref={bind('line-proximal')}>
          <Line points={[[0, 0, 0], [0, 1, 0]]} color={COBALT} lineWidth={2.5} transparent opacity={0.9} />
        </group>
        <group ref={bind('line-distal')}>
          <Line points={[[0, 0, 0], [0, 1, 0]]} color={COBALT} lineWidth={2.5} transparent opacity={0.9} />
        </group>
        {(['base', 'mid', 'end'] as const).map((key, i) => (
          <group key={key} ref={bind(`ring-${key}`)} scale={ring * [1.1, 1, 0.85][i]!}>
            <mesh geometry={p.torus} material={p.ink} />
            <mesh geometry={p.disc} material={p.dot} />
          </group>
        ))}
        <mesh geometry={band} material={p.band} visible={rangeDeg != null} frustumCulled={false} />
        {[0, 1].map((i) => (
          <mesh key={i} ref={bind(`band-end-${i}`)} geometry={p.box} material={p.ink} visible={rangeDeg != null} />
        ))}
        <mesh geometry={gauge} material={p.arc} frustumCulled={false} />
        <mesh ref={bind('goal-tick')} geometry={p.box} material={p.dot} visible={goalDeg != null} />
      </group>
      </group>
    </group>
  )
}

/**
 * A whole body performing the exercise, shaped from anatomical cross-sections (`anatomy.ts`): head,
 * neck, trunk, hips, arms with hands, legs with feet, posed for each of the fifteen movements (side
 * on, face on, seated on a stool, lying for a crunch). The reading poses it (`skeletonFor`): the
 * working limb, or for squats, lunges, deadlifts and crunches the whole body; the tracker's rings
 * and segments and the goniometer arc sit on its joints, and `rangeDeg` shades the range covered
 * from rest to that reading. The muscles the exercise works are painted on it: red where it
 * targets, yellow where they help. Drive `angle` with `useRepLoop` to sweep the limb through the
 * range rep after rep; a new fixed reading sweeps the limb to it. The body is built once:
 * switching exercise only re-poses and repaints it. Never rendered in tests: use `LazyJointScene`.
 */
export default function JointScene({ exercise, angle, goalDeg, rangeDeg, idle = true, muscles = true, mirrored = false, className = '', label }: JointSceneProps) {
  const reduce = useReducedMotion() ?? false
  const fixed = typeof angle === 'number' ? angle : angle.get()
  const floorY = FRAMING[exercise].offset[1]
  return (
    <div className={`relative ${className}`.trim()} role="img" aria-label={label}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0.7, 0.35, 4.6], fov: 36 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} frameloop={reduce ? 'demand' : 'always'}>
        <hemisphereLight args={['#ffffff', '#9aa8c2', 1.0]} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, 1.5, -3]} intensity={1.4} color="#c9d6ff" />
        <Body exercise={exercise} angle={reduce ? fixed : angle} goalDeg={goalDeg} rangeDeg={rangeDeg} idle={!reduce && idle} reduce={reduce} muscles={muscles} mirrored={mirrored} />
        <Grid position={[0, floorY - 0.001, 0]} args={[12, 12]} cellSize={0.25} sectionSize={1} cellColor="#dfe4ef" sectionColor="#b7c2dc" fadeDistance={9} fadeStrength={1.6} infiniteGrid />
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.7} />
      </Canvas>
    </div>
  )
}
