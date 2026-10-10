import type { ExerciseId } from '@arc/dependencies'
import { Grid, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion, type MotionValue } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, CylinderGeometry, DoubleSide, Group, LatheGeometry, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, TorusGeometry, Vector2, Vector3 } from 'three'
import { BONES, directionFor, FRAMING, restFor, skeletonFor, type BoneName, type JointName, type Skeleton, type V3 } from './skeleton'

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
  className?: string
  /** What the picture shows, for assistive tech. */
  label: string
}

const SKIN = '#c9d2df'
const JOINT = '#aab6c8'
const SEAT = '#dfe4ef'
const NAVY = '#0b1b3a'
const COBALT = '#0b3dff'
const STEPS = 64
const UP = new Vector3(0, 1, 0)
const rad = (deg: number) => (deg * Math.PI) / 180

/*
 * Everything the body is made of is built once and shared: one material per surface and one
 * geometry per shape, reused by every mount and every canvas. Switching exercise changes only
 * transforms, so nothing is rebuilt or recompiled mid-animation (that rebuild was the stutter).
 */
let shared: ReturnType<typeof build> | null = null
function build() {
  const skin = new MeshStandardMaterial({ color: SKIN, roughness: 0.45, metalness: 0.06, side: DoubleSide })
  const lathe = (profile: [number, number][]) =>
    new LatheGeometry(
      profile.map(([t, r]) => new Vector2(r, t)),
      40,
    )
  return {
    skin,
    joint: new MeshStandardMaterial({ color: JOINT, roughness: 0.45, metalness: 0.06 }),
    seat: new MeshStandardMaterial({ color: SEAT, roughness: 0.7 }),
    navy: new MeshStandardMaterial({ color: NAVY, roughness: 0.6 }),
    ink: new MeshBasicMaterial({ color: COBALT }),
    dot: new MeshBasicMaterial({ color: NAVY }),
    arc: new MeshBasicMaterial({ color: COBALT, side: DoubleSide, transparent: true, opacity: 0.85 }),
    band: new MeshBasicMaterial({ color: COBALT, side: DoubleSide, transparent: true, opacity: 0.16, depthWrite: false }),
    sphere: new SphereGeometry(1, 32, 24),
    ball: new SphereGeometry(1, 24, 18),
    torus: new TorusGeometry(1, 0.14, 12, 40),
    disc: new CircleGeometry(0.38, 24),
    box: new BoxGeometry(1, 1, 1),
    neck: new CylinderGeometry(0.2, 0.22, 0.4, 24),
    // Lathe profiles as [t, radius]: t runs 0 at the bone's first joint to 1 at its second.
    lathes: {
      torso: lathe([[-0.03, 0], [0, 0.5], [0.12, 0.53], [0.3, 0.5], [0.5, 0.52], [0.72, 0.58], [0.86, 0.6], [0.94, 0.52], [0.99, 0.3], [1, 0.21], [1.02, 0]]),
      upperArm: lathe([[-0.03, 0], [0, 0.1], [0.06, 0.165], [0.18, 0.185], [0.4, 0.165], [0.6, 0.17], [0.8, 0.145], [0.95, 0.115], [1, 0.1], [1.03, 0]]),
      forearm: lathe([[-0.04, 0], [0, 0.11], [0.12, 0.15], [0.3, 0.145], [0.55, 0.125], [0.8, 0.1], [0.97, 0.092], [1, 0.09], [1.02, 0]]),
      thigh: lathe([[-0.05, 0], [0, 0.25], [0.1, 0.31], [0.35, 0.3], [0.65, 0.255], [0.9, 0.2], [1, 0.17], [1.04, 0]]),
      shin: lathe([[-0.04, 0], [0, 0.17], [0.15, 0.205], [0.3, 0.21], [0.55, 0.17], [0.85, 0.13], [1, 0.12], [1.03, 0]]),
    },
  }
}
const parts = () => (shared ??= build())

const LATHE: Partial<Record<BoneName, keyof ReturnType<typeof build>['lathes']>> = {
  torso: 'torso',
  rUpperArm: 'upperArm',
  lUpperArm: 'upperArm',
  rForearm: 'forearm',
  lForearm: 'forearm',
  rThigh: 'thigh',
  lThigh: 'thigh',
  rShin: 'shin',
  lShin: 'shin',
}
/** A chest is wider than it is deep: about 32 cm across and 23 cm front to back. */
const CHEST_DEPTH = 0.72

/** Mannequin ball joints, radius in body units. */
const BALLS: [JointName, number][] = [
  ['rShoulder', 0.2],
  ['lShoulder', 0.2],
  ['rElbow', 0.12],
  ['lElbow', 0.12],
  ['rWrist', 0.08],
  ['lWrist', 0.08],
  ['rKnee', 0.175],
  ['lKnee', 0.175],
  ['rAnkle', 0.1],
  ['lAnkle', 0.1],
]

/** The stool is the same for every seated pose; it is shown only for the seated exercise. */
const SEAT_DIMS = skeletonFor('seated_knee_extension', 90).seat!

