import type { ExerciseId } from '@arc/dependencies'
import { Grid, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion, type MotionValue } from 'motion/react'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Group, LatheGeometry, Object3D, Quaternion, Vector2, Vector3 } from 'three'
import { armPose, type Pose } from './armPose'
import { bodyFor, FRAMING, type PartName } from './bodyPose'

export interface JointSceneProps {
  exercise: ExerciseId
  /** The metric angle to pose at: a Motion value that changes every frame, or a fixed number. */
  angle: MotionValue<number> | number
  /** Drawn as a navy tick on the gauge. */
  goalDeg?: number
  /** Slow sway of the whole body so the depth reads; off under reduced motion. */
  idle?: boolean
  className?: string
  /** What the picture shows, for assistive tech. */
  label: string
}

const SKIN = '#c9d2df'
const SEAT = '#dfe4ef'
const NAVY = '#0b1b3a'
const COBALT = '#0b3dff'
const TRACK_Z = 0.36
const GAUGE_R = 0.46
const GAUGE_STEPS = 64
const UP = new Vector3(0, 1, 0)
const rad = (deg: number) => (deg * Math.PI) / 180

/* Lathe profiles as [t, radius], t running 0 at the part's `from` joint to 1 at its `to` joint. */
const PROFILES: Partial<Record<PartName, [number, number][]>> = {
  upperArm: [[-0.02, 0], [0.01, 0.06], [0.06, 0.14], [0.16, 0.172], [0.26, 0.152], [0.39, 0.155], [0.56, 0.166], [0.74, 0.148], [0.91, 0.118], [1, 0.095], [1.02, 0]],
  forearm: [[-0.05, 0], [-0.02, 0.095], [0.08, 0.116], [0.22, 0.126], [0.42, 0.112], [0.72, 0.086], [0.9, 0.074], [0.99, 0.062], [1, 0]],
  thigh: [[-0.04, 0], [0, 0.17], [0.12, 0.205], [0.35, 0.215], [0.6, 0.195], [0.85, 0.16], [0.97, 0.13], [1.03, 0]],
  shin: [[-0.05, 0], [-0.01, 0.12], [0.1, 0.13], [0.28, 0.125], [0.55, 0.1], [0.85, 0.072], [0.98, 0.062], [1, 0]],
  torso: [[-0.02, 0], [0, 0.25], [0.12, 0.28], [0.4, 0.25], [0.7, 0.28], [0.88, 0.32], [0.97, 0.27], [1.02, 0]],
}
/** A chest is wider than it is deep: flatten front to back, along whichever axis faces the camera's depth. */
const CHEST_DEPTH = 0.62

function lathe(profile: [number, number][]) {
  return new LatheGeometry(
    profile.map(([t, r]) => new Vector2(r, t)),
    40,
  )
}

/** Puts an object at `from`, its local +Y pointing at `to`; `stretch` scales +Y to the segment's length. */
function place(o: Object3D, from: [number, number], to: [number, number], stretch: boolean, { girth = 1, x = 1, z = 1, depth = 0 }: { girth?: number; x?: number; z?: number; depth?: number } = {}) {
  const dir = new Vector3(to[0] - from[0], to[1] - from[1], 0)
  const len = dir.length()
  o.position.set(from[0], from[1], depth)
  o.quaternion.copy(new Quaternion().setFromUnitVectors(UP, dir.normalize()))
  o.scale.set(girth * x, stretch ? len : 1, girth * z)
}

function gaugeGeometry(): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array((GAUGE_STEPS + 1) * 6), 3))
  const index: number[] = []
  for (let i = 0; i < GAUGE_STEPS; i++) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  g.setIndex(index)
  return g
}

/** The goniometer ribbon at the moving joint, from the rest direction to the current one. */
function writeGauge(geometry: BufferGeometry, centre: [number, number], fromDeg: number, toDeg: number) {
  const attr = geometry.getAttribute('position') as BufferAttribute
  for (let i = 0; i <= GAUGE_STEPS; i++) {
    const t = rad(fromDeg + ((toDeg - fromDeg) * i) / GAUGE_STEPS)
    attr.setXYZ(i * 2, centre[0] + (GAUGE_R - 0.03) * Math.cos(t), centre[1] + (GAUGE_R - 0.03) * Math.sin(t), TRACK_Z)
    attr.setXYZ(i * 2 + 1, centre[0] + (GAUGE_R + 0.03) * Math.cos(t), centre[1] + (GAUGE_R + 0.03) * Math.sin(t), TRACK_Z)
  }
  attr.needsUpdate = true
}

