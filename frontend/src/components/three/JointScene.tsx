import type { ExerciseId } from '@arc/dependencies'
import { Grid, Line, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion, type MotionValue } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bone, BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, Color, DoubleSide, Group, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, Skeleton as ThreeSkeleton, SkinnedMesh, TorusGeometry, Vector3 } from 'three'
import { HELPER_YELLOW, TARGET_RED } from './colors'
import { bodyPositions, BONE_NAMES, facingFor, GARMENT_LIFT, garmentPositions, garmentSkin, garmentsOf, paintBody, paintGarment, skinMatrices, vertexNormals, visibleTriangles, type BodyAsset, type GarmentName, type Growth, type Palette, type Rgb, type Show } from './body/figure'
import { bodyAsset, loadBody } from './body/load'
import { framingFor, restFor, skeletonFor, sweepFor, type FigureKey, type Skeleton, type V3 } from './skeleton'

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
  /** Whose body: female, male, or between the two (the default). */
  figure?: FigureKey
  /** How far each muscle group has grown with training; none draws the untrained, skinny start. */
  growth?: Growth | null
  /** Colour each muscle group by how far it has grown, instead of the exercise's muscles. */
  growthShade?: boolean
  /** The tracker's rings, segments and goniometer arc on the joint. On by default. */
  instrument?: boolean
  /** Turn slowly all the way round instead of swaying, to show the back as well as the front. */
  spin?: boolean
  /** Frame only this reading (a figure that holds one pose) rather than the movement's whole range. */
  frameAt?: number
  className?: string
  /** What the picture shows, for assistive tech. */
  label: string
  /** Shown in place of the figure until the body has loaded (and if it cannot). */
  fallback?: ReactNode
}

const SKIN = '#cdd4de'
const SHORTS = '#1d2b4b'
const TOP = '#3150d4'
const EYE = '#2a3550'
const GROWN = '#3d6bff'
const SEAT = '#dfe4ef'
const NAVY = '#0b1b3a'
const COBALT = '#0b3dff'
const STEPS = 64
const rad = (deg: number) => (deg * Math.PI) / 180
const rgb = (hex: string): Rgb => {
  const c = new Color(hex)
  return [c.r, c.g, c.b]
}
const PALETTE: Palette = { skin: rgb(SKIN), eye: rgb(EYE), target: rgb(TARGET_RED), helper: rgb(HELPER_YELLOW), grown: rgb(GROWN), fabric: { shorts: rgb(SHORTS), top: rgb(TOP) } }
const GARMENTS: GarmentName[] = ['shorts', 'top']

/*
 * Materials and the instrument's shapes are built once and shared by every mount and every canvas;
 * each mount has its own copy of the body (its figure, its growth and its colours) but they all
 * read the one decoded body.bin. Switching exercise re-poses and repaints; nothing is recompiled
 * mid-animation.
 */
let shared: ReturnType<typeof build> | null = null
function build() {
  return {
    // The body: white, tinted per vertex by skin and the muscle colours.
    body: new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.6, metalness: 0.02 }),
    // The clothes: matt fabric, both faces drawn so the inside shows at a hem.
    fabric: new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.92, metalness: 0, side: DoubleSide }),
    seat: new MeshStandardMaterial({ color: SEAT, roughness: 0.7 }),
    navy: new MeshStandardMaterial({ color: NAVY, roughness: 0.6 }),
    ink: new MeshBasicMaterial({ color: COBALT }),
    dot: new MeshBasicMaterial({ color: NAVY }),
    arc: new MeshBasicMaterial({ color: COBALT, side: DoubleSide, transparent: true, opacity: 0.85 }),
    band: new MeshBasicMaterial({ color: COBALT, side: DoubleSide, transparent: true, opacity: 0.16, depthWrite: false }),
    torus: new TorusGeometry(1, 0.14, 12, 40),
    disc: new CircleGeometry(0.38, 24),
    box: new BoxGeometry(1, 1, 1),
  }
}
const parts = () => (shared ??= build())