// Reused every frame, so posing allocates nothing.
const tmpDir = new Vector3()
const tmpQuat = new Quaternion()

/** Puts an object at `from` with its local +Y pointing at `to`; `stretch` scales +Y to the bone's length. */
function place(o: Object3D, from: V3, to: V3, stretch: boolean, sx = 1, sz = 1) {
  tmpDir.set(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  const len = tmpDir.length()
  o.position.set(from[0], from[1], from[2])
  o.quaternion.copy(tmpQuat.setFromUnitVectors(UP, tmpDir.normalize()))
  o.scale.set(sx, stretch ? len : 1, sz)
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

function Body({ exercise, angle, goalDeg, rangeDeg, idle, reduce }: Pick<JointSceneProps, 'exercise' | 'angle' | 'goalDeg' | 'rangeDeg' | 'idle'> & { reduce: boolean }) {
  const p = parts()
  const sway = useRef<Group>(null)
  const { objects, bind } = useBinder()
  const gauge = useMemo(gaugeGeometry, [])
  const band = useMemo(gaugeGeometry, [])
  const shown = useRef<{ exercise: ExerciseId; deg: number } | null>(null)
  const applied = useRef<{ exercise: ExerciseId; deg: number } | null>(null)
  const invalidate = useThree((s) => s.invalidate)
  const frame = FRAMING[exercise]
  const rest = useMemo(() => skeletonFor(exercise, restFor(exercise)), [exercise])
  const view = rest.view
  const ring = 0.075 / frame.scale

  useEffect(() => () => {
    gauge.dispose()
    band.dispose()
  }, [gauge, band])

  // The range band (rest to rangeDeg) changes only with the exercise or the reading.
  useEffect(() => {
    const o = rest.overlay
    const r = o.reach * 0.55
    const end = rangeDeg != null ? directionFor(exercise, rangeDeg) : o.restDeg
    writeGauge(band, o.mid, r, r * 0.17, o.restDeg, end, o.z - 0.01)
    const ends = [o.restDeg, end]
    ends.forEach((d, i) => {
      const tick = objects.current[`band-end-${i}`]
      if (!tick) return
      tick.position.set(o.mid[0] + r * Math.cos(rad(d)), o.mid[1] + r * Math.sin(rad(d)), o.z)
      tick.rotation.z = rad(d)
      tick.scale.set(r * 0.5, r * 0.045, 0.02)
    })
    invalidate()
  }, [band, exercise, rangeDeg, rest, objects, invalidate])

  // Reduced motion renders on demand: draw again whenever the reading or the movement changes.
  useEffect(() => {
    invalidate()
  }, [invalidate, exercise, angle, goalDeg])

  const apply = (s: Skeleton, deg: number) => {
    const j = s.joints
    const o = objects.current
    for (const bone of BONES) {
      const obj = o[bone.name]
      if (!obj) continue
      const from = j[bone.from]
      const to = j[bone.to]
      if (bone.name === 'pelvis') {
        // Hip to hip; the hips are an ellipsoid set on the middle, upright.
        obj.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + 0.13, (from[2] + to[2]) / 2)
        continue
      }
      // The exercising biceps shortens and thickens as the elbow bends.
      const girth = exercise === 'elbow_flexion' && bone.name === 'rUpperArm' ? 1 + 0.14 * Math.min(1, deg / 140) : 1
      if (bone.name === 'torso') place(obj, from, to, true, view === 'side' ? CHEST_DEPTH : 1, view === 'side' ? 1 : CHEST_DEPTH)
      else place(obj, from, to, LATHE[bone.name] != null, girth, girth)
    }
    for (const [name] of BALLS) o[`ball-${name}`]?.position.set(j[name][0], j[name][1], j[name][2])

    const ov = s.overlay
    const z = ov.z
    o['ring-base']?.position.set(ov.base[0], ov.base[1], z + 0.01)
    o['ring-mid']?.position.set(ov.mid[0], ov.mid[1], z + 0.01)
    o['ring-end']?.position.set(ov.end[0], ov.end[1], z + 0.01)
    if (o['line-proximal']) place(o['line-proximal'], [ov.base[0], ov.base[1], z], [ov.mid[0], ov.mid[1], z], true)
    if (o['line-distal']) place(o['line-distal'], [ov.mid[0], ov.mid[1], z], [ov.end[0], ov.end[1], z], true)
    const radius = ov.reach * 0.55
    writeGauge(gauge, ov.mid, radius, radius * 0.07, ov.restDeg, ov.currentDeg, z)
    const tick = o['goal-tick']
    if (tick && goalDeg != null) {
      const g = directionFor(exercise, goalDeg)
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
      apply(skeletonFor(exercise, deg), deg)
      applied.current = { exercise, deg }
    }
    if (sway.current) sway.current.rotation.y = idle ? -0.2 + Math.sin(state.clock.elapsedTime * 0.45) * 0.34 : -0.2
  })

  const side = view === 'side'
  const lathed = (name: BoneName) => (
    <mesh key={name} ref={bind(name)} geometry={p.lathes[LATHE[name]!]} material={p.skin} />
  )
  const hand = (name: 'rHand' | 'lHand') => (
    <group key={name} ref={bind(name)}>
      <RoundedBox args={[0.27, 0.36, 0.11]} radius={0.045} smoothness={4} position={[0, 0.19, 0]} material={p.skin} />
      {[-0.095, -0.032, 0.032, 0.095].map((x, i) => (
        <mesh key={x} position={[x, 0.5 - Math.abs(i - 1.5) * 0.02, 0.01]} rotation={[0.18, 0, 0]} material={p.skin}>
          <capsuleGeometry args={[0.038, 0.2 - Math.abs(i - 1.5) * 0.03, 6, 12]} />
        </mesh>
      ))}
      <mesh position={[0.16, 0.2, 0.03]} rotation={[0.2, 0, -0.65]} material={p.skin}>
        <capsuleGeometry args={[0.042, 0.16, 6, 12]} />
      </mesh>
    </group>
  )
  // One foot shape; face on it turns a quarter, so the sole faces down the camera's axis.
  const foot = (name: 'rFoot' | 'lFoot') => (
    <group key={name} ref={bind(name)}>
      <RoundedBox args={[0.2, 0.98, 0.3]} radius={0.08} smoothness={4} position={side ? [0.03, 0.27, 0] : [0, 0.27, -0.03]} rotation={side ? [0, 0, 0] : [0, Math.PI / 2, 0]} material={p.skin} />
    </group>
  )

  return (
    <group ref={sway}>
      <group position={frame.offset} scale={frame.scale}>
        {BONES.map((bone) => {
          if (LATHE[bone.name]) return lathed(bone.name)
          if (bone.name === 'rHand' || bone.name === 'lHand') return hand(bone.name)
          if (bone.name === 'rFoot' || bone.name === 'lFoot') return foot(bone.name)
          if (bone.name === 'head')
            return (
              <group key="head" ref={bind('head')}>
                {/* About 22 cm tall, 15 cm wide and 19 cm deep, with a nose that shows which way the body faces. */}
                <mesh position={[0, 0.41, 0]} scale={side ? [0.35, 0.42, 0.29] : [0.29, 0.42, 0.35]} geometry={p.sphere} material={p.skin} />
                <mesh position={side ? [0.36, 0.36, 0] : [0, 0.36, 0.36]} scale={0.06} geometry={p.sphere} material={p.skin} />
              </group>
            )
          if (bone.name === 'neck')
            return (
              <group key="neck" ref={bind('neck')}>
                <mesh position={[0, 0.12, 0]} geometry={p.neck} material={p.skin} />
              </group>
            )
          // The pelvis: an ellipsoid across the hips.
          return <mesh key="pelvis" ref={bind('pelvis')} scale={side ? [0.42, 0.36, 0.62] : [0.62, 0.36, 0.42]} geometry={p.sphere} material={p.skin} />
        })}
        {BALLS.map(([name, r]) => (
          <mesh key={name} ref={bind(`ball-${name}`)} scale={r} geometry={p.ball} material={p.joint} />
        ))}

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
  )
}