function Skin() {
  return <meshStandardMaterial color={SKIN} roughness={0.42} metalness={0.08} side={DoubleSide} />
}

/** A tracked joint as the camera app sees it: a cobalt ring around a navy landmark dot. */
function Landmark({ size = 1 }: { size?: number }) {
  return (
    <>
      <mesh>
        <torusGeometry args={[0.085 * size, 0.012, 12, 40]} />
        <meshBasicMaterial color={COBALT} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.032 * size, 24]} />
        <meshBasicMaterial color={NAVY} />
      </mesh>
    </>
  )
}

/** A loose fist along local +Y from the wrist: palm, four curled fingers, a thumb. */
function Hand() {
  return (
    <>
      <RoundedBox args={[0.09, 0.2, 0.17]} radius={0.035} smoothness={4} position={[0.01, 0.1, 0]}>
        <Skin />
      </RoundedBox>
      {[-0.054, -0.018, 0.018, 0.054].map((z, i) => (
        <mesh key={z} position={[0.052, 0.19 - i * 0.004, z]} rotation={[0, 0, -1.1]}>
          <capsuleGeometry args={[0.024, 0.05 - Math.abs(z) * 0.2, 6, 12]} />
          <Skin />
        </mesh>
      ))}
      <mesh position={[0.06, 0.08, -0.085]} rotation={[-0.5, 0, -0.6]}>
        <capsuleGeometry args={[0.024, 0.07, 6, 12]} />
        <Skin />
      </mesh>
    </>
  )
}

