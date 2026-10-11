import { exercisesFor, MUSCLES, type BodyDto, type Figure, type MuscleId } from '@arc/dependencies'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useState } from 'react'
import { ease } from '../components/motion'
import { LazyJointScene, SceneBoundary } from '../components/three/lazy'
import { Lamp, Segmented, Strip, type SegmentedOption } from '../components/ui'
import { FigurePicker } from './FigurePicker'
import { figureKey, growthAt, overallOf, percent, rankedMuscles } from './growth'

type Shade = 'shape' | 'growth'
const SHADES: SegmentedOption<Shade>[] = [
  { value: 'shape', label: 'Body' },
  { value: 'growth', label: 'Growth map', short: 'Map' },
]
/** How long each week shows while the body plays forward. */
const WEEK_MS = 650
const FIGURE_WORDS: Record<string, string> = { female: 'female', male: 'male', neutral: 'neutral' }

const weekDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

interface BodyGrowthProps {
  name: string
  body: BodyDto | null
  figure: Figure | null
  onFigure: (figure: Figure | null) => void
  saving?: boolean
}

/** The dashboard's strip: the member's body as their training has built it (BodyGrowthView). */
export function BodyGrowth({ className = '', ...props }: BodyGrowthProps & { className?: string }) {
  const { body } = props
  return (
    <Strip index="02" title="Your body, as trained" aside={body ? (body.weeks.length ? `${percent(body.overall)}% built · ${signed(Math.round(recentChange(body) * 100))} in 4 weeks` : 'Untrained: the start') : undefined} className={className}>
      <BodyGrowthView {...props} />
    </Strip>
  )
}

/**
 * A body as its training has built it: the whole figure turning slowly, skinny at the start and
 * each muscle group grown by the sets that worked it (growth.ts), a week slider to watch it grow
 * from the first session to today, the groups from most to least built, the ones not worked yet
 * with a movement for each, and the choice of figure.
 */
