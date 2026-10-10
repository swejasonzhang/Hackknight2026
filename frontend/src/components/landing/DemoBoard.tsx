import { buildProgress, EXERCISE_LIST, EXERCISES, generateDemoSessions, type ExerciseId } from '@arc/dependencies'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { fatigueLabel, formatDate } from '../../format'
import { AnimatedNumber, ease } from '../motion'
import { FatigueChart, PeakChart, RepChart, WeeklyChart } from '../ProgressCharts'
import { LazyProgressScene } from '../three/lazy'
import { Lamp, Segmented, Tag, type SegmentedOption } from '../ui'

type View = 'trend' | 'reps' | 'fatigue' | 'weekly' | '3d'

const EXERCISE_OPTIONS = EXERCISE_LIST.map((e) => ({ value: e.id, label: e.id === 'elbow_flexion' ? 'Elbow' : e.id === 'shoulder_abduction' ? 'Shoulder' : 'Knee' }))
const VIEWS: SegmentedOption<View>[] = [
  { value: 'trend', label: 'Trend' },
  { value: 'reps', label: 'Rep by rep', short: 'Reps' },
  { value: 'fatigue', label: 'Fatigue' },
  { value: 'weekly', label: 'Weekly' },
  { value: '3d', label: '3D' },
]
const CAPTION: Record<View, string> = {
  trend: 'Best and mean rep of every session against the goal rule.',
  reps: 'Every rep of the latest session, set by set.',
  fatigue: 'How much range and tempo faded within sets; the dashed rules are the nudge and the early rest.',
  weekly: 'Sessions per week: consistency moves every other number.',
  '3d': 'The same sessions as 3D bars, lighter is higher. Drag to orbit.',
}
const FIRST_SEED = 2026

/**
 * The landing's graph demos: real charts from the dashboard fed by Arc's own demo generator.
 * Pick a movement, flip between five views, or draw a new random six weeks; the charts animate
 * between datasets and the readings count to their new values.
 */
export function DemoBoard() {
  const reduce = useReducedMotion()
  const [exercise, setExercise] = useState<ExerciseId>('elbow_flexion')
  const [view, setView] = useState<View>('trend')
  const [seed, setSeed] = useState(FIRST_SEED)
  const [now] = useState(() => Date.now())
  const cfg = EXERCISES[exercise]

  const progress = useMemo(() => {
    const sessions = generateDemoSessions('demo', now, seed, new Date(now).getTimezoneOffset())
      .filter((s) => s.exercise === exercise)
      .map((s, i) => ({ ...s, id: `demo-${i}` }))
    return buildProgress('demo', exercise, sessions, cfg.targetDeg)
  }, [exercise, seed, now, cfg.targetDeg])

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
  const shuffle = () => setSeed(Math.floor(Math.random() * 2 ** 31))

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="w-full max-w-[420px]">
          <Segmented label="Movement shown" options={EXERCISE_OPTIONS} value={exercise} onChange={setExercise} />
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
          { k: 'Sessions', v: <AnimatedNumber value={points.length} />, hint: 'six weeks, two or three a week', tone: 'default' as const },
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
          <div className="w-full sm:w-auto">
            <Segmented label="Chart" options={VIEWS} value={view} onChange={setView} />
          </div>
          <span className="t-meta flex items-center gap-2">
            {cfg.name} <Tag soft>Demo · seed {seed.toString(16).toUpperCase().padStart(4, '0')}</Tag>
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
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="t-mono mt-4 max-w-[70ch]">
          {CAPTION[view]} Random demo data from the same generator that fills a demo profile in the app; every press draws a new six weeks.
        </p>
      </div>
    </div>
  )
}
