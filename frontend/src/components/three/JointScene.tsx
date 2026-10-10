import type { ExerciseId } from '@arc/dependencies'
import { Grid, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion, type MotionValue } from 'motion/react'
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Group, LatheGeometry, Object3D, Quaternion, Vector2, Vector3 } from 'three'
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

/* Lathe profiles as [t, radius]: t runs 0 at the bone's first joint to 1 at its second. */
const PROFILE: Partial<Record<BoneName, [number, number][]>> = {
  torso: [[-0.03, 0], [0, 0.5], [0.12, 0.53], [0.3, 0.5], [0.5, 0.52], [0.72, 0.58], [0.86, 0.6], [0.94, 0.52], [0.99, 0.3], [1, 0.21], [1.02, 0]],
  rUpperArm: [[-0.03, 0], [0, 0.1], [0.06, 0.165], [0.18, 0.185], [0.4, 0.165], [0.6, 0.17], [0.8, 0.145], [0.95, 0.115], [1, 0.1], [1.03, 0]],
  rForearm: [[-0.04, 0], [0, 0.11], [0.12, 0.15], [0.3, 0.145], [0.55, 0.125], [0.8, 0.1], [0.97, 0.092], [1, 0.09], [1.02, 0]],
  rThigh: [[-0.05, 0], [0, 0.25], [0.1, 0.31], [0.35, 0.3], [0.65, 0.255], [0.9, 0.2], [1, 0.17], [1.04, 0]],
  rShin: [[-0.04, 0], [0, 0.17], [0.15, 0.205], [0.3, 0.21], [0.55, 0.17], [0.85, 0.13], [1, 0.12], [1.03, 0]],
}
PROFILE.lUpperArm = PROFILE.rUpperArm
PROFILE.lForearm = PROFILE.rForearm
PROFILE.lThigh = PROFILE.rThigh
PROFILE.lShin = PROFILE.rShin
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

function lathe(profile: [number, number][]) {
  return new LatheGeometry(
    profile.map(([t, r]) => new Vector2(r, t)),
    40,
  )
}

/** Puts an object at `from` with its local +Y pointing at `to`; `stretch` scales +Y to the bone's length. */
function place(o: Object3D, from: V3, to: V3, stretch: boolean, scale: [number, number] = [1, 1]) {
  const d = new Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  const len = d.length()
  o.position.set(from[0], from[1], from[2])
  o.quaternion.copy(new Quaternion().setFromUnitVectors(UP, d.normalize()))
  o.scale.set(scale[0], stretch ? len : 1, scale[1])
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

/** The goniometer ribbon at the moving joint, from the rest direction to the current one. */
function writeGauge(geometry: BufferGeometry, centre: [number, number], radius: number, width: number, fromDeg: number, toDeg: number, z: number) {
  const attr = geometry.getAttribute('position') as BufferAttribute
  for (let i = 0; i <= STEPS; i++) {
    const t = rad(fromDeg + ((toDeg - fromDeg) * i) / STEPS)
    attr.setXYZ(i * 2, centre[0] + (radius - width) * Math.cos(t), centre[1] + (radius - width) * Math.sin(t), z)
    attr.setXYZ(i * 2 + 1, centre[0] + (radius + width) * Math.cos(t), centre[1] + (radius + width) * Math.sin(t), z)
  }
  attr.needsUpdate = true
  geometry.computeBoundingSphere()
}

function Skin({ color = SKIN }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.45} metalness={0.06} side={DoubleSide} />
}

/** A tracked joint as the camera app sees it: a cobalt ring around a navy landmark dot. */
function Landmark({ r }: { r: number }) {
  return (
    <>
      <mesh>
        <torusGeometry args={[r, r * 0.14, 12, 40]} />
        <meshBasicMaterial color={COBALT} />
      </mesh>
      <mesh>
        <circleGeometry args={[r * 0.38, 24]} />
        <meshBasicMaterial color={NAVY} />
      </mesh>
    </>
  )
}