export function BodyGrowthView({ name, body, figure, onFigure, saving = false }: BodyGrowthProps) {
  const reduce = useReducedMotion()
  const weeks = body?.weeks.length ?? 0
  const [week, setWeek] = useState(Math.max(0, weeks - 1))
  const [playing, setPlaying] = useState(false)
  const [shade, setShade] = useState<Shade>('shape')
  const [all, setAll] = useState(false)
  const sliderId = useId()

  // A new body (another profile, a new session) shows today.
  useEffect(() => {
    setWeek(Math.max(0, weeks - 1))
    setPlaying(false)
  }, [body, weeks])

  // Playing steps a week at a time to today, then stops.
  useEffect(() => {
    if (!playing) return
    if (week >= weeks - 1) {
      setPlaying(false)
      return
    }
    const id = window.setTimeout(() => setWeek((w) => w + 1), WEEK_MS)
    return () => window.clearTimeout(id)
  }, [playing, week, weeks])

  const play = () => {
    if (reduce) {
      setWeek(weeks - 1)
      return
    }
    setWeek(0)
    setPlaying(true)
  }

  const growth = body ? growthAt(body, week) : null
  const levels = growth?.levels as Record<MuscleId, number> | undefined
  const ranked = levels ? rankedMuscles(levels) : []
  const untrained = body ? ranked.filter((m) => body.muscles[m].totalSets === 0) : []
  const trained = ranked.filter((m) => !untrained.includes(m))
  const shown = all ? trained : trained.slice(0, 6)
  const key = figureKey(figure)
  const today = week >= weeks - 1
  const overall = growth?.overall ?? 0
  const label = body
    ? `${name}'s figure, ${FIGURE_WORDS[key]}, turning slowly: ${percent(overall)}% built${trained.length ? `, most in ${trained
        .slice(0, 3)
        .map((m) => MUSCLES[m].name.toLowerCase())
        .join(', ')}` : ', untrained'}${today ? '' : `, as at week ${week + 1}`}`
    : `${name}'s figure, loading`

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="stage relative h-[320px] sm:h-[380px]">
          <SceneBoundary fallback={<div className="hatch absolute inset-8" aria-hidden="true" />}>
            <LazyJointScene
              exercise="shoulder_abduction"
              angle={0}
              frameAt={0}
              idle={false}
              spin
              instrument={false}
              muscles={false}
              growthShade={shade === 'growth'}
              figure={key}
              growth={growth}
              className="h-full w-full"
              label={label}
              fallback={<div className="hatch absolute inset-8" aria-hidden="true" />}
            />
          </SceneBoundary>
          {weeks > 1 && (
            <span className="callout pointer-events-none top-3 left-3" aria-hidden="true">
              {today ? 'Today' : `Week ${week + 1} of ${weeks}`}
            </span>
          )}
          <span className="callout pointer-events-none top-3 right-3" aria-hidden="true">
            {percent(overall)}% built
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="w-full sm:w-auto">
            <Segmented label="Show" options={SHADES} value={shade} onChange={setShade} />
          </div>
          <FigurePicker value={figure} onChange={onFigure} disabled={saving} />
        </div>

        {weeks > 1 && body && (
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <label htmlFor={sliderId} className="t-meta normal-case">
              {today ? 'Today' : `Week ${week + 1} of ${weeks}`} · from {weekDate(body.weeks[week]!.from)}
            </label>
            <button type="button" className="btn btn-ghost row-span-2 self-end" onClick={() => (playing ? setPlaying(false) : play())}>
              {playing ? 'Pause' : 'Watch it grow'}
            </button>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={weeks - 1}
              step={1}
              value={week}
              onChange={(e) => {
                setPlaying(false)
                setWeek(Number(e.target.value))
              }}
              className="w-full accent-[var(--cobalt)]"
              aria-valuetext={today ? 'today' : `week ${week + 1} of ${weeks}`}
            />
          </div>
        )}
      </div>

      <div className="min-w-0">
        {!body && <p className="t-desc">Loading {name}'s body…</p>}
        {body && trained.length === 0 && (
          <p className="t-desc">
            Every muscle group is at the start: the figure is {name}'s body before training. Record a session and the muscles it works start to grow, a little each week; work a group often
            and it fills out, leave it for weeks and it slowly gives some back.
          </p>
        )}
        {body && trained.length > 0 && (
          <>
            <div className="t-label">Most built {today ? '' : `· week ${week + 1}`}</div>
            <ol className="mt-3 border-t border-rule-strong" aria-label="Muscle groups, most built first">
              {shown.map((m, i) => {
                const g = body.muscles[m]
                const level = levels![m]
                return (
                  <li key={m} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3rem] items-center gap-3 border-b border-rule py-2.5" aria-label={`${MUSCLES[m].name}: ${percent(level)}% built, ${round1(g.recentSets)} sets in the last 4 weeks`}>
                    <span className="truncate text-[14px] font-medium text-ink">{MUSCLES[m].name}</span>
                    <span className="relative h-2 bg-vellum" aria-hidden="true">
                      <motion.span className="absolute inset-y-0 left-0 bg-cobalt" initial={false} animate={{ width: `${percent(level)}%` }} transition={reduce ? { duration: 0 } : { duration: 0.45, ease, delay: 0.02 * i }} />
                    </span>
                    <span className="text-right font-mono text-[13px] tabular-nums text-ink">{percent(level)}%</span>
                    {today && (
                      <span className="t-meta col-span-3 -mt-1 normal-case">
                        {round1(g.recentSets)} sets in 4 weeks{g.change > 0.005 ? ` · up ${percent(g.change)}` : g.change < -0.005 ? ` · down ${percent(-g.change)}, not worked lately` : ''}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
            {trained.length > 6 && (
              <button type="button" className="t-label mt-3 text-cobalt" onClick={() => setAll((a) => !a)} aria-expanded={all}>
                {all ? 'Show the top six' : `Show all ${trained.length}`}
              </button>
            )}
          </>
        )}
        {body && untrained.length > 0 && (
          <div className="mt-5 border-l-2 border-rule-strong pl-3">
            <div className="t-label flex items-center gap-2">
              <Lamp tone="warn" /> Not worked yet
            </div>
            <ul className="mt-2 grid gap-1 text-[14px] text-ink-2">
              {untrained.slice(0, 5).map((m) => {
                const move = exercisesFor(m).primary[0] ?? exercisesFor(m).secondary[0]
                return (
                  <li key={m}>
                    <span className="text-ink">{MUSCLES[m].name}</span>
                    {move ? ` · try ${move.name.toLowerCase()}` : ''}
                  </li>
                )
              })}
              {untrained.length > 5 && <li className="t-meta normal-case">and {untrained.length - 5} more</li>}
            </ul>
          </div>
        )}
        <p className="t-meta mt-5 normal-case">A model for drawing the figure from the sets each group did, not a measurement of {name}'s body.</p>
      </div>
    </div>
  )
}

const round1 = (x: number) => Math.round(x * 10) / 10
const signed = (x: number) => (x > 0 ? `up ${x}` : x < 0 ? `down ${-x}` : 'level')
/** The whole body's change over four weeks: today against the window four steps back, or since the start. */
function recentChange(body: BodyDto): number {
  const back = body.weeks[body.weeks.length - 5]
  return body.overall - (back ? overallOf(back.levels) : 0)
}
