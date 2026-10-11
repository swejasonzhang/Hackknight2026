import { EXERCISES } from '@arc/dependencies'
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { DEMO_GROWTH } from '../three/body/figure'
import { LazyJointScene, SceneBoundary } from '../three/lazy'
import { Lamp } from '../ui'
import { createRepCycle } from './repCycle'

const EXERCISE = EXERCISES.elbow_flexion
const GOAL = EXERCISE.targetDeg
/** Six demo reps per loop, every one reaching the goal line; the last ones only just, as a real set fades. */
const PEAKS = [143, 145, 142, 146, 141, 140]
/** Every rep starts and ends with the arm straight: the readout comes all the way back to 0°. */
const REST = EXERCISE.restDeg
const SECONDS_PER_REP = 2.4
const PAUSE_BETWEEN_LOOPS = 1.4
const REPS_PER_SET = 8
const SETS = 3
/** The pose held when motion is reduced: a rep at the top, past the goal. */
const HELD = 142
/** Where the counters stand in the held pose: the fourth rep of the second set. */
const HELD_REPS_DONE = 11

/** The Suspense fallback: a hatched rectangle on the grid that also reports whether the scene is still loading. */
function Pending({ onPending }: { onPending: (pending: boolean) => void }) {
  useLayoutEffect(() => {
    onPending(true)
    return () => onPending(false)
  }, [onPending])
  return <div className="hatch absolute inset-6" aria-hidden="true" />
}

/**
 * The specimen stage of the landing page: a paper panel holding the blueprint grid, a whole 3D
 * body performing elbow flexion on a loop, and the instrument's DOM callouts (exercise, set and rep
 * counters, the GOAL tick, the live readout numeral). The angle is a Motion value fed through
 * `createRepCycle`, so nothing re-renders per frame; only a completed rep touches React state.
 * Under reduced motion the limb holds 129° and the numeral reads 129°. If the 3D scene cannot
 * start, a "3D unavailable" callout sits on the grid and the numeral keeps reading.
 */
export function LiveJoint() {
  const reduce = useReducedMotion()
  const angle = useMotionValue(reduce ? HELD : REST)
  // A rep counts as the real counter counts it: past the curl's entry angle, then back under its exit.
  const cycle = useMemo(() => createRepCycle({ top: EXERCISE.enterDeg, bottom: EXERCISE.exitDeg }), [])
  const [done, setDone] = useState(reduce ? HELD_REPS_DONE : 0)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  // Where the goal tick is on the stage, so the goal line points exactly at it.
  const [goalAt, setGoalAt] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    cycle.reset()
    if (reduce) {
      angle.set(HELD)
      setDone(HELD_REPS_DONE)
      return
    }
    angle.set(REST)
    setDone(0)
    const frames = [REST, ...PEAKS.flatMap((p) => [p, REST])]
    const controls = animate(angle, frames, { duration: PEAKS.length * SECONDS_PER_REP, ease: 'easeInOut', repeat: Infinity, repeatDelay: PAUSE_BETWEEN_LOOPS })
    return () => controls.stop()
  }, [angle, cycle, reduce])

  useMotionValueEvent(angle, 'change', (v) => {
    if (cycle.feed(v).completed) setDone((n) => n + 1)
  })

  const readout = useTransform(angle, (v) => `${Math.round(v)}°`)
  const rep = (done % REPS_PER_SET) + 1
  const set = (Math.floor(done / REPS_PER_SET) % SETS) + 1
  const live = !reduce && !pending
  const numeral = (
    <>
      {live ? (
        <motion.span className="t-readout">{readout}</motion.span>
      ) : reduce ? (
        <span className="t-readout">{HELD}°</span>
      ) : (
        <span className="t-readout font-mono text-muted">---°</span>
      )}
      <span className="t-meta mb-2 tabular-nums">
        Rep {rep} / {REPS_PER_SET}
      </span>
    </>
  )

  return (
    <div className="panel p-3 sm:p-4">
      <div className="flex items-center justify-between gap-4 px-1 pb-3">
        <div className="flex items-center gap-2.5">
          <Lamp tone={failed ? 'default' : 'primary'} />
          <span className="t-label text-navy">{EXERCISE.name} · right</span>
        </div>
        <span className="t-meta tabular-nums" aria-hidden="true">
          Set {set}/{SETS}
        </span>
      </div>

      <div className="stage h-[260px] overflow-hidden sm:h-[360px] lg:h-[420px]">
        <SceneBoundary
          fallback={
            <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
              <span className="callout relative">3D unavailable</span>
            </div>
          }
          onError={() => setFailed(true)}
        >
          <LazyJointScene
            exercise="elbow_flexion"
            angle={angle}
            goalDeg={GOAL}
            growth={DEMO_GROWTH}
            className="h-full w-full"
            label={`A 3D figure of a whole body doing elbow flexion reps toward a ${GOAL} degree goal, its shoulder, elbow and wrist tracked and the angle read out live in degrees`}
            fallback={<Pending onPending={setPending} />}
            onGoalPoint={setGoalAt}
          />
        </SceneBoundary>

        {/* The goal line: from the goal tick on the figure's arc out to its label, so every rep is seen to reach it. */}
        <div
          className="pointer-events-none absolute right-3 flex -translate-y-1/2 items-center sm:right-4"
          style={goalAt ? { top: goalAt.y, left: goalAt.x } : { top: '34%' }}
          aria-hidden="true"
        >
          <span className={`h-px border-t border-dashed border-navy ${goalAt ? 'flex-1' : 'w-8 sm:w-12'}`} />
          <span className="callout relative">Goal {GOAL}°</span>
        </div>

        {/* Over the stage from tablet up; on a phone it would cover the figure's feet, so it sits below. */}
        <div className="pointer-events-none absolute bottom-3 left-4 hidden items-end gap-4 sm:flex" aria-hidden="true">
          {numeral}
        </div>
      </div>
      <div className="flex items-end gap-4 px-1 pt-3 sm:hidden" aria-hidden="true">
        {numeral}
      </div>
    </div>
  )
}
