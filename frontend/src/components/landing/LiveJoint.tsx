import { EXERCISES } from '@arc/dependencies'
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { LazyJointScene, SceneBoundary } from '../three/lazy'
import { Lamp } from '../ui'
import { createRepCycle } from './repCycle'

const EXERCISE = EXERCISES.elbow_flexion
const GOAL = EXERCISE.targetDeg
/** Six demo reps per loop; the later ones shrink, as a real set does. */
const PEAKS = [131, 128, 134, 125, 129, 122]
const REST = 18
const SECONDS_PER_REP = 2.4
const PAUSE_BETWEEN_LOOPS = 1.4
const REPS_PER_SET = 8
const SETS = 3
/** The demo profile's best elbow flexion: the pose held when motion is reduced. */
const HELD = 129
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
 * The specimen stage of the landing page: a paper panel holding the blueprint grid, the 3D elbow
 * performing elbow flexion on a loop, and the instrument's DOM callouts (exercise, set and rep
 * counters, the GOAL tick, the live readout numeral). The angle is a Motion value fed through
 * `createRepCycle`, so nothing re-renders per frame; only a completed rep touches React state.
 * Under reduced motion the limb holds 129° and the numeral reads 129°. If the 3D scene cannot
 * start, a "3D unavailable" callout sits on the grid and the numeral keeps reading.
 */
export function LiveJoint() {
  const reduce = useReducedMotion()
  const angle = useMotionValue(reduce ? HELD : REST)
  const cycle = useMemo(() => createRepCycle({ top: 115, bottom: 35 }), [])
  const [done, setDone] = useState(reduce ? HELD_REPS_DONE : 0)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

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
            className="h-full w-full"
            label={`A 3D elbow performing elbow flexion reps toward a ${GOAL} degree goal, read out live in degrees`}
            fallback={<Pending onPending={setPending} />}
          />
        </SceneBoundary>

        <div className="pointer-events-none absolute top-[34%] right-3 flex items-center sm:right-4" aria-hidden="true">
          <span className="h-px w-8 bg-navy sm:w-12" />
          <span className="callout relative">Goal {GOAL}°</span>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-4 sm:left-4" aria-hidden="true">
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
        </div>
      </div>
    </div>
  )
}
