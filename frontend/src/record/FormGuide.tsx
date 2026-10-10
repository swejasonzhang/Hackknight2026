import { EXERCISES, sideLabel, type ExerciseId, type Side } from '@arc/dependencies'
import { MuscleKey } from '../components/MuscleKey'
import { LazyJointScene, SceneBoundary } from '../components/three/lazy'
import { useRepLoop } from '../components/three/useRepLoop'

/**
 * Beside the camera: the movement done right. A figure loops full reps from the start position to
 * the goal, painted with the muscles it works, and drawn as the member sees themselves in the
 * mirrored camera view (working on the side they picked); under it, the key and the cue.
 */
export function FormGuide({ exercise, side, targetDeg }: { exercise: ExerciseId; side: Side; targetDeg: number }) {
  const cfg = EXERCISES[exercise]
  const angle = useRepLoop(exercise, targetDeg)
  const still = (
    <div className="grid h-full place-items-center text-center">
      <p className="t-meta normal-case">The 3D guide needs WebGL; the steps below say the same.</p>
    </div>
  )
  return (
    <section className="panel p-4 sm:p-5" aria-label="How to do it">
      <div className="t-label">How to do it · {sideLabel(exercise, side)}</div>
      <div className="relative mt-2 h-[240px] bg-vellum">
        <SceneBoundary fallback={still}>
          <LazyJointScene
            exercise={exercise}
            angle={angle ?? targetDeg}
            goalDeg={targetDeg}
            mirrored={side === 'right'}
            className="h-full w-full"
            label={`A figure doing ${cfg.name.toLowerCase()} reps the right way, from the start position to the ${targetDeg} degree goal, with the muscles it works coloured`}
            fallback={still}
          />
        </SceneBoundary>
      </div>
      <MuscleKey exercise={exercise} className="mt-3" />
      <p className="mt-3 text-[14px] leading-[1.5] text-ink-2">{cfg.cue}</p>
    </section>
  )
}
