import { EXERCISES, MUSCLES, type ExerciseId } from '@arc/dependencies'
import { HELPER_YELLOW, TARGET_RED } from './three/colors'

/**
 * The key to the figure's colours, in words: the muscles an exercise targets (red) and the ones
 * that help or hold the body steady (yellow). Also the text equivalent of the painted figure.
 */
export function MuscleKey({ exercise, className = '' }: { exercise: ExerciseId; className?: string }) {
  const { primary, secondary } = EXERCISES[exercise].muscles
  const names = (list: readonly (keyof typeof MUSCLES)[]) => list.map((m) => MUSCLES[m].name).join(', ')
  return (
    <dl className={`grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1 text-[13px] leading-[1.45] ${className}`.trim()}>
      <dt className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] uppercase text-muted">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TARGET_RED }} aria-hidden="true" /> Target
      </dt>
      <dd className="text-ink">{names(primary)}</dd>
      {secondary.length > 0 && (
        <>
          <dt className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] uppercase text-muted">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: HELPER_YELLOW }} aria-hidden="true" /> Also working
          </dt>
          <dd className="text-ink-2">{names(secondary)}</dd>
        </>
      )}
    </dl>
  )
}
