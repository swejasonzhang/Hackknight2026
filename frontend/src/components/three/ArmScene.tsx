import { Line, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useReducedMotion, type MotionValue } from 'motion/react'
import { useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Group, LatheGeometry, Vector2 } from 'three'
import { DISTAL, PROXIMAL } from './armPose'

export interface ArmSceneProps {
  /** Elbow flexion in degrees: a Motion value for live reps or a fixed number. */
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
const NAVY = '#0b1b3a'
const COBALT = '#0b3dff'
const TRACK_Z = 0.34
const GAUGE_R = 0.46
const STEPS = 64
const rad = (d: number) => (d * Math.PI) / 180
const clamp = (v: number) => Math.min(180, Math.max(0, v))

/** Upper arm, elbow (y = 0) to shoulder (y = PROXIMAL): a biceps belly and a deltoid cap. */
const UPPER: [number, number][] = [
  [0.0, -0.02],
  [0.095, 0.0],
  [0.118, 0.1],
  [0.148, 0.3],
  [0.166, 0.5],
  [0.155, 0.7],
  [0.152, 0.84],
  [0.172, 0.96],
  [0.14, 1.07],
  [0.06, 1.13],
  [0.0, 1.14],
]
/** Forearm, wrist (y = -DISTAL) to elbow (y = 0): the muscle mass near the elbow, slim at the wrist. */
const FORE: [number, number][] = [
  [0.0, -DISTAL],
  [0.062, -DISTAL + 0.01],
  [0.074, -0.9],
  [0.086, -0.72],
  [0.112, -0.42],
  [0.126, -0.22],
  [0.116, -0.08],
  [0.095, 0.02],
  [0.0, 0.05],
]

function lathe(profile: [number, number][]) {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(r, y)),
    40,
  )
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

/** The ribbon from the forearm's rest direction (straight down) to its current direction. */
function writeGauge(geometry: BufferGeometry, toDeg: number) {
  const attr = geometry.getAttribute('position') as BufferAttribute
  const from = -90
  for (let i = 0; i <= STEPS; i++) {
    const t = rad(from + ((toDeg - from) * i) / STEPS)
    attr.setXYZ(i * 2, (GAUGE_R - 0.03) * Math.cos(t), (GAUGE_R - 0.03) * Math.sin(t), TRACK_Z)
    attr.setXYZ(i * 2 + 1, (GAUGE_R + 0.03) * Math.cos(t), (GAUGE_R + 0.03) * Math.sin(t), TRACK_Z)
  }
  attr.needsUpdate = true
}

/** A tracked joint as the camera app sees it: a cobalt ring around a navy landmark dot. */
function Landmark({ y = 0, size = 1 }: { y?: number; size?: number }) {
  return (
    <group position={[0, y, TRACK_Z + 0.01]}>
      <mesh>
        <torusGeometry args={[0.085 * size, 0.012, 12, 40]} />
        <meshBasicMaterial color={COBALT} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.032 * size, 24]} />
        <meshBasicMaterial color={NAVY} />
      </mesh>
    </group>
  )
}

