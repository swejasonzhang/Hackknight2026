import { buildProgress, EXERCISE_IDS, EXERCISES, generateDemoSessions, leaderboard, type ExerciseId, type LeaderboardMetric } from '@arc/dependencies'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { fatigueLabel, formatDate } from '../../format'
import { BoardRows, MetricChips } from '../../profiles/Leaderboard'
import { ExercisePicker } from '../ExercisePicker'
import { AnimatedNumber, ease } from '../motion'
import { MuscleKey } from '../MuscleKey'
import { FatigueChart, PeakChart, RepChart, WeeklyChart } from '../ProgressCharts'
import { LazyJointScene, LazyProgressScene } from '../three/lazy'
import { useRepLoop } from '../three/useRepLoop'
import { Lamp, Segmented, Tag, type SegmentedOption } from '../ui'

type View = 'trend' | 'reps' | 'fatigue' | 'weekly' | '3d' | 'muscles' | 'board'

const VIEWS: SegmentedOption<View>[] = [
  { value: 'trend', label: 'Trend' },
  { value: 'reps', label: 'Rep by rep', short: 'Reps' },
  { value: 'fatigue', label: 'Fatigue', short: 'Fade' },
  { value: 'weekly', label: 'Weekly', short: 'Week' },
  { value: '3d', label: '3D' },
  { value: 'muscles', label: 'Muscles', short: 'Body' },
  { value: 'board', label: 'Household', short: 'Board' },
]
const CAPTION: Record<View, string> = {
  trend: 'Best and mean rep of every session against the goal rule.',
  reps: 'Every rep of the latest session, set by set.',
  fatigue: 'How much range and tempo faded within sets; the dashed rules are the nudge and the early rest.',
  weekly: 'Sessions per week: consistency moves every other number.',
  '3d': 'The same sessions as 3D bars, lighter is higher. Drag to orbit.',
  muscles: 'The movement done right, to the goal and back, with the muscles it works: red where it targets, yellow where they help. Drag to orbit.',
  board: 'A household of three on the leaderboard this week: reps, sets, weight moved and steadiness, and the Arc score that factors them all in.',
}
const FIRST_SEED = 2026

/** The demo household: each trains a different part of the catalog, so the board tells a story. */
const HOUSEHOLD: { id: string; name: string; keep: (e: ExerciseId) => boolean }[] = [
  { id: 'maya', name: 'Maya', keep: (e) => EXERCISES[e].area === 'upper' || EXERCISES[e].area === 'core' },
  { id: 'theo', name: 'Theo', keep: (e) => EXERCISES[e].area === 'legs' || EXERCISES[e].area === 'back' },
  { id: 'rose', name: 'Nana Rose', keep: (e) => ['elbow_flexion', 'shoulder_abduction', 'seated_knee_extension', 'squat'].includes(e) },
]

/** The Muscles view: reps from rest to the goal, painted with what they work, beside the key and the cue. */
function MuscleFigure({ exercise }: { exercise: ExerciseId }) {
  const cfg = EXERCISES[exercise]
  const angle = useRepLoop(exercise, cfg.targetDeg)
  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:items-center">
      <div className="stage h-[300px]">
        <LazyJointScene exercise={exercise} angle={angle ?? cfg.targetDeg} goalDeg={cfg.targetDeg} className="h-full" label={`A figure doing ${cfg.name.toLowerCase()} reps to the ${cfg.targetDeg} degree goal, the muscles it works coloured`} fallback={<div className="hatch h-full" />} />
      </div>
      <div>
        <div className="t-label text-navy">{cfg.name}</div>
        <MuscleKey exercise={exercise} className="mt-3" />
        <p className="t-desc mt-3">{cfg.cue}</p>
      </div>
    </div>
  )
}

/**
 * The landing's readouts: real charts from the dashboard fed by Arc's own demo generator. Pick any
 * of the fifteen movements by body area, flip between seven views (the trend, every rep, fatigue,
 * weeks, 3D bars, the body with the muscles it works, and a demo household's leaderboard), or
 * draw a new random six weeks; the charts animate between datasets and the readings count to
 * their new values.
 */
