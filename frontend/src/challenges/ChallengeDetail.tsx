import { EXERCISES, mondayFirst, TRAINING_RANGES, WEEKDAY_NAMES, type BodyDto, type Challenge, type ProfileDto } from '@arc/dependencies'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import { figureKey } from '../body/growth'
import { Alert, Lamp } from '../components/ui'
import { factsOf, weeksText } from './facts'
import { FinishBody } from './FinishBody'

/*
 * One column on a phone and beside the cards (lg); under the cards on a tablet (md), the reading on
 * the left and the body with its start on the right. Spare height goes to the last row, so the
 * reading never spreads out to match the body.
 */
const GRID = 'grid gap-6 md:grid-cols-2 md:grid-rows-[auto_auto_1fr] md:gap-x-8 lg:grid-cols-1 lg:grid-rows-none lg:gap-x-0'
const AREA = {
  about: 'md:col-start-1 md:row-start-1 lg:col-auto lg:row-auto',
  body: 'md:col-start-2 md:row-span-3 md:row-start-1 lg:col-auto lg:row-auto',
  phases: 'md:col-start-1 md:row-start-2 lg:col-auto lg:row-auto',
  week: 'md:col-start-1 md:row-start-3 lg:col-auto lg:row-auto',
}

interface Props {
  challenge: Challenge
  /** The heading's id, which names the panel. */
  titleId: string
  /** Who would start it: the selected profile, or null while the profiles load or when there are none. */
  profile: ProfileDto | null
  /** The account has no profile yet, so nobody can start one. */
  noProfiles: boolean
  /** The profile's own challenge is known, so a start can say what it replaces. */
  ready: boolean
  body: BodyDto | null
  bodyLoading: boolean
  bodyFailed: boolean
  /** When this is the profile's challenge under way, the week it is in and its phase. */
  running: { week: number; phase: number } | null
  busy: boolean
  error: string | null
  onStart: () => void
}

/**
 * A challenge in full: who it is for, the body it builds by the finish from the member's own body
 * today, the way to start it, its phases and the week its first phase trains.
 */
export function ChallengeDetail({ challenge, titleId, profile, noProfiles, ready, body, bodyLoading, bodyFailed, running, busy, error, onStart }: Props) {
  const phasesId = useId()
  const weekId = useId()
  const first = challenge.phases[0]!
  const days = [...first.days].sort((a, b) => mondayFirst(a.weekday, b.weekday))

  return (
    <>
      <header className="border-b border-rule pb-4">
        <div className="t-meta">
          {factsOf(challenge)} · for {TRAINING_RANGES[challenge.goal].label}
        </div>
        <h2 id={titleId} className="mt-2 font-display text-[24px] leading-[1.05] font-semibold break-words text-navy sm:text-[28px]">
          {challenge.name}
        </h2>
        <p className="mt-2 text-[15px] leading-[1.5] text-ink-2">{challenge.tagline}</p>
      </header>

      <div className={`mt-5 ${GRID}`}>
        <p className={`${AREA.about} max-w-[62ch] text-[15px] leading-[1.6] text-ink`}>{challenge.about}</p>

        <div className={`${AREA.body} min-w-0`}>
          <FinishBody challenge={challenge} name={profile?.name ?? null} figure={figureKey(profile?.figure)} body={body} loading={bodyLoading} failed={bodyFailed} fromWeek={running?.week ?? 1} />
          <div className="mt-5">
            {running ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="t-label flex items-center gap-2 text-navy">
                  <Lamp tone="primary" /> You are on it · week {running.week} of {challenge.weeks}
                </span>
                <Link to="/plan" className="t-label text-cobalt">
                  Open your week →
                </Link>
              </div>
            ) : noProfiles ? (
              <p className="t-desc">
                A challenge sets one person's week. <Link to="/profiles">Add a profile →</Link>
              </p>
            ) : (
              <>
                <button type="button" className="btn btn-block w-full" disabled={busy || !profile || !ready} onClick={onStart}>
                  {busy ? 'Starting…' : 'Start this challenge'}
                </button>
                <p className="t-meta mt-2 normal-case">From today, {profile ? `${profile.name}'s` : 'the'} week becomes its first phase; each new phase replaces the week when it starts.</p>
              </>
            )}
            {error && (
              <div className="mt-3">
                <Alert tone="bad">{error}</Alert>
              </div>
            )}
          </div>
        </div>

        <div className={`${AREA.phases} min-w-0`}>
          <h3 id={phasesId} className="t-label text-navy">
            {challenge.phases.length} phases
          </h3>
          <ol className="mt-2 border-t border-rule-strong" aria-labelledby={phasesId}>
            {challenge.phases.map((p, i) => {
              const current = running?.phase === i
              return (
                <li key={p.fromWeek} className="border-b border-rule py-2.5" aria-current={current ? 'step' : undefined}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-[14.5px] font-medium text-ink">
                      {current && <Lamp tone="primary" />}
                      {p.name}
                    </span>
                    <span className="t-meta flex-none">{weeksText(challenge, i)}</span>
                  </div>
                  <p className="t-desc mt-0.5">{p.note}</p>
                </li>
              )
            })}
          </ol>
        </div>

        <div className={`${AREA.week} min-w-0`}>
          <h3 id={weekId} className="t-label text-navy">
            The first week · {first.name}
          </h3>
          <ol className="mt-2 border-t border-rule-strong" aria-labelledby={weekId}>
            {days.map((d) => (
              <li key={d.weekday} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-rule py-2.5">
                <span className="t-meta pt-0.5 text-navy">
                  <span aria-hidden="true">{WEEKDAY_NAMES[d.weekday]!.slice(0, 3)}</span>
                  <span className="sr-only">{WEEKDAY_NAMES[d.weekday]}</span>
                </span>
                <div className="min-w-0">
                  <div className="text-[14.5px] font-medium text-ink">{d.title}</div>
                  <ul className="mt-0.5">
                    {d.items.map((item, i) => (
                      <li key={i} className="font-mono text-[12.5px] leading-[1.6] text-ink-2">
                        {EXERCISES[item.exercise].name} · {item.sets} × {item.reps}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
          <p className="t-meta mt-2 normal-case">The days between are rest days.</p>
        </div>
      </div>
    </>
  )
}
