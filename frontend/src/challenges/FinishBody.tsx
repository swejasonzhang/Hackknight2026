import { MUSCLES, projectChallenge, type BodyDto, type Challenge } from '@arc/dependencies'
import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { growthNow, percent } from '../body/growth'
import { ease } from '../components/motion'
import { LazyJointScene, SceneBoundary } from '../components/three/lazy'
import type { FigureKey } from '../components/three/skeleton'
import { Segmented, Skeleton, type SegmentedOption } from '../components/ui'

type View = 'now' | 'finish'
const VIEWS: SegmentedOption<View>[] = [
  { value: 'now', label: 'Now' },
  { value: 'finish', label: 'At the finish' },
]
const FIGURE_WORDS: Record<FigureKey, string> = { female: 'female', male: 'male', neutral: 'neutral' }

/** "chest, biceps and abs". */
const listOf = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

interface Props {
  challenge: Challenge
  /** Whose body it is, or null for no profile: the untrained start. */
  name: string | null
  figure: FigureKey
  /** The profile's body today, or null for the untrained start. */
  body: BodyDto | null
  /** The body is on its way. */
  loading?: boolean
  /** The body could not load, so the projection starts untrained. */
  failed?: boolean
  /** For the challenge under way, the week it is in: the projection runs from there to the finish. */
  fromWeek?: number
}

/**
 * The member's body now and at a challenge's finish, on one turning figure (the standing pose of
 * the dashboard's body section): today as their training has grown it, then every group grown on
 * week by week through the challenge's phases the way the growth model grows it
 * (projectChallenge), with what each focus group gains in points of "built".
 */
export function FinishBody({ challenge, name, figure, body, loading = false, failed = false, fromWeek = 1 }: Props) {
  const reduce = useReducedMotion()
  const [view, setView] = useState<View>('finish')
  const now = useMemo(() => (body ? growthNow(body) : null), [body])
  const finish = useMemo(() => projectChallenge(challenge, now?.levels, fromWeek), [challenge, now, fromWeek])
  const overall = view === 'now' ? (now?.overall ?? 0) : finish.overall
  const gains = challenge.focus.map((m) => {
    const before = percent(now?.levels[m] ?? 0)
    const after = percent(finish.levels[m])
    return { muscle: m, before, after, gain: after - before }
  })
  const most = [...gains]
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3)
    .map((g) => MUSCLES[g.muscle].name.toLowerCase())
  const who = name ? `${name}'s figure` : 'The figure'
  const label = loading
    ? `${who}, loading`
    : view === 'now'
      ? `${who}, ${FIGURE_WORDS[figure]}, turning slowly: now, ${percent(overall)}% built`
      : `${who}, ${FIGURE_WORDS[figure]}, turning slowly: at the finish of ${challenge.name}, ${percent(overall)}% built, most gained in ${listOf(most)}`

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="t-label text-navy">Your body at the finish</h3>
        <div className="w-full sm:w-auto">
          <Segmented label="Show the body" options={VIEWS} value={view} onChange={setView} />
        </div>
      </div>

      <div className="stage relative mt-3 h-[300px] overflow-hidden sm:h-[340px]">
        <SceneBoundary fallback={<div className="hatch absolute inset-8" aria-hidden="true" />}>
          <LazyJointScene
            exercise="shoulder_abduction"
            angle={0}
            frameAt={0}
            idle={false}
            spin
            instrument={false}
            muscles={false}
            figure={figure}
            growth={loading ? null : view === 'now' ? now : finish}
            className="h-full w-full"
            label={label}
            fallback={<div className="hatch absolute inset-8" aria-hidden="true" />}
          />
        </SceneBoundary>
        <span className="callout pointer-events-none top-3 left-3" aria-hidden="true">
          {view === 'now' ? 'Today' : `Week ${challenge.weeks}`}
        </span>
        <span className="callout pointer-events-none top-3 right-3" aria-hidden="true">
          {loading ? '–' : `${percent(overall)}% built`}
        </span>
      </div>

      <div className="t-meta mt-4 flex flex-wrap items-center gap-x-4 gap-y-1" aria-hidden="true">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-3 bg-navy" /> Now
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2 w-3 bg-cobalt" /> Gained by the finish
        </span>
      </div>
      {loading ? (
        <Skeleton height={gains.length * 37} className="mt-2" />
      ) : (
        <ol className="mt-2 border-t border-rule-strong" aria-label={`What ${challenge.name} builds most`}>
          {gains.map((g, i) => (
            <li
              key={g.muscle}
              className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3rem] items-center gap-3 border-b border-rule py-2"
              aria-label={`${MUSCLES[g.muscle].name}: up ${g.gain} points, from ${g.before}% to ${g.after}% built`}
            >
              <span className="truncate text-[14px] font-medium text-ink">{MUSCLES[g.muscle].name}</span>
              <span className="relative h-2 bg-vellum" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 bg-navy" style={{ width: `${g.before}%` }} />
                <motion.span
                  className="absolute inset-y-0 bg-cobalt"
                  style={{ left: `${g.before}%` }}
                  initial={false}
                  animate={{ width: `${g.gain}%` }}
                  transition={reduce ? { duration: 0 } : { duration: 0.45, ease, delay: 0.03 * i }}
                />
              </span>
              <span className="text-right font-mono text-[13px] tabular-nums text-cobalt">+{g.gain}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="t-meta mt-3 normal-case">
        {failed ? 'Your body could not load, so this starts from untrained. ' : ''}
        If every planned day is trained. Weights are left out, so it errs low for heavy lifting: a model for drawing the figure, not a promise.
      </p>
    </div>
  )
}