/** An open hand along local +Y from the wrist: palm, four fingers, a thumb. */
function Hand() {
  return (
    <>
      <RoundedBox args={[0.27, 0.36, 0.11]} radius={0.045} smoothness={4} position={[0, 0.19, 0]}>
        <Skin />
      </RoundedBox>
      {[-0.095, -0.032, 0.032, 0.095].map((x, i) => (
        <mesh key={x} position={[x, 0.5 - Math.abs(i - 1.5) * 0.02, 0.01]} rotation={[0.18, 0, 0]}>
          <capsuleGeometry args={[0.038, 0.2 - Math.abs(i - 1.5) * 0.03, 6, 12]} />
          <Skin />
        </mesh>
      ))}
      <mesh position={[0.16, 0.2, 0.03]} rotation={[0.2, 0, -0.65]}>
        <capsuleGeometry args={[0.042, 0.16, 6, 12]} />
        <Skin />
      </mesh>
    </>
  )
}

/** A foot along local +Y from the ankle to the toes, the heel behind the ankle. */
function Foot({ view }: { view: Skeleton['view'] }) {
  // Side on, the sole faces local +X; face on (the foot pointing at the camera), local −Z.
  return view === 'side' ? (
    <RoundedBox args={[0.2, 0.98, 0.3]} radius={0.08} smoothness={4} position={[0.03, 0.27, 0]}>
      <Skin />
    </RoundedBox>
  ) : (
    <RoundedBox args={[0.3, 0.98, 0.2]} radius={0.08} smoothness={4} position={[0, 0.27, -0.03]}>
      <Skin />
    </RoundedBox>
  )
}

/** The head: a skull and a nose that shows which way the body faces. */
function Head({ view }: { view: Skeleton['view'] }) {
  return (
    <>
      {/* About 22 cm tall, 15 cm wide and 19 cm deep. */}
      <mesh position={[0, 0.41, 0]} scale={[view === 'side' ? 0.35 : 0.29, 0.42, view === 'side' ? 0.29 : 0.35]}>
        <sphereGeometry args={[1, 32, 24]} />
        <Skin />
      </mesh>
      <mesh position={view === 'side' ? [0.36, 0.36, 0] : [0, 0.36, 0.36]}>
        <sphereGeometry args={[0.06, 16, 12]} />
        <Skin />
      </mesh>
    </>
  )
}

/** The stool under the seated exercise: a slab on four legs. */
function Stool({ seat }: { seat: NonNullable<Skeleton['seat']> }) {
  const [x0, x1] = seat.x
  const [z0, z1] = seat.z
  const legs: [number, number][] = [
    [x0 + 0.12, z0 + 0.12],
    [x0 + 0.12, z1 - 0.12],
    [x1 - 0.12, z0 + 0.12],
    [x1 - 0.12, z1 - 0.12],
  ]
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, seat.top - 0.06, (z0 + z1) / 2]}>
        <boxGeometry args={[x1 - x0, 0.12, z1 - z0]} />
        <meshStandardMaterial color={SEAT} roughness={0.7} />
      </mesh>
      {legs.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, (seat.top - 0.12) / 2, z]}>
          <boxGeometry args={[0.08, seat.top - 0.12, 0.08]} />
          <meshStandardMaterial color={NAVY} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

type Refs = RefObject<Record<string, Object3D | undefined>>
const bind = (refs: Refs, key: string) => (o: Object3D | null) => {
  if (o) refs.current[key] = o
  else delete refs.current[key]
}

