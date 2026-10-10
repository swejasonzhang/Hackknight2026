import { EXERCISES, sideLabel, type SessionDto } from '@arc/dependencies'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useMemo, useRef, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ease } from '../components/motion'
import { Lamp, Tag } from '../components/ui'
import { deg, fatigueLabel, formatDate } from '../format'
import { dayStart, firstDay, groupByDay, progressFor, shiftDay, weekOf, type DayKey } from './days'

const long = (key: DayKey) => dayStart(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const monthDay = (key: DayKey) => dayStart(key).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
const weekday = (key: DayKey) => dayStart(key).toLocaleDateString(undefined, { weekday: 'short' })
const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const workouts = (n: number) => (n === 0 ? 'rest day' : n === 1 ? '1 workout' : `${n} workouts`)
const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x))}°`

interface Props {
  /** Every session of the profile, any order. */
  sessions: SessionDto[]
  day: DayKey
  /** The viewer's today: the log never steps past it. */
  today: DayKey
  onDayChange: (day: DayKey) => void
}

/**
 * The plan page's log, one day at a time: step back and forth a day, or pick a day from its
 * week, and read that day's workouts with how each one moved against the previous session of
 * the same movement, the first one, and the goal. A day without workouts is a rest day and
 * offers the last workout before it.
 */
export function DayLog({ sessions, day, today, onDayChange }: Props) {
  const reduce = useReducedMotion()
  const titleId = useId()
  const byDay = useMemo(() => groupByDay(sessions), [sessions])
  const earliest = useMemo(() => firstDay(sessions), [sessions])
  const direction = useRef(0)
  const list = byDay.get(day) ?? []
  const week = weekOf(day)

  const go = (next: DayKey) => {
    if (next === day || next > today) return
    direction.current = next > day ? 1 : -1
    onDayChange(next)
  }
  const canBack = earliest != null && day > earliest
  const canForward = day < today
  const lastBefore = useMemo(() => [...byDay.keys()].filter((k) => k < day).sort().at(-1) ?? null, [byDay, day])

  const onWeekKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && canBack) go(shiftDay(day, -1))
    if (e.key === 'ArrowRight' && canForward) go(shiftDay(day, 1))
  }

  const reps = list.reduce((sum, s) => sum + s.summary.totalReps, 0)
  const minutes = Math.round(list.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0) / 60_000)

  return (
    <section aria-labelledby={titleId} className="min-w-0">
      {/* The day dial: step back, the day itself, step forward, jump to today. */}
      <div className="flex items-center gap-2 border-b border-rule-strong pb-4 sm:gap-3">
        <button type="button" className="btn btn-icon" aria-label="Previous day" onClick={() => go(shiftDay(day, -1))} disabled={!canBack}>
          <span aria-hidden="true">←</span>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h3 id={titleId} className="t-strip truncate" aria-live="polite">
            {long(day)}
          </h3>
          <div className="t-meta mt-1">{day === today ? 'Today' : day === shiftDay(today, -1) ? 'Yesterday' : dayStart(day).getFullYear()}</div>
        </div>
        <button type="button" className="btn btn-icon" aria-label="Next day" onClick={() => go(shiftDay(day, 1))} disabled={!canForward}>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" className="btn hidden sm:inline-flex" onClick={() => go(today)} disabled={day === today}>
          Today
        </button>
      </div>

      {/* The week around the day: a lamp per workout, the chosen day carries the cobalt edge. */}
      <div role="group" aria-label={`Week of ${monthDay(week[0]!)}`} className="week-strip mt-4" onKeyDown={onWeekKey}>
        {week.map((key) => {
          const n = byDay.get(key)?.length ?? 0
          const selected = key === day
          return (
            <button key={key} type="button" className="week-cell" aria-pressed={selected} aria-label={`${long(key)}: ${workouts(n)}`} disabled={key > today} onClick={() => go(key)}>
              {selected && <motion.span layoutId={`${titleId}-day`} aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-cobalt" transition={{ duration: 0.24, ease }} />}
              <span className="t-meta">{weekday(key)}</span>
              <span className="week-date">{dayStart(key).getDate()}</span>
              <span className="flex h-2 items-center gap-1" aria-hidden="true">
                {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                  <span key={i} className="h-1.5 w-1.5 bg-cobalt" />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={day}
          initial={reduce ? false : { opacity: 0, x: 24 * direction.current }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -16 * direction.current }}
          transition={{ duration: 0.24, ease }}
        >
          {list.length === 0 ? (
            <div className="mt-6 border border-rule bg-paper px-5 py-8 text-center sm:px-8">
              <div className="t-label flex items-center justify-center gap-2">
                <Lamp /> Rest day
              </div>
              <p className="t-desc mx-auto mt-2 max-w-[44ch]">No workouts on {long(day)}. Rest counts too: range comes back best after a day off.</p>
              {lastBefore && (
                <button type="button" className="btn mt-5" onClick={() => go(lastBefore)}>
                  Go to the last workout, {formatDate(dayStart(lastBefore).getTime())}
                </button>
              )}
            </div>
          ) : (
            <>
              <dl className="mt-4 grid grid-cols-3 border-b border-rule">
                {[
                  ['Workouts', String(list.length)],
                  ['Reps', String(reps)],
                  ['Minutes', String(minutes)],
                ].map(([k, v]) => (
                  <div key={k} className="border-r border-rule py-3 pr-3 last:border-r-0 [&:not(:first-child)]:pl-4">
                    <dt className="t-label">{k}</dt>
                    <dd className="m-0 mt-1 font-display text-[24px] leading-none font-semibold text-navy">{v}</dd>
                  </div>
                ))}
              </dl>
              <ol className="mt-2">
                {list.map((s, i) => (
                  <motion.li key={s.id} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease, delay: 0.06 * i }}>
                    <WorkoutRow session={s} sessions={sessions} day={day} />
                  </motion.li>
                ))}
              </ol>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}

/** One workout: when, which movement, the readings, and how it moved. */
function WorkoutRow({ session: s, sessions, day }: { session: SessionDto; sessions: SessionDto[]; day: DayKey }) {
  const headingId = useId()
  const name = EXERCISES[s.exercise].name
  const p = progressFor(sessions, s)
  const fatigue = fatigueLabel(s.summary.fatigueIndex)
  const best = s.summary.bestPeakDeg
  const pctOf = (x: number) => `${Math.min(100, Math.max(0, (x / 180) * 100))}%`

  return (
    <article aria-labelledby={headingId} className="border-b border-rule py-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="t-meta w-[68px] flex-none tabular-nums">{time(s.startedAt)}</span>
          <h4 id={headingId} className="font-sans text-[16px] font-medium text-ink">
            {name} <span className="t-meta">· {sideLabel(s.exercise, s.side)}</span>
          </h4>
          {s.demo && <Tag soft>Demo</Tag>}
        </div>
        <Link to={`/sessions/${s.id}`} state={{ from: `/plan?day=${day}`, label: 'Plan' }} className="t-label text-cobalt">
          Open session →
        </Link>
      </header>

      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:pl-[80px]">
        <dl className="grid grid-cols-4 gap-3">
          {[
            ['Reps', String(s.summary.totalReps)],
            ['Best', deg(best)],
            ['Mean', deg(s.summary.meanPeakDeg)],
            ['Fatigue', s.summary.fatigueIndex.toFixed(2)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="t-label">{k}</dt>
              <dd className={`m-0 mt-1 font-mono text-[15px] tabular-nums ${k === 'Best' ? 'font-semibold text-navy' : 'text-ink-2'}`}>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="min-w-0">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px] tracking-[0.02em]">
            {p.previous && p.deltaPrevious != null ? (
              <li className={p.deltaPrevious >= 0 ? 'text-cobalt' : 'text-muted'}>
                {signed(p.deltaPrevious)} vs {formatDate(p.previous.startedAt)}
              </li>
            ) : (
              <li className="text-muted">First {name.toLowerCase()} session</li>
            )}
            {p.first && p.deltaFirst != null && (
              <li className="text-ink-2">
                {signed(p.deltaFirst)} since {formatDate(p.first.startedAt)}
              </li>
            )}
            <li className={p.toGoal === 0 ? 'text-ok' : 'text-ink-2'}>{p.toGoal === 0 ? `Goal ${p.goal}° reached` : `${Math.round(p.toGoal)}° to the ${p.goal}° goal`}</li>
          </ul>

          {/* Range meter: 0 to 180 degrees, the best rep filled in cobalt, the goal as a navy tick, the previous best as a hairline. */}
          <div role="img" aria-label={`Best ${Math.round(best)} degrees of a ${p.goal} degree goal`} className="relative mt-3 h-2 bg-vellum">
            <motion.span className="absolute inset-y-0 left-0 bg-cobalt" initial={{ width: 0 }} animate={{ width: pctOf(best) }} transition={{ duration: 0.6, ease }} />
            {p.previous && <span className="absolute -inset-y-0.5 w-px bg-ink-2/60" style={{ left: pctOf(p.previous.summary.bestPeakDeg) }} />}
            <span className="absolute -inset-y-1.5 w-0.5 bg-navy" style={{ left: pctOf(p.goal) }} />
          </div>
          <div className="t-meta mt-1.5 flex items-center justify-between">
            <span>0°</span>
            <span className="flex items-center gap-1.5">
              <Lamp tone={fatigue.tone} /> {fatigue.text}
            </span>
            <span>180°</span>
          </div>
        </div>
      </div>
      {s.coachSummary && (
        <p className="mt-4 max-w-[78ch] text-[14px] leading-[1.55] text-ink-2 sm:pl-[80px]">
          <span className="t-label mr-2 text-cobalt">Arc</span>
          {s.coachSummary.text}
        </p>
      )}
    </article>
  )
}
