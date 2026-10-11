import { challengeEnds, type Challenge, type ChallengeProgress, type ChallengeRunDto } from '@arc/dependencies'
import { motion, useReducedMotion } from 'motion/react'
import type { Ref } from 'react'
import { Link } from 'react-router-dom'
import { ease } from '../components/motion'
import { Lamp, StatTile, Strip } from '../components/ui'
import { formatDate } from '../format'
import { phaseSpan, weeksText } from './facts'

interface Props {
  run: ChallengeRunDto
  challenge: Challenge
  progress: ChallengeProgress
  /** False when the profile's sessions could not load, so the days trained are not counted. */
  counted?: boolean
  index: string
  busy?: boolean
  onLeave: () => void
  /** A finished challenge: on to the catalog for the next one. */
  onPickNext: () => void
  /** The challenge's name, focused after a start so the run is announced. */
  titleRef?: Ref<HTMLHeadingElement>
  now?: number
}

/**
 * The profile's challenge: the week it is in and its phase, the training days done against the
 * whole challenge (a mark where the plan has them by today), the share of the days so far that were
 * trained, the days left, and the phases end to end with the current one marked; then the way to
 * the week, and out. A finished challenge keeps its numbers and points at the next.
 */
export function YourChallenge({ run, challenge, progress, counted = true, index, busy = false, onLeave, onPickNext, titleRef, now = Date.now() }: Props) {
  const reduce = useReducedMotion()
  const finished = run.status === 'done' || progress.finished
  const lastDay = challengeEnds(run, challenge) - 1
  const share = Math.round(progress.adherence * 100)
  const asked = counted && progress.plannedSoFar > 0
  // The lamp goes by the share shown: 79.5% reads 80%, and 80% or more is good.
  const shareTone = asked ? (share >= 80 ? 'good' : 'warn') : 'default'
  const { doneSoFar, plannedSoFar, plannedTotal, daysLeft } = progress
  const left = daysLeft === 0 ? 'the last day' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`

  return (
    <Strip index={index} title="Your challenge" aside={finished ? `Finished ${formatDate(lastDay)}` : `Week ${progress.week} of ${progress.weeks} · ${left}`}>
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <div className="min-w-0">
          <div className="t-meta flex items-center gap-2">
            <Lamp tone={finished ? 'good' : 'primary'} /> {finished ? 'Finished' : 'Under way'} · started {formatDate(run.startedAt)}
          </div>
          <h3 ref={titleRef} tabIndex={-1} className="t-value mt-3 leading-[1.1] break-words">
            {challenge.name}
          </h3>
          <p className="t-label mt-2 text-navy">{finished ? `All ${challenge.weeks} weeks · finished` : `Week ${progress.week} of ${progress.weeks} · ${challenge.phases[progress.phase]!.name}`}</p>

          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="t-label">Training days</span>
              <span className="font-mono text-[13px] text-ink tabular-nums">{counted ? `${doneSoFar} of ${plannedTotal}` : `${plannedTotal} in all`}</span>
            </div>
            {counted ? (
              <>
                <div
                  role="progressbar"
                  aria-label="Training days done"
                  aria-valuemin={0}
                  aria-valuemax={plannedTotal}
                  aria-valuenow={doneSoFar}
                  aria-valuetext={`${doneSoFar} of ${plannedTotal} training days done`}
                  className="relative mt-2 h-3 bg-vellum-2"
                >
                  <motion.span className="absolute inset-y-0 left-0 bg-cobalt" initial={reduce ? false : { width: 0 }} animate={{ width: `${(100 * doneSoFar) / plannedTotal}%` }} transition={{ duration: 0.6, ease }} />
                  {/* Where the plan has them by today. */}
                  {!finished && <span aria-hidden="true" className="absolute -top-1 -bottom-1 w-[2px] bg-navy" style={{ left: `${(100 * plannedSoFar) / plannedTotal}%` }} />}
                </div>
                {!finished && <p className="t-meta mt-2 normal-case">The mark is where the plan has you by today: {plannedSoFar} training {plannedSoFar === 1 ? 'day' : 'days'}.</p>}
              </>
            ) : (
              <p className="t-meta mt-2 normal-case">Your sessions could not load, so the days trained are not counted here. Reload the page to try again.</p>
            )}
          </div>

          <div className="mt-2">
            <StatTile
              label={finished ? 'Trained' : 'So far'}
              tone={shareTone}
              value={asked ? `${share}%` : '–'}
              hint={asked ? `${doneSoFar} of ${plannedSoFar} training days${finished ? '' : ' so far'}` : counted ? 'No training day yet' : 'Sessions could not load'}
            />
            {finished ? <StatTile label="Last day" value={formatDate(lastDay)} hint={`${challenge.weeks} weeks from ${formatDate(run.startedAt)}`} /> : <StatTile label="Days left" value={daysLeft} hint={`Finishes ${formatDate(lastDay)}`} />}
          </div>
        </div>

        <div className="min-w-0">
          <PhaseLine challenge={challenge} phase={progress.phase} finished={finished} elapsed={Math.min(1, Math.max(0, (now - run.startedAt) / (lastDay + 1 - run.startedAt)))} />
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            {finished && (
              <button type="button" className="btn btn-block" onClick={onPickNext}>
                Pick the next challenge
              </button>
            )}
            <Link to="/plan" className="t-label text-cobalt">
              Open your week →
            </Link>
            {!finished && (
              <button type="button" className="btn btn-sm btn-danger ml-auto" disabled={busy} onClick={onLeave}>
                Leave the challenge
              </button>
            )}
          </div>
          <p className="t-meta mt-3 normal-case">
            {finished
              ? 'Your week stays as the last phase left it until you change it or start another challenge.'
              : 'Each new phase replaces your week when it starts. Leaving keeps the week as it is.'}
          </p>
        </div>
      </div>
    </Strip>
  )
}

/** The phases end to end, each as long as its weeks, with a mark at today and the current phase named. */
function PhaseLine({ challenge, phase, finished, elapsed }: { challenge: Challenge; phase: number; finished: boolean; elapsed: number }) {
  return (
    <div>
      <div className="t-label">Phases</div>
      <div className="relative mt-3 flex h-2 gap-[2px]" aria-hidden="true">
        {challenge.phases.map((p, i) => {
          const { from, to } = phaseSpan(challenge, i)
          return <span key={p.fromWeek} className={`min-w-0 basis-0 ${finished || i < phase ? 'bg-navy' : i === phase ? 'bg-cobalt' : 'bg-vellum-2'}`} style={{ flexGrow: to - from + 1 }} />
        })}
        {!finished && <span className="absolute -top-1.5 -bottom-1.5 w-[2px] -translate-x-1/2 bg-ink" style={{ left: `${elapsed * 100}%` }} />}
      </div>
      <ol className="mt-3 grid gap-1.5" aria-label="Phases">
        {challenge.phases.map((p, i) => {
          const current = !finished && i === phase
          return (
            <li key={p.fromWeek} className="flex items-baseline gap-3" aria-current={current ? 'step' : undefined}>
              <Lamp tone={current ? 'primary' : 'default'} className="self-center" />
              <span className="t-meta w-[88px] flex-none">{weeksText(challenge, i)}</span>
              <span className={`min-w-0 flex-1 text-[14px] ${current ? 'font-medium text-ink' : 'text-ink-2'}`}>{p.name}</span>
              {current && <span className="t-label flex-none text-cobalt">Now</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