/** A loose fist: palm, four curled fingers spread across the hand, a thumb. */
function Hand() {
  const fingers = [-0.054, -0.018, 0.018, 0.054]
  return (
    <group position={[0, -DISTAL - 0.02, 0]}>
      <RoundedBox args={[0.09, 0.2, 0.17]} radius={0.035} smoothness={4} position={[0.01, -0.11, 0]}>
        <meshStandardMaterial color={SKIN} roughness={0.42} metalness={0.08} />
      </RoundedBox>
      {fingers.map((z, i) => (
        <mesh key={z} position={[0.052, -0.2 + i * 0.004, z]} rotation={[0, 0, 1.1]}>
          <capsuleGeometry args={[0.024, 0.05 - Math.abs(z) * 0.2, 6, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.42} metalness={0.08} />
        </mesh>
      ))}
      <mesh position={[0.06, -0.09, -0.085]} rotation={[0.5, 0, 0.6]}>
        <capsuleGeometry args={[0.024, 0.07, 6, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.42} metalness={0.08} />
      </mesh>
    </group>
  )
}

function Arm({ angle, goalDeg, idle }: Pick<ArmSceneProps, 'angle' | 'goalDeg' | 'idle'>) {
  const root = useRef<Group>(null)
  const forearm = useRef<Group>(null)
  const biceps = useRef<Group>(null)
  const goalTick = useRef<Group>(null)
  const upper = useMemo(() => lathe(UPPER), [])
  const fore = useMemo(() => lathe(FORE), [])
  const gauge = useMemo(gaugeGeometry, [])
  const last = useRef<number | null>(null)

  useFrame((state) => {
    const m = clamp(typeof angle === 'number' ? angle : angle.get())
    if (last.current !== m) {
      last.current = m
      if (forearm.current) forearm.current.rotation.z = rad(m)
      // The biceps shortens and thickens as the elbow bends.
      if (biceps.current) {
        const k = 1 + 0.14 * Math.min(1, m / 140)
        biceps.current.scale.set(k, 1 - 0.04 * Math.min(1, m / 140), k)
      }
      writeGauge(gauge, -90 + m)
    }
    if (goalTick.current && goalDeg != null) goalTick.current.rotation.z = rad(-90 + goalDeg)
    if (root.current) root.current.rotation.y = idle ? -0.25 + Math.sin(state.clock.elapsedTime * 0.4) * 0.32 : -0.25
  })

  return (
    <group ref={root} position={[-0.12, -0.02, 0]} scale={0.95}>
      {/* Upper arm, hanging still from the shoulder; the elbow sits at the origin. */}
      <group ref={biceps}>
        <mesh geometry={upper}>
          <meshStandardMaterial color={SKIN} roughness={0.42} metalness={0.08} side={DoubleSide} />
        </mesh>
      </group>

      {/* Forearm and hand rotate together about the elbow. */}
      <group ref={forearm}>
        <mesh geometry={fore}>
          <meshStandardMaterial color={SKIN} roughness={0.42} metalness={0.08} side={DoubleSide} />
        </mesh>
        <Hand />
        <Line points={[[0, 0, TRACK_Z], [0, -DISTAL, TRACK_Z]]} color={COBALT} lineWidth={2.5} transparent opacity={0.9} />
        <Landmark y={-DISTAL} size={0.85} />
      </group>

      {/* The camera app's view: landmarks and the tracked segment shoulder to elbow. */}
      <Line points={[[0, PROXIMAL, TRACK_Z], [0, 0, TRACK_Z]]} color={COBALT} lineWidth={2.5} transparent opacity={0.9} />
      <Landmark y={PROXIMAL} size={1.1} />
      <Landmark y={0} size={1} />

      {/* The goniometer at the elbow: the measured arc and the goal. */}
      <mesh geometry={gauge}>
        <meshBasicMaterial color={COBALT} side={DoubleSide} transparent opacity={0.85} />
      </mesh>
      {goalDeg != null && (
        <group ref={goalTick}>
          <mesh position={[GAUGE_R, 0, TRACK_Z + 0.01]}>
            <boxGeometry args={[0.16, 0.024, 0.024]} />
            <meshBasicMaterial color={NAVY} />
          </mesh>
        </group>
      )}
    </group>
  )
}

/**
 * A modelled arm performing elbow flexion: torso side, a sculpted upper arm whose biceps
 * contracts with the bend, forearm and fist, with the camera app's tracking overlay (rings at
 * shoulder, elbow and wrist joined by tracked segments) and the goniometer arc at the elbow.
 * Never rendered in tests: import it through `LazyArmScene`.
 */
export default function ArmScene({ angle, goalDeg, idle = true, className = '', label }: ArmSceneProps) {
  const reduce = useReducedMotion()
  const fixed = typeof angle === 'number' ? angle : angle.get()
  return (
    <div className={`relative ${className}`.trim()} role="img" aria-label={label}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0.4, 0.2, 4.9], fov: 36 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} frameloop={reduce ? 'demand' : 'always'}>
        <hemisphereLight args={['#ffffff', '#9aa8c2', 1.0]} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, 1.5, -3]} intensity={1.4} color="#c9d6ff" />
        <Arm angle={reduce ? fixed : angle} goalDeg={goalDeg} idle={!reduce && idle} />
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.7} />
      </Canvas>
    </div>
  )
}