/** This mount's body: a skinned mesh over Arc's bones and its clothes on the same bones, sharing the decoded arrays. */
function makeBody(asset: BodyAsset) {
  const geometry = new BufferGeometry()
  geometry.setIndex(new BufferAttribute(asset.index, 1))
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(asset.vertices * 3), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(asset.vertices * 3), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(asset.vertices * 3), 3))
  geometry.setAttribute('skinIndex', new BufferAttribute(asset.skinIndex, 4))
  geometry.setAttribute('skinWeight', new BufferAttribute(asset.skinWeight, 4))
  const mesh = new SkinnedMesh(geometry, parts().body)
  const bones = BONE_NAMES.map((name) => {
    const b = new Bone()
    b.name = name
    // The scene writes each bone's whole matrix: bind pose to the pose, in the body's own space.
    b.matrixAutoUpdate = false
    mesh.add(b)
    return b
  })
  const skeleton = new ThreeSkeleton(bones, bones.map(() => new Matrix4()))
  mesh.bind(skeleton, new Matrix4())
  // The pose moves the body far from its bind-pose bounds (lying for a crunch): never cull it.
  mesh.frustumCulled = false
  // Each garment: its own surface, skinned like the body under it, on the same bones.
  const garments = {} as Record<GarmentName, { mesh: SkinnedMesh; geometry: BufferGeometry }>
  for (const name of GARMENTS) {
    const g = asset.garments[name]
    const geo = new BufferGeometry()
    const count = g.a.length * 3
    geo.setIndex(new BufferAttribute(g.faces, 1))
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count), 3))
    geo.setAttribute('normal', new BufferAttribute(new Float32Array(count), 3))
    geo.setAttribute('color', new BufferAttribute(new Float32Array(count), 3))
    const skin = garmentSkin(asset, g)
    geo.setAttribute('skinIndex', new BufferAttribute(skin.index, 4))
    geo.setAttribute('skinWeight', new BufferAttribute(skin.weight, 4))
    const clothing = new SkinnedMesh(geo, parts().fabric)
    clothing.bind(skeleton, new Matrix4())
    clothing.frustumCulled = false
    // A child of the body, so both sit in the same space and the bones carry both alike.
    mesh.add(clothing)
    garments[name] = { mesh: clothing, geometry: geo }
  }
  return { mesh, bones, geometry, garments }
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

// Reused every frame, so posing allocates little.
const dir = new Vector3()
const UP = new Vector3(0, 1, 0)
const tmpQuat = new Quaternion()

