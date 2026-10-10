import { EXERCISES, EXERCISE_LIST, type ExerciseId } from '@arc/dependencies'
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { LazyJointScene, SceneBoundary } from '../three/lazy'
import { Segmented } from '../ui'
import { LiveArc } from './LiveArc'
import { createRepCycle } from './repCycle'

/** Six demo reps per loop; the last ones shrink so the nudge has something to say. */
const PEAKS: Record<ExerciseId, number[]> = {
  elbow_flexion: [131, 128, 134, 125, 129, 122],
  shoulder_abduction: [151, 148, 154, 145, 149, 142],
  seated_knee_extension: [169, 166, 172, 163, 167, 160],
}
const REST: Record<ExerciseId, number> = { elbow_flexion: 18, shoulder_abduction: 15, seated_knee_extension: 95 }
const SECONDS_PER_REP = 2.4
const OPTIONS = EXERCISE_LIST.map((e) => ({ value: e.id, label: e.name }))

/**
 * The landing's living demo: a 3D limb performing reps for the chosen exercise, the angle read out
 * live, and a set card that counts reps and flags fading range. Falls back to the 2D arc when
 * WebGL is unavailable. Under reduced motion the limb holds a pose near the goal.
 */
export function LiveJoint({ compact = false, exercises = true }: { compact?: boolean; exercises?: boolean }) {
  const reduce = useReducedMotion()
  const [exercise, setExercise] = useState<ExerciseId>('elbow_flexion')
  const [failed, setFailed] = useState(false)
  const cfg = EXERCISES[exercise]
  const peaksFor = PEAKS[exercise]
  const angle = useMotionValue(reduce ? cfg.targetDeg - 8 : REST[exercise])
  const [peaks, setPeaks] = useState<number[]>(reduce ? peaksFor : [])
  const cycle = useMemo(() => createRepCycle({ top: cfg.enterDeg + 25, bottom: cfg.exitDeg - 5 }), [cfg])

  useEffect(() => {
    setPeaks(reduce ? PEAKS[exercise] : [])
    cycle.reset()
    if (reduce) {
      angle.set(EXERCISES[exercise].targetDeg - 8)
      return
    }
    angle.set(REST[exercise])
    const frames = [REST[exercise], ...PEAKS[exercise].flatMap((p) => [p, REST[exercise]])]
    const controls = animate(angle, frames, { duration: PEAKS[exercise].length * SECONDS_PER_REP, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.4 })
    return () => controls.stop()
  }, [angle, cycle, exercise, reduce])

  useMotionValueEvent(angle, 'change', (v) => {
    const e = cycle.feed(v)
    if (e.completed && e.peak != null) {
      const peak = e.peak
      setPeaks((prev) => (prev.length >= peaksFor.length ? [peak] : [...prev, peak]))
    }
  })

  const label = useTransform(angle, (v) => `${Math.round(v)}°`)
  const last = peaks.at(-1)
  const low = cfg.targetDeg - 15
  const nudge = last == null ? null : last < low ? { text: 'Range shrinking late in the set', tone: 'warn' as const } : { text: 'Full range', tone: 'good' as const }

  if (failed) return <LiveArc compact={compact} />

  return (
    <div className={`grid items-stretch gap-4 ${compact ? 'sm:grid-cols-[minmax(0,1fr)_160px]' : 'sm:grid-cols-[minmax(0,1fr)_190px]'}`}>
      <div className="relative overflow-hidden rounded-[22px] bg-black/60">
        <SceneBoundary fallback={null} onError={() => setFailed(true)}>
          <LazyJointScene
            exercise={exercise}
            angle={angle}
            goalDeg={cfg.targetDeg}
            className={compact ? 'h-[250px]' : 'h-[300px] sm:h-[340px]'}
            label={`A 3D ${cfg.name.toLowerCase()} performing reps toward a ${cfg.targetDeg} degree goal`}
            fallback={<div className={`skeleton ${compact ? 'h-[250px]' : 'h-[300px] sm:h-[340px]'}`} />}
          />
        </SceneBoundary>
        <div className="pointer-events-none absolute top-4 left-4">
          <motion.div className="font-display text-[2.6rem] leading-none text-ink tabular-nums glow-text">{label}</motion.div>
          <div className="mt-1 text-[11.5px] font-semibold tracking-[0.12em] text-muted uppercase">
            {cfg.metricLabel} · goal {cfg.targetDeg}°
          </div>
        </div>
        {exercises && (
          <div className="absolute bottom-3 left-1/2 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2">
            <Segmented label="Exercise shown" options={OPTIONS} value={exercise} onChange={setExercise} />
          </div>
        )}
      </div>

      <div className="rounded-[18px] border border-line bg-surface/90 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Live set</span>
          <span className="text-[13px] font-semibold text-ink tabular-nums">
            Rep {peaks.length} <span className="font-medium text-muted">/ {peaksFor.length}</span>
          </span>
        </div>
        <div className="mt-3 flex h-16 items-end gap-1.5" aria-hidden="true">
          {peaksFor.map((_, i) => {
            const p = peaks[i]
            const height = p == null ? 0 : Math.max(8, ((p - (cfg.targetDeg - 45)) / 45) * 100)
            return (
              <div key={i} className="flex h-full flex-1 items-end rounded-[6px] bg-surface-2">
                {p != null && (
                  <motion.div className={`w-full rounded-[6px] ${p < low ? 'bg-warn' : 'bg-sky'}`} initial={reduce ? false : { height: 0 }} animate={{ height: `${Math.min(100, height)}%` }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} />
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-3 h-5 text-[12.5px] font-semibold">
          {nudge && (
            <motion.span key={peaks.length} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={nudge.tone === 'warn' ? 'text-warn' : 'text-sky'}>
              {nudge.text}
            </motion.span>
          )}
        </div>
      </div>
    </div>
  )
}
