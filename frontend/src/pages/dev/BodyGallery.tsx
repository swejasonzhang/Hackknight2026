import { EXERCISE_LIST, EXERCISES } from '@arc/dependencies'
import { useSearchParams } from 'react-router-dom'
import { LazyJointScene } from '../../components/three/lazy'

/**
 * /dev/bodies, in development only: every movement's figure at once, to check the body and its
 * muscle colours. ?set=0 or 1 picks a half (a browser runs out of 3D canvases near sixteen),
 * ?at=0..1 how far through the range, ?mirror draws the left-sided figure, ?plain hides the muscles,
 * ?only=a,b shows just those movements, larger.
 */
export function BodyGallery() {
  const [params] = useSearchParams()
  const set = Number(params.get('set') ?? 0)
  const at = Number(params.get('at') ?? 0.65)
  const only = params.get('only')?.split(',')
  const list = only ? EXERCISE_LIST.filter((e) => only.includes(e.id)) : EXERCISE_LIST.slice(set * 8, set * 8 + 8)
  return (
    <main className={`grid gap-2 bg-paper p-2 ${only ? 'grid-cols-2' : 'grid-cols-4'}`}>
      {list.map((e) => {
        const { restDeg, maxDeg } = EXERCISES[e.id]
        const deg = restDeg + (maxDeg - restDeg) * at
        return (
          <figure key={e.id} className="border border-rule">
            <LazyJointScene exercise={e.id} angle={deg} goalDeg={e.targetDeg} idle={false} muscles={!params.has('plain')} mirrored={params.has('mirror')} className={only ? 'h-[640px]' : 'h-[300px]'} label={e.name} />
            <figcaption className="t-mono p-1 text-[11px]">{e.name} · {Math.round(deg)}°</figcaption>
          </figure>
        )
      })}
    </main>
  )
}