/** Puts an object at `from` with its local +Y pointing at `to`; `stretch` scales +Y to the length. */
function place(o: Object3D, from: V3, to: V3, stretch: boolean) {
  dir.set(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  const len = dir.length()
  o.position.set(from[0], from[1], from[2])
  o.quaternion.copy(tmpQuat.setFromUnitVectors(UP, dir.normalize()))
  o.scale.set(1, stretch ? len : 1, 1)
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

type BodyProps = Pick<JointSceneProps, 'exercise' | 'angle' | 'goalDeg' | 'rangeDeg' | 'idle' | 'frameAt'> & {
  asset: BodyAsset
  reduce: boolean
  muscles: boolean
  mirrored: boolean
  figure: FigureKey
  growth: Growth | null
  growthShade: boolean
  instrument: boolean
  spin: boolean
}

function Body({ asset, exercise, angle, goalDeg, rangeDeg, idle, reduce, muscles, mirrored, figure, growth, growthShade, instrument, spin, frameAt }: BodyProps) {
  const p = parts()
  const sway = useRef<Group>(null)
  const { objects, bind } = useBinder()
  const gauge = useMemo(gaugeGeometry, [])
  const band = useMemo(gaugeGeometry, [])
  const body = useMemo(() => makeBody(asset), [asset])
  const shown = useRef<{ exercise: ExerciseId; deg: number } | null>(null)
  const applied = useRef<{ exercise: ExerciseId; deg: number; figure: FigureKey; fill: number } | null>(null)
  const invalidate = useThree((s) => s.invalidate)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const frame = framingFor(exercise, figure, aspect, frameAt)
  const fill = growth?.overall ?? 0
  const rest = useMemo(() => skeletonFor(exercise, restFor(exercise), figure, fill), [exercise, figure, fill])
  // The stool is always in the scene, so its material is ready before the seated exercise first shows it.
  const seat = useMemo(() => skeletonFor('seated_knee_extension', 90, figure, fill).seat!, [figure, fill])
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  // Every material is compiled once when the scene starts, so switching movement never stalls a frame.
  useEffect(() => {
    gl.compile(scene, camera)
  }, [gl, scene, camera])
  // The tracker's rings stay small so the body, not the instrument, reads first.
  const ring = 0.05 / frame.scale
  const facing = facingFor(exercise)
  const growthKey = growth ? JSON.stringify(growth) : ''

  useEffect(
    () => () => {
      gauge.dispose()
      band.dispose()
      body.geometry.dispose()
      for (const g of Object.values(body.garments)) g.geometry.dispose()
      body.mesh.skeleton.dispose()
    },
    [gauge, band, body],
  )

  // The shape follows the figure and its growth, the clothes follow the shape, and the colours
  // follow what is shown on it.
  const positions = useMemo(() => {
    const attr = body.geometry.getAttribute('position') as BufferAttribute
    const normals = body.geometry.getAttribute('normal') as BufferAttribute
    bodyPositions(asset, figure, growth, attr.array as Float32Array)
    vertexNormals(attr.array as Float32Array, asset.index, normals.array as Float32Array)
    attr.needsUpdate = true
    normals.needsUpdate = true
    for (const name of GARMENTS) {
      const g = body.garments[name].geometry
      const gp = g.getAttribute('position') as BufferAttribute
      const gn = g.getAttribute('normal') as BufferAttribute
      garmentPositions(asset.garments[name], attr.array as Float32Array, normals.array as Float32Array, GARMENT_LIFT[name], gp.array as Float32Array)
      vertexNormals(gp.array as Float32Array, asset.garments[name].faces, gn.array as Float32Array)
      gp.needsUpdate = true
      gn.needsUpdate = true
    }
    return attr.array as Float32Array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, body, figure, growthKey])

  // What a figure wears: its garments shown, and the skin they cover left undrawn.
  useEffect(() => {
    const worn = garmentsOf(figure)
    body.geometry.setIndex(new BufferAttribute(visibleTriangles(asset, figure), 1))
    for (const name of GARMENTS) body.garments[name].mesh.visible = worn.includes(name)
    invalidate()
  }, [asset, body, figure, invalidate])

  useEffect(() => {
    const show: Show = growthShade && growth ? { growth } : muscles ? { exercise } : null
    const attr = body.geometry.getAttribute('color') as BufferAttribute
    paintBody(asset, positions, PALETTE, show, attr.array as Float32Array)
    attr.needsUpdate = true
    for (const name of GARMENTS) {
      const colors = body.garments[name].geometry.getAttribute('color') as BufferAttribute
      paintGarment(asset, name, positions, PALETTE, show, colors.array as Float32Array)
      colors.needsUpdate = true
    }
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, body, positions, figure, exercise, muscles, growthShade, growthKey, invalidate])

  // Reduced motion renders on demand: draw again whenever the reading, the range or the movement changes.
  useEffect(() => {
    applied.current = null
    invalidate()
  }, [invalidate, exercise, angle, goalDeg, rangeDeg, figure, positions])

  const apply = (s: Skeleton) => {
    const matrices = skinMatrices(figure, s)
    body.bones.forEach((bone, i) => {
      bone.matrix.fromArray(matrices[i]!)
      bone.matrixWorldNeedsUpdate = true
    })

    const o = objects.current
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
    const bandEnd = rangeDeg != null ? ov.restDeg + sweepFor(exercise, rangeDeg, figure) : ov.restDeg
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
      const g = ov.restDeg + sweepFor(exercise, goalDeg, figure)
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
    if (!last || last.exercise !== exercise || last.figure !== figure || last.fill !== fill || Math.abs(last.deg - deg) > 0.01) {
      apply(skeletonFor(exercise, deg, figure, fill))
      applied.current = { exercise, deg, figure, fill }
    }
    // A mirrored figure turns the mirror way, so it shows the same side of the body.
    if (sway.current) {
      const t = state.clock.elapsedTime
      const turn = spin ? facing + t * 0.35 : facing + (idle ? Math.sin(t * 0.45) * 0.34 : 0)
      sway.current.rotation.y = (mirrored ? -1 : 1) * turn
    }
  })

  return (
    <group ref={sway}>
      <group scale={[mirrored ? -1 : 1, 1, 1]}>
        <group position={frame.offset} scale={frame.scale}>
          <primitive object={body.mesh} />

          {/* The stool: always built, shown only for the seated exercise. */}
          <group visible={rest.seat != null}>
            <mesh position={[(seat.x[0] + seat.x[1]) / 2, seat.top - 0.06, 0]} scale={[seat.x[1] - seat.x[0], 0.12, seat.z[1] - seat.z[0]]} geometry={p.box} material={p.seat} />
            {(
              [
                [seat.x[0] + 0.12, seat.z[0] + 0.12],
                [seat.x[0] + 0.12, seat.z[1] - 0.12],
                [seat.x[1] - 0.12, seat.z[0] + 0.12],
                [seat.x[1] - 0.12, seat.z[1] - 0.12],
              ] as [number, number][]
            ).map(([x, z]) => (
              <mesh key={`${x}${z}`} position={[x, (seat.top - 0.12) / 2, z]} scale={[0.08, seat.top - 0.12, 0.08]} geometry={p.box} material={p.navy} />
            ))}
          </group>

          {/* The tracker's view on top of the body: landmark rings, the tracked segments, the arc. */}
          <group visible={instrument}>
            <group ref={bind('line-proximal')}>
              <Line points={[[0, 0, 0], [0, 1, 0]]} color={COBALT} lineWidth={1.75} transparent opacity={0.75} />
            </group>
            <group ref={bind('line-distal')}>
              <Line points={[[0, 0, 0], [0, 1, 0]]} color={COBALT} lineWidth={1.75} transparent opacity={0.75} />
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
    </group>
  )
}

/** The floor grid under the figure, wherever the framing puts the floor on this canvas. */
function Floor({ exercise, figure, frameAt }: { exercise: ExerciseId; figure: FigureKey; frameAt?: number }) {
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const floorY = framingFor(exercise, figure, aspect, frameAt).offset[1]
  return <Grid position={[0, floorY - 0.001, 0]} args={[12, 12]} cellSize={0.25} sectionSize={1} cellColor="#dfe4ef" sectionColor="#b7c2dc" fadeDistance={9} fadeStrength={1.6} infiniteGrid />
}

/**
 * A whole human body performing the exercise: MakeHuman's young adult (CC0, `body/`), female, male
 * or between the two, skinned onto Arc's skeleton and posed for each of the fifteen movements
 * (side on, face on, seated on a stool, lying for a crunch). The reading poses it (`skeletonFor`):
 * the working limb, or for squats, lunges, deadlifts and crunches the whole body; the tracker's
 * rings and segments and the goniometer arc sit on its joints, and `rangeDeg` shades the range
 * covered from rest to that reading. The muscles the exercise works are painted on it, red where it
 * targets and yellow where they help, or (`growthShade`) each group by how far it has grown. Its
 * shape is the member's: skinny untrained, each muscle group built up by the training that works
 * it (`growth`). Drive `angle` with `useRepLoop` to sweep the limb through the range rep after
 * rep. Never rendered in tests: use `LazyJointScene`, which loads the body with the code.
 */
export default function JointScene({ exercise, angle, goalDeg, rangeDeg, idle = true, muscles = true, mirrored = false, figure = 'neutral', growth = null, growthShade = false, instrument = true, spin = false, frameAt, className = '', label, fallback = null }: JointSceneProps) {
  const reduce = useReducedMotion() ?? false
  const fixed = typeof angle === 'number' ? angle : angle.get()
  // The body loads with the scene's code; if that download failed, show the fallback and try again.
  const [asset, setAsset] = useState(bodyAsset)
  useEffect(() => {
    if (asset) return
    let cancelled = false
    void loadBody().then((a) => !cancelled && a && setAsset(a))
    return () => {
      cancelled = true
    }
  }, [asset])
  return (
    <div className={`relative ${className}`.trim()} role="img" aria-label={label}>
      {!asset && fallback}
      {asset && (
        <Canvas dpr={[1, 1.5]} camera={{ position: [0.7, 0.35, 4.6], fov: 36 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} frameloop={reduce ? 'demand' : 'always'}>
          <hemisphereLight args={['#ffffff', '#9aa8c2', 1.0]} />
          <directionalLight position={[3, 4, 5]} intensity={2.2} />
          <directionalLight position={[-4, 1.5, -3]} intensity={1.4} color="#c9d6ff" />
          <Body asset={asset} exercise={exercise} angle={reduce ? fixed : angle} goalDeg={goalDeg} rangeDeg={rangeDeg} idle={!reduce && idle} reduce={reduce} muscles={muscles} mirrored={mirrored} figure={figure} growth={growth} growthShade={growthShade} instrument={instrument} spin={!reduce && spin} frameAt={frameAt} />
          <Floor exercise={exercise} figure={figure} frameAt={frameAt} />
          <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.7} />
        </Canvas>
      )}
    </div>
  )
}