function BonePart({ name, view, refs }: { name: BoneName; view: Skeleton['view']; refs: Refs }) {
  const geometry = useMemo(() => (PROFILE[name] ? lathe(PROFILE[name]!) : null), [name])
  if (geometry) {
    return (
      <mesh ref={bind(refs, name)} geometry={geometry}>
        <Skin />
      </mesh>
    )
  }
  let body: ReactNode = null
  if (name === 'rHand' || name === 'lHand') body = <Hand />
  if (name === 'rFoot' || name === 'lFoot') body = <Foot view={view} />
  if (name === 'head') body = <Head view={view} />
  if (name === 'neck')
    body = (
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.4, 24]} />
        <Skin />
      </mesh>
    )
  if (name === 'pelvis')
    // The pelvis bone runs hip to hip; the hips are an ellipsoid set on its middle.
    body = (
      <mesh position={[0, 0.33, 0]} scale={view === 'side' ? [0.42, 0.62, 0.36] : [0.36, 0.62, 0.42]}>
        <sphereGeometry args={[1, 32, 24]} />
        <Skin />
      </mesh>
    )
  return <group ref={bind(refs, name)}>{body}</group>
}

/** The range covered, end to end: a faint band from rest to `rangeDeg` round the moving joint, ticked at both ends. */
function RangeBand({ exercise, rangeDeg }: { exercise: ExerciseId; rangeDeg: number }) {
  const { geometry, ends, mid, z, radius } = useMemo(() => {
    const o = skeletonFor(exercise, restFor(exercise)).overlay
    const r = o.reach * 0.55
    const g = gaugeGeometry()
    const end = directionFor(exercise, rangeDeg)
    writeGauge(g, o.mid, r, r * 0.17, o.restDeg, end, o.z - 0.01)
    return { geometry: g, ends: [o.restDeg, end], mid: o.mid, z: o.z, radius: r }
  }, [exercise, rangeDeg])
  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={COBALT} side={DoubleSide} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {ends.map((d) => (
        <mesh key={d} position={[mid[0] + radius * Math.cos(rad(d)), mid[1] + radius * Math.sin(rad(d)), z]} rotation={[0, 0, rad(d)]}>
          <boxGeometry args={[radius * 0.5, radius * 0.045, 0.02]} />
          <meshBasicMaterial color={COBALT} />
        </mesh>
      ))}
    </group>
  )
}