export function DemoBoard() {
  const reduce = useReducedMotion()
  const [exercise, setExercise] = useState<ExerciseId>('elbow_flexion')
  const [view, setView] = useState<View>('trend')
  const [metric, setMetric] = useState<LeaderboardMetric>('score')
  const [seed, setSeed] = useState(FIRST_SEED)
  const [now] = useState(() => Date.now())
  const cfg = EXERCISES[exercise]
  const tz = new Date(now).getTimezoneOffset()

  const sessions = useMemo(
    () =>
      generateDemoSessions('demo', now, seed, tz)
        .filter((s) => s.exercise === exercise)
        .map((s, i) => ({ ...s, id: `demo-${i}` })),
    [exercise, seed, now, tz],
  )
  const progress = useMemo(() => buildProgress('demo', exercise, sessions, cfg.targetDeg), [exercise, sessions, cfg.targetDeg])
  const board = useMemo(() => {
    const all = HOUSEHOLD.flatMap((p, i) => generateDemoSessions(p.id, now, seed + i + 1, tz).filter((s) => p.keep(s.exercise)))
    return leaderboard(HOUSEHOLD, all, { window: 'week', now })
  }, [seed, now, tz])

  const points = progress.sessions
  const first = points[0]
  const latest = points.at(-1)
  // Every reading is rounded once, then the hints are worked from the rounded numbers, so the
  // arithmetic a reader does in their head (98° + 24° = 122°) always matches what is printed.
  const best = points.length ? Math.round(Math.max(...points.map((p) => p.bestPeakDeg))) : 0
  const firstDeg = first ? Math.round(first.bestPeakDeg) : 0
  const latestDeg = latest ? Math.round(latest.bestPeakDeg) : 0
  const gain = latestDeg - firstDeg
  const toGo = Math.max(0, cfg.targetDeg - best)
  const fatigue = latest ? fatigueLabel(latest.fatigueIndex) : null
  const byTime = [...sessions].sort((a, b) => a.startedAt - b.startedAt)
  const firstKg = byTime[0]?.loadKg ?? 0
  const latestKg = byTime.at(-1)?.loadKg ?? 0
  const shuffle = () => setSeed(Math.floor(Math.random() * 2 ** 31))

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-[640px]">
          <ExercisePicker value={exercise} onChange={setExercise} />
        </div>
        <button type="button" className="btn btn-block" onClick={shuffle}>
          <motion.span key={seed} aria-hidden="true" className="inline-block font-mono text-[15px] leading-none" initial={reduce ? false : { rotate: -180 }} animate={{ rotate: 0 }} transition={{ duration: 0.5, ease }}>
            ↻
          </motion.span>
          New random six weeks
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 border-t border-rule-strong sm:grid-cols-4 sm:gap-x-8">
        {[
          { k: 'Best rep', v: <AnimatedNumber value={best} suffix="°" />, hint: toGo > 0 ? `${toGo}° to the ${cfg.targetDeg}° goal` : `goal ${cfg.targetDeg}° reached`, tone: toGo > 0 ? ('primary' as const) : ('good' as const) },
          { k: 'Since week 1', v: <AnimatedNumber value={gain} suffix="°" />, hint: first ? `${firstDeg}° on ${formatDate(first.date)}, ${latestDeg}° now` : '', tone: 'primary' as const },
          {
            k: 'Weight held',
            v: latestKg ? <AnimatedNumber value={latestKg} decimals={latestKg % 1 ? 1 : 0} suffix=" kg" /> : 'Body',
            hint: latestKg ? `${firstKg} kg in week 1, ${points.length} sessions` : `bodyweight, ${points.length} sessions`,
            tone: 'default' as const,
          },
          { k: 'Fatigue, latest', v: <AnimatedNumber value={latest?.fatigueIndex ?? 0} decimals={2} />, hint: fatigue?.text ?? '', tone: fatigue?.tone ?? ('default' as const) },
        ].map((s) => (
          <div key={s.k} className="border-b border-rule py-4">
            <dt className="t-label flex items-center gap-2">
              <Lamp tone={s.tone} /> {s.k}
            </dt>
            <dd className="m-0 mt-2 font-display text-[26px] leading-none font-semibold tracking-[-0.02em] text-navy sm:text-[30px]">{s.v}</dd>
            <dd className="t-desc m-0 mt-2">{s.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="panel p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="w-full lg:w-auto">
            <Segmented label="Chart" options={VIEWS} value={view} onChange={setView} />
          </div>
          <span className="t-meta flex items-center gap-2">
            {view === 'board' ? 'This week' : cfg.name} <Tag soft>Demo · seed {seed.toString(16).toUpperCase().padStart(4, '0')}</Tag>
          </span>
        </div>

        <div className="relative mt-5 min-h-[330px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -10 }} transition={{ duration: 0.3, ease }}>
              {view === 'trend' && <PeakChart progress={progress} height={300} />}
              {view === 'reps' && <RepChart progress={progress} height={300} />}
              {view === 'fatigue' && <FatigueChart progress={progress} height={300} />}
              {view === 'weekly' && <WeeklyChart progress={progress} height={300} />}
              {view === '3d' && (
                <div className="stage h-[300px]">
                  <LazyProgressScene
                    points={points.map((p) => ({ label: formatDate(p.date), value: p.bestPeakDeg, sub: `${p.totalReps} reps` }))}
                    goal={cfg.targetDeg}
                    className="h-full"
                    label={`Demo best ${cfg.name.toLowerCase()} per session as 3D bars against a ${cfg.targetDeg} degree goal`}
                    fallback={<div className="hatch h-full" />}
                  />
                </div>
              )}
              {view === 'muscles' && <MuscleFigure exercise={exercise} />}
              {view === 'board' && (
                <div>
                  <MetricChips value={metric} onChange={setMetric} />
                  <BoardRows board={board} metric={metric} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="t-mono mt-4 max-w-[70ch]">
          {CAPTION[view]} Random demo data from the same generator that fills a demo profile in the app, across all {EXERCISE_IDS.length} movements; every press draws a new six weeks.
        </p>
      </div>
    </div>
  )
}
