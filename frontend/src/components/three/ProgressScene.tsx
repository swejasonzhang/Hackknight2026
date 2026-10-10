import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { Color, DoubleSide, type Mesh } from 'three'

export interface ProgressPoint3D {
  label: string
  value: number
  /** Second line in the hover tooltip, e.g. "24 reps". */
  sub?: string
}

export interface ProgressSceneProps {
  points: ProgressPoint3D[]
  goal: number | null
  unit?: string
  /** Newest bars kept when there are more than this. */
  maxBars?: number
  className?: string
  label: string
}

const WIDTH = 0.24
const GAP = 0.14
const HEIGHT = 2.1
const BLUE = new Color('#00a1ff')
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

function Bar({ index, x, target, colour, hovered, onHover, animate }: { index: number; x: number; target: number; colour: Color; hovered: boolean; onHover: (i: number | null, at?: { x: number; y: number }) => void; animate: boolean }) {
  const mesh = useRef<Mesh>(null)
  const start = useRef<number | null>(null)
  useFrame((state) => {
    if (!mesh.current) return
    let h = target
    if (animate) {
      if (start.current == null) start.current = state.clock.elapsedTime
      const t = (state.clock.elapsedTime - start.current - index * 0.045) / 0.7
      h = target * ease(t)
    }
    mesh.current.scale.y = Math.max(0.001, h)
    mesh.current.position.y = h / 2
  })
  return (
    <mesh ref={mesh} position={[x, 0, 0]} onPointerOver={(e) => { e.stopPropagation(); onHover(index, { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }) }} onPointerMove={(e) => { e.stopPropagation(); onHover(index, { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY }) }} onPointerOut={() => onHover(null)}>
      <boxGeometry args={[WIDTH, 1, WIDTH]} />
      <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={hovered ? 0.9 : 0.35} roughness={0.35} metalness={0.2} />
    </mesh>
  )
}

/**
 * A 3D bar per session (one hue, lighter is higher) with a translucent amber goal plane, a hover
 * tooltip and an animated rise on first paint. The DOM list beside the canvas is the text
 * equivalent. Never rendered in tests: import it through `LazyProgressScene`.
 */
export default function ProgressScene({ points, goal, unit = '°', maxBars = 24, className = '', label }: ProgressSceneProps) {
  const reduce = useReducedMotion()
  const [hovered, setHovered] = useState<{ index: number; x: number; y: number } | null>(null)
  const onHover = (index: number | null, at?: { x: number; y: number }) => setHovered(index == null ? null : { index, x: at?.x ?? 0, y: at?.y ?? 0 })
  const shown = points.slice(-maxBars)
  const max = Math.max(goal ?? 0, ...shown.map((p) => p.value), 1)
  const min = Math.min(...shown.map((p) => p.value), goal ?? Infinity)
  const span = (WIDTH + GAP) * shown.length - GAP
  const colours = useMemo(
    () => shown.map((p) => BLUE.clone().offsetHSL(0, 0, (max === min ? 0.5 : (p.value - min) / (max - min)) * 0.22 - 0.08)),
    [shown, max, min],
  )
  const bars = shown.map((p, i) => ({ ...p, x: -span / 2 + WIDTH / 2 + i * (WIDTH + GAP), h: (p.value / max) * HEIGHT }))
  const goalH = goal != null ? (goal / max) * HEIGHT : null
  const hoveredBar = hovered ? bars[hovered.index] : null
  const first = bars[0]
  const lastBar = bars.at(-1)

  return (
    <div className={`relative ${className}`.trim()}>
      <div role="img" aria-label={label} className="h-full w-full">
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 2.1, Math.max(5.2, span * 1.15)], fov: 34 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} frameloop={reduce ? 'demand' : 'always'}>
          <ambientLight intensity={0.6} />
          <pointLight position={[3, 5, 4]} intensity={40} color="#00a1ff" />
          <pointLight position={[-4, 3, -2]} intensity={12} color="#ffffff" />
          <group position={[0, -HEIGHT / 2 + 0.2, 0]}>
            {bars.map((b, i) => (
              <Bar key={b.label + i} index={i} x={b.x} target={b.h} colour={colours[i]!} hovered={hovered?.index === i} onHover={onHover} animate={!reduce} />
            ))}
            {goalH != null && (
              <group position={[0, goalH, 0]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[span + 0.8, 0.9]} />
                  <meshBasicMaterial color="#ffb020" transparent opacity={0.16} side={DoubleSide} depthWrite={false} />
                </mesh>
                <mesh position={[0, 0, 0.45]}>
                  <boxGeometry args={[span + 0.8, 0.012, 0.012]} />
                  <meshBasicMaterial color="#ffb020" />
                </mesh>
              </group>
            )}
          </group>
          <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3.2} maxPolarAngle={Math.PI / 2.1} minAzimuthAngle={-0.6} maxAzimuthAngle={0.6} />
        </Canvas>
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-2 flex justify-between text-[11px] font-medium text-muted" aria-hidden="true">
        <span>{first?.label}</span>
        <span>{lastBar && lastBar !== first ? lastBar.label : ''}</span>
      </div>
      {goal != null && (
        <span aria-hidden="true" className="pointer-events-none absolute top-2 right-3 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-[#ffb020]">
          goal {goal}{unit}
        </span>
      )}
      {hoveredBar && hovered && (
        <div aria-hidden="true" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-[10px] border border-white/15 bg-black/85 px-2.5 py-1.5 text-center whitespace-nowrap shadow-[0_0_20px_rgb(0_161_255/0.35)]" style={{ left: hovered.x, top: hovered.y }}>
          <div className="text-[13px] font-semibold text-white tabular-nums">{Math.round(hoveredBar.value)}{unit}</div>
          <div className="text-[11px] text-[#8b8b94]">{hoveredBar.label}{hoveredBar.sub ? ` · ${hoveredBar.sub}` : ''}</div>
        </div>
      )}
      <ul className="sr-only">
        {shown.map((p) => (
          <li key={p.label}>{p.label}: {Math.round(p.value)}{unit}{p.sub ? `, ${p.sub}` : ''}</li>
        ))}
        {goal != null && <li>Goal: {goal}{unit}</li>}
      </ul>
    </div>
  )
}
