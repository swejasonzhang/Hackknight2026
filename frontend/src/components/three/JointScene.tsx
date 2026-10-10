import type { ExerciseId } from '@arc/dependencies'
import { Grid, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useReducedMotion, type MotionValue } from 'motion/react'
import { useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, Quaternion, Vector3 } from 'three'
import { armPose, type Pose } from './armPose'

export interface JointSceneProps {
  exercise: ExerciseId
  /** The metric angle to pose at: a Motion value that changes every frame, or a fixed number. */
  angle: MotionValue<number> | number
  /** Drawn as an amber tick on the gauge. */
  goalDeg?: number
  /** Slow sway of the whole limb so the depth reads; off under reduced motion. */
  idle?: boolean
  className?: string
  /** What the picture shows, for assistive tech. */
  label: string
  /** `light` draws for paper (navy bones, cobalt ink); `dark` for a black stage. */
  theme?: 'light' | 'dark'
}

interface Palette {
  bone: string
  joint: string
  end: string
  gauge: string
  goal: string
  key: string
  fill: string
  gridCell: string
  gridSection: string
  ambient: number
}
const PALETTES: Record<'light' | 'dark', Palette> = {
  light: { bone: '#0b1b3a', joint: '#0b3dff', end: '#0b1b3a', gauge: '#0b3dff', goal: '#0b1b3a', key: '#ffffff', fill: '#ffffff', gridCell: '#dfe4ef', gridSection: '#b7c2dc', ambient: 1.4 },
  dark: { bone: '#cfd3da', joint: '#00a1ff', end: '#ffffff', gauge: '#00a1ff', goal: '#ffb020', key: '#00a1ff', fill: '#ffffff', gridCell: '#163354', gridSection: '#0b5c8e', ambient: 0.55 },
}
const GAUGE_R = 0.46
const GAUGE_STEPS = 64
const UP = new Vector3(0, 1, 0)
const rad = (deg: number) => (deg * Math.PI) / 180

/** Points a unit-height cylinder from `a` to `b`. */
function placeBone(mesh: Mesh, a: [number, number], b: [number, number]) {
  const from = new Vector3(a[0], a[1], 0)
  const to = new Vector3(b[0], b[1], 0)
  const dir = to.clone().sub(from)
  const len = dir.length()
  mesh.position.copy(from).add(dir.clone().multiplyScalar(0.5))
  mesh.scale.set(1, len, 1)
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP, dir.normalize()))
}

function gaugeGeometry(): BufferGeometry {
  const g = new BufferGeometry()
  const positions = new Float32Array((GAUGE_STEPS + 1) * 2 * 3)
  g.setAttribute('position', new BufferAttribute(positions, 3))
  const index: number[] = []
  for (let i = 0; i < GAUGE_STEPS; i++) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  g.setIndex(index)
  return g
}

/** Writes the ribbon vertices for an arc from `fromDeg` to `toDeg` around `centre`. */
function writeGauge(geometry: BufferGeometry, centre: [number, number], fromDeg: number, toDeg: number) {
  const attr = geometry.getAttribute('position') as BufferAttribute
  const inner = GAUGE_R - 0.035
  const outer = GAUGE_R + 0.035
  for (let i = 0; i <= GAUGE_STEPS; i++) {
    const t = fromDeg + ((toDeg - fromDeg) * i) / GAUGE_STEPS
    const c = Math.cos(rad(t))
    const s = Math.sin(rad(t))
    attr.setXYZ(i * 2, centre[0] + inner * c, centre[1] + inner * s, 0.02)
    attr.setXYZ(i * 2 + 1, centre[0] + outer * c, centre[1] + outer * s, 0.02)
  }
  attr.needsUpdate = true
}

