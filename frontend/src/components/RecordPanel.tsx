import { EXERCISES, type Prescription } from '@arc/dependencies'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import { Lamp } from './ui'

const SOURCE: Record<Prescription['source'], string> = { plan: 'Plan', week: 'This week', default: 'Suggested' }

/**
 * The dashboard's way into recording: Arc tracks the body through the webcam, in the browser,
 * for the movement picked on the dashboard, at its prescription (the plan, the week Arc built, or
 * the goal's ranges). Nothing to install; the video stays on the device.
 */
export function RecordPanel({ prescription }: { prescription: Prescription }) {
  const titleId = useId()
  const p = prescription
  const summary = `${EXERCISES[p.exercise].name} · ${p.side} · ${p.sets} × ${p.reps} · ${p.restSeconds} s rest`
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
            Arc tracks your body through the webcam right here, with nothing to install. It finds the joints of the movement, measures every rep in degrees, counts your sets and times the rest, saving each set to this dashboard as it finishes. The video never leaves this device; only the angles are saved.
          </p>
          <p className="t-meta mt-3 text-navy">
            {SOURCE[p.source]} · <span className="normal-case">{summary}</span>
          </p>
        </div>
        <Link to={`/record?exercise=${p.exercise}`} className="btn btn-block justify-self-start">
          <Lamp tone="primary" />
          Start recording
        </Link>
      </div>
    </section>
  )
}