function Part({ name, refs }: { name: PartName; refs: RefObject<Partial<Record<PartName, Object3D>>> }) {
  const geometry = useMemo(() => (PROFILES[name] ? lathe(PROFILES[name]!) : null), [name])
  const bind = (o: Object3D | null) => {
    if (o) refs.current[name] = o
    else delete refs.current[name]
  }
  if (geometry) {
    return (
      <mesh ref={bind} geometry={geometry}>
        <Skin />
      </mesh>
    )
  }
  return (
    <group ref={bind}>
      {name === 'hand' && <Hand />}
      {name === 'head' && (
        <>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 0.14, 20]} />
            <Skin />
          </mesh>
          <mesh position={[0, 0.26, 0]} scale={[1, 1.12, 1]}>
            <sphereGeometry args={[0.16, 32, 24]} />
            <Skin />
          </mesh>
        </>
      )}
      {name === 'foot' && (
        <RoundedBox args={[0.1, 0.32, 0.13]} radius={0.04} smoothness={4} position={[0.03, 0.12, 0]}>
          <Skin />
        </RoundedBox>
      )}
      {name === 'seat' && (
        // A stool: the slab along the segment and a pedestal under it (local +X points down).
        <group>
          <mesh position={[0.06, 0.65, 0]}>
            <boxGeometry args={[0.12, 1.3, 0.7]} />
            <meshStandardMaterial color={SEAT} roughness={0.7} />
          </mesh>
          <mesh position={[0.55, 0.65, 0]}>
            <boxGeometry args={[0.9, 0.16, 0.16]} />
            <meshStandardMaterial color={NAVY} roughness={0.6} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function Body({ exercise, angle, goalDeg, idle, reduce }: Pick<JointSceneProps, 'exercise' | 'angle' | 'goalDeg' | 'idle'> & { reduce: boolean }) {
  const sway = useRef<Group>(null)
  const parts = useRef<Partial<Record<PartName, Object3D>>>({})
  const ring = useRef<Record<'base' | 'mid' | 'end', Object3D | null>>({ base: null, mid: null, end: null })
  const proximal = useRef<Group>(null)
  const distal = useRef<Group>(null)
  const goalTick = useRef<Group>(null)
  const gauge = useMemo(gaugeGeometry, [])
  const names = useMemo(() => bodyFor(exercise, armPose(exercise, 90)).map((p) => p.name), [exercise])
  const shown = useRef<{ exercise: ExerciseId; deg: number } | null>(null)
  const applied = useRef<{ exercise: ExerciseId; deg: number } | null>(null)
  const invalidate = useThree((s) => s.invalidate)
  const frame = FRAMING[exercise]

  // Reduced motion renders on demand: draw again whenever the reading or the movement changes.
  useEffect(() => invalidate(), [invalidate, exercise, angle, goalDeg])

  const apply = (pose: Pose, deg: number) => {
    for (const part of bodyFor(exercise, pose)) {
      const o = parts.current[part.name]
      if (!o) continue
      const lathe = PROFILES[part.name] != null || part.name === 'seat'
      // The biceps shortens and thickens as the elbow bends.
      const girth = exercise === 'elbow_flexion' && part.name === 'upperArm' ? 1 + 0.14 * Math.min(1, deg / 140) : 1
      const flat = part.name === 'torso' ? (part.view === 'side' ? { x: CHEST_DEPTH } : { z: CHEST_DEPTH }) : {}
      place(o, part.from, part.to, lathe, { girth, depth: part.z ?? 0, ...flat })
    }
    ring.current.base?.position.set(pose.base[0], pose.base[1], TRACK_Z + 0.01)
    ring.current.mid?.position.set(pose.mid[0], pose.mid[1], TRACK_Z + 0.01)
    ring.current.end?.position.set(pose.end[0], pose.end[1], TRACK_Z + 0.01)
    if (proximal.current) place(proximal.current, pose.base, pose.mid, true)
    if (distal.current) place(distal.current, pose.mid, pose.end, true)
    writeGauge(gauge, pose.mid, pose.gaugeFromDeg, pose.distalDeg)
    if (goalTick.current && goalDeg != null) {
      const g = armPose(exercise, goalDeg).distalDeg
      goalTick.current.position.set(pose.mid[0] + GAUGE_R * Math.cos(rad(g)), pose.mid[1] + GAUGE_R * Math.sin(rad(g)), TRACK_Z + 0.01)
      goalTick.current.rotation.z = rad(g)
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
      apply(armPose(exercise, deg), deg)
      applied.current = { exercise, deg }
    }
    if (sway.current) sway.current.rotation.y = idle ? -0.2 + Math.sin(state.clock.elapsedTime * 0.45) * 0.34 : -0.2
  })

  return (
    <group ref={sway}>
      <group key={exercise} position={[frame.offset[0], frame.offset[1], 0]} scale={frame.scale}>
        {names.map((name) => (
          <Part key={name} name={name} refs={parts} />
        ))}

        {/* The camera app's view on top of the body: landmark rings and the tracked segments. */}
        <group ref={proximal}>
          <Line points={[[0, 0, TRACK_Z], [0, 1, TRACK_Z]]} color={COBALT} lineWidth={2.5} transparent opacity={0.9} />
        </group>
        <group ref={distal}>
          <Line points={[[0, 0, TRACK_Z], [0, 1, TRACK_Z]]} color={COBALT} lineWidth={2.5} transparent opacity={0.9} />
        </group>
        <group ref={(o) => void (ring.current.base = o)}>
          <Landmark size={1.1} />
        </group>
        <group ref={(o) => void (ring.current.mid = o)}>
          <Landmark size={1} />
        </group>
        <group ref={(o) => void (ring.current.end = o)}>
          <Landmark size={0.85} />
        </group>

        <mesh geometry={gauge}>
          <meshBasicMaterial color={COBALT} side={DoubleSide} transparent opacity={0.85} />
        </mesh>
        {goalDeg != null && (
          <group ref={goalTick}>
            <mesh>
              <boxGeometry args={[0.16, 0.024, 0.024]} />
              <meshBasicMaterial color={NAVY} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  )
}

/**
 * The exercise performed by a modelled body: an arm with a fist for elbow flexion, a torso and
 * a raised arm for shoulder abduction, a seated leg for knee extension. Every part is anchored on
 * the tracked landmarks (`bodyFor`), so the body moves with the joint angle; the camera app's
 * rings and segments and the goniometer arc sit on top. A new reading sweeps the body to it.
 * Never rendered in tests: import it through `LazyJointScene`.
 */
export default function JointScene({ exercise, angle, goalDeg, idle = true, className = '', label }: JointSceneProps) {
  const reduce = useReducedMotion() ?? false
  const fixed = typeof angle === 'number' ? angle : angle.get()
  return (
    <div className={`relative ${className}`.trim()} role="img" aria-label={label}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0.7, 0.35, 4.6], fov: 36 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} frameloop={reduce ? 'demand' : 'always'}>
        <hemisphereLight args={['#ffffff', '#9aa8c2', 1.0]} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, 1.5, -3]} intensity={1.4} color="#c9d6ff" />
        <Body exercise={exercise} angle={reduce ? fixed : angle} goalDeg={goalDeg} idle={!reduce && idle} reduce={reduce} />
        <Grid position={[0, -1.6, 0]} args={[12, 12]} cellSize={0.5} sectionSize={2} cellColor="#dfe4ef" sectionColor="#b7c2dc" fadeDistance={11} fadeStrength={1.6} infiniteGrid />
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.7} />
      </Canvas>
    </div>
  )
}
