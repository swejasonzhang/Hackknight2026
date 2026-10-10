import { EXERCISES, type ExerciseId, type PlanInput } from '@arc/dependencies'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import { Lamp } from './ui'

type RecordPlan = Pick<PlanInput, 'exercise' | 'side' | 'sets' | 'reps' | 'restSeconds'>
/** Without a saved plan: the movement on screen, right side, 3 sets of 8, 45 s rest. */
const DEFAULTS = { side: 'right', sets: 3, reps: 8, restSeconds: 45 } as const

/**
 * The dashboard's way into recording: Arc tracks the body through the webcam, in the browser,
 * straight into the profile's plan. Nothing to install; the video stays on the device.
 */
export function RecordPanel({ plan, exercise }: { plan: RecordPlan | null; exercise: ExerciseId }) {
  const titleId = useId()
  const start: RecordPlan = plan ?? { exercise, ...DEFAULTS }
  const summary = `${EXERCISES[start.exercise].name} · ${start.side} · ${start.sets} × ${start.reps} · ${start.restSeconds} s rest`
  return (
    <section aria-labelledby={titleId} className="panel mb-6 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6">
        <div className="min-w-0">
          <div className="t-label flex items-center gap-2">
            <Lamp tone="good" /> Camera · in this browser
          </div>
          <h2 id={titleId} className="t-strip mt-2">
            Record a session
          </h2>
          <p className="t-desc mt-1 max-w-[62ch]">
            Arc tracks your body through the webcam right here, with nothing to install. It finds the joints of the movement, measures every rep in degrees, counts your sets and times the rest, then saves the session to this dashboard. The video never leaves this device; only the angles are saved.
          </p>
          <p className="t-meta mt-3 text-navy">
            {plan ? 'Plan' : 'No plan yet'} · <span className="normal-case">{summary}</span>
          </p>
        </div>
        <Link to={plan ? '/record' : `/record?exercise=${exercise}`} className="btn btn-block justify-self-start">
          <Lamp tone="primary" />
          Start recording
        </Link>
      </div>
    </section>
  )
}