function Body({ exercise, angle, goalDeg, rangeDeg, idle, reduce }: Pick<JointSceneProps, 'exercise' | 'angle' | 'goalDeg' | 'rangeDeg' | 'idle'> & { reduce: boolean }) {
  const sway = useRef<Group>(null)
  const refs = useRef<Record<string, Object3D | undefined>>({})
  const gauge = useMemo(gaugeGeometry, [])
  const shown = useRef<{ exercise: ExerciseId; deg: number } | null>(null)
  const applied = useRef<{ exercise: ExerciseId; deg: number } | null>(null)
  const invalidate = useThree((s) => s.invalidate)
  const frame = FRAMING[exercise]
  const first = useMemo(() => skeletonFor(exercise, typeof angle === 'number' ? angle : angle.get()), [exercise]) // eslint-disable-line react-hooks/exhaustive-deps
  const ring = 0.075 / frame.scale

  // Reduced motion renders on demand: draw again whenever the reading or the movement changes.
  useEffect(() => invalidate(), [invalidate, exercise, angle, goalDeg])

  const apply = (s: Skeleton, deg: number) => {
    const j = s.joints
    for (const bone of BONES) {
      const o = refs.current[bone.name]
      if (!o) continue
      const from = j[bone.from]
      const to = j[bone.to]
      if (bone.name === 'pelvis') {
        // Hip to hip, set on its middle, the ellipsoid's long axis along the hips.
        place(o, [(from[0] + to[0]) / 2 - (s.view === 'front' ? 0 : 0), (from[1] + to[1]) / 2 - 0.2, (from[2] + to[2]) / 2], [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + 1, (from[2] + to[2]) / 2], false)
        continue
      }
      const lathed = PROFILE[bone.name] != null
      // The exercising biceps shortens and thickens as the elbow bends.
      const girth = exercise === 'elbow_flexion' && bone.name === 'rUpperArm' ? 1 + 0.14 * Math.min(1, deg / 140) : 1
      const flat: [number, number] = bone.name === 'torso' ? (s.view === 'side' ? [CHEST_DEPTH, 1] : [1, CHEST_DEPTH]) : [girth, girth]
      place(o, from, to, lathed, flat)
    }
    for (const [name] of BALLS) refs.current[`ball-${name}`]?.position.set(...j[name])

    const o = s.overlay
    const z = o.z
    refs.current['ring-base']?.position.set(o.base[0], o.base[1], z + 0.01)
    refs.current['ring-mid']?.position.set(o.mid[0], o.mid[1], z + 0.01)
    refs.current['ring-end']?.position.set(o.end[0], o.end[1], z + 0.01)
    const proximal = refs.current['line-proximal']
    if (proximal) place(proximal, [o.base[0], o.base[1], z], [o.mid[0], o.mid[1], z], true)
    const distal = refs.current['line-distal']
    if (distal) place(distal, [o.mid[0], o.mid[1], z], [o.end[0], o.end[1], z], true)
    const radius = o.reach * 0.55
    writeGauge(gauge, o.mid, radius, radius * 0.07, o.restDeg, o.currentDeg, z)
    const tick = refs.current['goal-tick']
    if (tick && goalDeg != null) {
      const g = directionFor(exercise, goalDeg)
      tick.position.set(o.mid[0] + radius * Math.cos(rad(g)), o.mid[1] + radius * Math.sin(rad(g)), z + 0.01)
      tick.rotation.z = rad(g)
      tick.scale.setScalar(radius / 0.55)
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

  return (
    <group ref={sway}>
      <group key={exercise} position={frame.offset} scale={frame.scale}>
        {BONES.map((bone) => (
          <BonePart key={bone.name} name={bone.name} view={first.view} refs={refs} />
        ))}
        {BALLS.map(([name, r]) => (
          <mesh key={name} ref={bind(refs, `ball-${name}`)}>
            <sphereGeometry args={[r, 24, 18]} />
            <Skin color={JOINT} />
          </mesh>
        ))}
        {first.seat && <Stool seat={first.seat} />}

        {/* The camera app's view on top of the body: landmark rings, the tracked segments, the arc. */}
        <group ref={bind(refs, 'line-proximal')}>
          <Line points={[[0, 0, 0], [0, 1, 0]]} color={COBALT} lineWidth={2.5} transparent opacity={0.9} />
        </group>
        <group ref={bind(refs, 'line-distal')}>
          <Line points={[[0, 0, 0], [0, 1, 0]]} color={COBALT} lineWidth={2.5} transparent opacity={0.9} />
        </group>
        <group ref={bind(refs, 'ring-base')}>
          <Landmark r={ring * 1.1} />
        </group>
        <group ref={bind(refs, 'ring-mid')}>
          <Landmark r={ring} />
        </group>
        <group ref={bind(refs, 'ring-end')}>
          <Landmark r={ring * 0.85} />
        </group>
        {rangeDeg != null && <RangeBand exercise={exercise} rangeDeg={rangeDeg} />}
        <mesh geometry={gauge}>
          <meshBasicMaterial color={COBALT} side={DoubleSide} transparent opacity={0.85} />
        </mesh>
        {goalDeg != null && (
          <group ref={bind(refs, 'goal-tick')}>
            <mesh>
              <boxGeometry args={[0.2, 0.04, 0.04]} />
              <meshBasicMaterial color={NAVY} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  )
}

/**
 * A whole body performing the exercise: head, neck, torso, pelvis, both arms with hands, both legs
 * with feet, and mannequin ball joints, standing for elbow flexion (side on) and shoulder
 * abduction (face on), seated on a stool for knee extension. Only the exercising limb moves with
 * the reading (`skeletonFor`); the camera app's rings and segments and the goniometer arc sit on
 * its joints, and `rangeDeg` shades the range covered from rest to that reading, end to end. Drive
 * `angle` with `useRepLoop` to sweep the limb through that range rep after rep; a new fixed reading
 * sweeps the limb to it. Never rendered in tests: use `LazyJointScene`.
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