function Limb({ exercise, angle, goalDeg, idle, pal }: Pick<JointSceneProps, 'exercise' | 'angle' | 'goalDeg' | 'idle'> & { pal: Palette }) {
  const group = useRef<Group>(null)
  const base = useRef<Mesh>(null)
  const mid = useRef<Mesh>(null)
  const end = useRef<Mesh>(null)
  const proximal = useRef<Mesh>(null)
  const distal = useRef<Mesh>(null)
  const goalTick = useRef<Mesh>(null)
  const gauge = useMemo(gaugeGeometry, [])
  const last = useRef<{ exercise: ExerciseId; angle: number } | null>(null)

  const apply = (pose: Pose) => {
    base.current?.position.set(pose.base[0], pose.base[1], 0)
    mid.current?.position.set(pose.mid[0], pose.mid[1], 0)
    end.current?.position.set(pose.end[0], pose.end[1], 0)
    if (proximal.current) placeBone(proximal.current, pose.base, pose.mid)
    if (distal.current) placeBone(distal.current, pose.mid, pose.end)
    writeGauge(gauge, pose.mid, pose.gaugeFromDeg, pose.distalDeg)
    if (goalTick.current && goalDeg != null) {
      const g = armPose(exercise, goalDeg)
      goalTick.current.position.set(pose.mid[0] + GAUGE_R * Math.cos(rad(g.distalDeg)), pose.mid[1] + GAUGE_R * Math.sin(rad(g.distalDeg)), 0.03)
      goalTick.current.rotation.z = rad(g.distalDeg)
    }
  }

  useFrame((state) => {
    const a = typeof angle === 'number' ? angle : angle.get()
    if (!last.current || last.current.angle !== a || last.current.exercise !== exercise) {
      apply(armPose(exercise, a))
      last.current = { exercise, angle: a }
    }
    if (group.current) group.current.rotation.y = idle ? Math.sin(state.clock.elapsedTime * 0.45) * 0.38 : 0
  })

  return (
    <group ref={group} position={[0, -0.15, 0]}>
      <mesh ref={proximal}>
        <cylinderGeometry args={[0.055, 0.065, 1, 20]} />
        <meshStandardMaterial color={pal.bone} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh ref={distal}>
        <cylinderGeometry args={[0.045, 0.055, 1, 20]} />
        <meshStandardMaterial color={pal.bone} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh ref={base}>
        <sphereGeometry args={[0.1, 24, 24]} />
        <meshStandardMaterial color={pal.joint} emissive={pal.joint} emissiveIntensity={0.35} />
      </mesh>
      <mesh ref={mid}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial color={pal.joint} emissive={pal.joint} emissiveIntensity={0.5} />
      </mesh>
      <mesh ref={end}>
        <sphereGeometry args={[0.1, 24, 24]} />
        <meshStandardMaterial color={pal.end} emissive={pal.end} emissiveIntensity={0.25} />
      </mesh>
      <mesh geometry={gauge}>
        <meshBasicMaterial color={pal.gauge} side={DoubleSide} transparent opacity={0.9} />
      </mesh>
      {goalDeg != null && (
        <mesh ref={goalTick}>
          <boxGeometry args={[0.16, 0.024, 0.024]} />
          <meshBasicMaterial color={pal.goal} />
        </mesh>
      )}
    </group>
  )
}

/**
 * A limb performing the exercise: three landmark spheres joined by two bones, a gauge ribbon at
 * the moving joint and an amber goal tick. Drive `angle` with a Motion value for live reps or a
 * number for a fixed pose. Never rendered in tests: import it through `LazyJointScene`.
 */
export default function JointScene({ exercise, angle, goalDeg, idle = true, className = '', label, theme = 'light' }: JointSceneProps) {
  const reduce = useReducedMotion()
  const pal = PALETTES[theme]
  const fixed = typeof angle === 'number' ? angle : angle.get()
  return (
    <div className={`relative ${className}`.trim()} role="img" aria-label={label}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0.9, 0.5, 4.4], fov: 36 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} frameloop={reduce ? 'demand' : 'always'}>
        <ambientLight intensity={pal.ambient} />
        <pointLight position={[2.5, 3, 3]} intensity={theme === 'light' ? 22 : 38} color={pal.key} />
        <pointLight position={[-3, 2, -2]} intensity={theme === 'light' ? 10 : 14} color={pal.fill} />
        <Limb exercise={exercise} angle={reduce ? fixed : angle} goalDeg={goalDeg} idle={!reduce && idle} pal={pal} />
        <Grid position={[0, -1.75, 0]} args={[12, 12]} cellSize={0.5} sectionSize={2} cellColor={pal.gridCell} sectionColor={pal.gridSection} fadeDistance={11} fadeStrength={1.6} infiniteGrid />
        <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.7} />
      </Canvas>
    </div>
  )
}
