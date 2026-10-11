import { EXERCISE_LIST, EXERCISES, MUSCLE_IDS, type ExerciseId } from '@arc/dependencies'
import { useSearchParams } from 'react-router-dom'
import { LazyJointScene } from '../../components/three/lazy'
import type { FigureKey } from '../../components/three/skeleton'
import { useRepLoop } from '../../components/three/useRepLoop'

/** ?camera=<movement>: one figure doing reps to the goal and back, filling the screen and bare (no instrument, no colours), to film as a pretend webcam for the real pose model. */
function CameraSubject({ exercise, figure }: { exercise: ExerciseId; figure: FigureKey }) {
  const angle = useRepLoop(exercise, EXERCISES[exercise].targetDeg) ?? 0
  return (
    <main className="h-screen w-screen bg-white">
      <LazyJointScene exercise={exercise} angle={angle} idle={false} muscles={false} instrument={false} figure={figure} className="h-full w-full" label="Camera subject" />
    </main>
  )
}

/**
 * /dev/bodies, in development only: every movement's figure at once, to check the body and its
 * muscle colours. ?set=0 or 1 picks a half (a browser runs out of 3D canvases near sixteen),
 * ?at=0..1 how far through the range (?goal: at each movement's goal), ?mirror draws the left-sided figure, ?plain hides the muscles,
 * ?only=a,b shows just those movements, larger, ?figure=female|male|neutral picks the body and
 * ?grown=0..1 grows every muscle group that far.
 */
export function BodyGallery() {
  const [params] = useSearchParams()
  const set = Number(params.get('set') ?? 0)
  const at = Number(params.get('at') ?? 0.65)
  const only = params.get('only')?.split(',')
  const figure = (params.get('figure') ?? 'neutral') as FigureKey
  const grown = Number(params.get('grown') ?? 0)
  const growth = { levels: Object.fromEntries(MUSCLE_IDS.map((m) => [m, grown])), overall: grown }
  const list = only ? EXERCISE_LIST.filter((e) => only.includes(e.id)) : EXERCISE_LIST.slice(set * 8, set * 8 + 8)
  const camera = params.get('camera') as ExerciseId | null
  if (camera && camera in EXERCISES) return <CameraSubject exercise={camera} figure={figure} />
  return (
    <main className={`grid gap-2 bg-paper p-2 ${only ? 'grid-cols-2' : 'grid-cols-4'}`}>
      {list.map((e) => {
        const { restDeg, maxDeg } = EXERCISES[e.id]
        const deg = params.has('goal') ? e.targetDeg : restDeg + (maxDeg - restDeg) * at
        return (
          <figure key={e.id} className="border border-rule">
            <LazyJointScene exercise={e.id} angle={deg} goalDeg={e.targetDeg} idle={false} muscles={!params.has('plain')} mirrored={params.has('mirror')} figure={figure} growth={growth} growthShade={params.has('shade')} className={only ? 'h-[640px]' : 'h-[300px]'} label={e.name} />
            <figcaption className="t-mono p-1 text-[11px]">{e.name} · {Math.round(deg)}°</figcaption>
          </figure>
        )
      })}
    </main>
  )
}