/**
 * A whole body performing the exercise: head, neck, torso, pelvis, both arms with hands, both legs
 * with feet, and mannequin ball joints, standing for elbow flexion (side on) and shoulder
 * abduction (face on), seated on a stool for knee extension. Only the exercising limb moves with
 * the reading (`skeletonFor`); the tracker's rings and segments and the goniometer arc sit on
 * its joints, and `rangeDeg` shades the range covered from rest to that reading, end to end. Drive
 * `angle` with `useRepLoop` to sweep the limb through that range rep after rep; a new fixed reading
 * sweeps the limb to it. The body is built once: switching exercise only re-poses it.
 * Never rendered in tests: use `LazyJointScene`.
 */
export default function JointScene({ exercise, angle, goalDeg, rangeDeg, idle = true, className = '', label }: JointSceneProps) {
  const reduce = useReducedMotion() ?? false
  const fixed = typeof angle === 'number' ? angle : angle.get()
  const floorY = FRAMING[exercise].offset[1]
  return (
    <div className={`relative ${className}`.trim()} role="img" aria-label={label}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0.7, 0.35, 4.6], fov: 36 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} frameloop={reduce ? 'demand' : 'always'}>
        <hemisphereLight args={['#ffffff', '#9aa8c2', 1.0]} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, 1.5, -3]} intensity={1.4} color="#c9d6ff" />
        <Body exercise={exercise} angle={reduce ? fixed : angle} goalDeg={goalDeg} rangeDeg={rangeDeg} idle={!reduce && idle} reduce={reduce} />
        <Grid position={[0, floorY - 0.001, 0]} args={[12, 12]} cellSize={0.25} sectionSize={1} cellColor="#dfe4ef" sectionColor="#b7c2dc" fadeDistance={9} fadeStrength={1.6} infiniteGrid />
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.7} />
      </Canvas>
    </div>
  )
}
