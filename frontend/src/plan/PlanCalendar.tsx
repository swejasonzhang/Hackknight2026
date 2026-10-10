import { EXERCISES, programDayOn, WEEKDAY_NAMES, type ExerciseId, type ProgramDto, type SessionDto } from '@arc/dependencies'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiRequestError } from '../api/client'
import { IconChevronLeft, IconChevronRight } from '../components/icons'
import { Alert, EmptyState, Lamp, Skeleton, Strip } from '../components/ui'
import { dayKey, dayStart, groupByDay, monthGrid, shiftDay, shiftMonth, weekOf, type DayKey } from './days'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const HEADS = [1, 2, 3, 4, 5, 6, 0].map((d) => WEEKDAY_NAMES[d]!)
const SOURCE: Record<ProgramDto['source'], string> = { gemini: 'Planned by Arc with Gemini', arc: 'Planned by Arc', demo: 'Demo week' }

const longDate = (key: DayKey) => {
  const d = dayStart(key)
  return `${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
const monthName = (key: DayKey) => {
  const d = dayStart(key)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

type Status = 'done' | 'missed' | 'planned' | 'rest'

/**
 * The member's week on a month calendar (ADR-0020): Arc's training days from the program, each
 * marked done (a session that day), not recorded (a past training day with none) or planned, and
 * today ringed. The selected day's workout sits beside the grid; arrow keys move the selection.
 * Days that hold the movement picked on the dashboard (`exercise`) show it in cobalt.
 */
export function PlanCalendar({ profileId, exercise, now = Date.now() }: { profileId: string; exercise?: ExerciseId; now?: number }) {
  const today = dayKey(now)
  const [program, setProgram] = useState<ProgramDto | null | undefined>(undefined)
  const [sessions, setSessions] = useState<SessionDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<DayKey>(today)
  const [month, setMonth] = useState<DayKey>(shiftMonth(today, 0))
  const buttons = useRef(new Map<DayKey, HTMLButtonElement>())
  const keyboard = useRef(false)
  const captionId = useId()
  const detailsId = useId()

  useEffect(() => {
    let cancelled = false
    setProgram(undefined)
    setError(null)
    Promise.all([
      api.plan.program(profileId).catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.status === 404) return null
        throw err
      }),
      api.sessions.list(profileId),
    ])
      .then(([p, s]) => {
        if (cancelled) return
        setProgram(p)
        setSessions(s)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your week')
      })
    return () => {
      cancelled = true
    }
  }, [profileId])

  // Keyboard moves keep focus on the selected day, even when it lands in another month.
  useEffect(() => {
    if (!keyboard.current) return
    keyboard.current = false
    buttons.current.get(selected)?.focus()
  }, [selected, month])

  const byDay = useMemo(() => groupByDay(sessions), [sessions])
  const startKey = program ? dayKey(program.createdAt) : null
  const planOn = (key: DayKey) => (program && startKey && key >= startKey ? programDayOn(program, dayStart(key)) : undefined)
  const statusOf = (key: DayKey): Status => (byDay.has(key) ? 'done' : planOn(key) ? (key < today ? 'missed' : 'planned') : 'rest')

  if (error) {
    return (
      <Strip index="01" title="Your week">
        <Alert tone="bad">{error}</Alert>
      </Strip>
    )
  }
  if (program === undefined) {
    return (
      <Strip index="01" title="Your week">
        <Skeleton height={320} />
      </Strip>
    )
  }
  if (program === null) {
    return (
      <Strip index="01" title="Your week">
        <EmptyState
          title="No week planned yet"
          description="Tell Arc what you want from your body and which days you can train. Arc builds your week, and it shows here as a calendar."
          action={
            <Link className="btn btn-block" to={`/welcome?profile=${profileId}`}>
              Plan my week with Arc
            </Link>
          }
        />
      </Strip>
    )
  }

  const thisWeek = weekOf(today)
  const plannedThisWeek = thisWeek.filter((k) => planOn(k)).length
  const doneThisWeek = thisWeek.filter((k) => planOn(k) && byDay.has(k)).length

  const select = (key: DayKey, fromKeyboard = false) => {
    keyboard.current = fromKeyboard
    setSelected(key)
    if (key.slice(0, 7) !== month.slice(0, 7)) setMonth(shiftMonth(key, 0))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, key: DayKey) => {
    const sinceMonday = (dayStart(key).getDay() + 6) % 7
    const moves: Record<string, () => DayKey> = {
      ArrowLeft: () => shiftDay(key, -1),
      ArrowRight: () => shiftDay(key, 1),
      ArrowUp: () => shiftDay(key, -7),
      ArrowDown: () => shiftDay(key, 7),
      Home: () => shiftDay(key, -sinceMonday),
      End: () => shiftDay(key, 6 - sinceMonday),
      PageUp: () => shiftMonth(key, -1),
      PageDown: () => shiftMonth(key, 1),
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    select(move(), true)
  }

  const grid = monthGrid(month)
  const weeks = Array.from({ length: 6 }, (_, w) => grid.slice(w * 7, w * 7 + 7))
  const sel = planOn(selected)
  const selSessions = byDay.get(selected) ?? []
  const selStatus = statusOf(selected)

  const label = (key: DayKey) => {
    const plan = planOn(key)
    const status = statusOf(key)
    const parts = [longDate(key)]
    if (key === today) parts.push('today')
    parts.push(plan ? `training day: ${plan.title}` : 'rest day')
    if (exercise && plan?.items.some((i) => i.exercise === exercise)) parts.push(`includes ${EXERCISES[exercise].name.toLowerCase()}`)
    if (status === 'done') parts.push(`done, ${byDay.get(key)!.length} ${byDay.get(key)!.length === 1 ? 'session' : 'sessions'}`)
    if (status === 'missed') parts.push('not recorded')
    if (status === 'planned') parts.push('planned')
    return parts.join(', ')
  }

  return (
    <Strip index="01" title="Your week" aside={plannedThisWeek ? `${doneThisWeek} of ${plannedThisWeek} done this week` : SOURCE[program.source]}>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <p className="max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-2">{program.summary}</p>
        <Link to={`/welcome?profile=${profileId}`} className="t-label flex-none text-cobalt">
          Rebuild with Arc →
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px] xl:gap-6">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id={captionId} className="t-strip">
              {monthName(month)}
            </h3>
            <div className="flex items-center gap-1">
              <button type="button" className="btn btn-sm btn-icon" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
                <IconChevronLeft size={16} />
              </button>
              <button type="button" className="btn btn-sm" onClick={() => select(today)}>
                Today
              </button>
              <button type="button" className="btn btn-sm btn-icon" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
                <IconChevronRight size={16} />
              </button>
            </div>
          </div>

          <table role="grid" aria-labelledby={captionId} className="cal">
            <thead>
              <tr>
                {HEADS.map((name) => (
                  <th key={name} scope="col" abbr={name}>
                    <span aria-hidden="true">{name.slice(0, 3)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((days) => (
                <tr key={days[0]}>
                  {days.map((key) => {
                    const plan = planOn(key)
                    const status = statusOf(key)
                    const inMonth = key.slice(0, 7) === month.slice(0, 7)
                    const holds = !!exercise && !!plan?.items.some((i) => i.exercise === exercise)
                    return (
                      <td key={key} role="gridcell" aria-selected={key === selected}>
                        <button
                          type="button"
                          ref={(el) => {
                            if (el) buttons.current.set(key, el)
                            else buttons.current.delete(key)
                          }}
                          tabIndex={key === selected ? 0 : -1}
                          className="cal-day"
                          data-status={status}
                          data-out={inMonth ? undefined : 'true'}
                          data-today={key === today ? 'true' : undefined}
                          data-holds={holds ? 'true' : undefined}
                          aria-label={label(key)}
                          aria-controls={detailsId}
                          onClick={() => select(key)}
                          onKeyDown={(e) => onKeyDown(e, key)}
                        >
                          <span className="cal-num" aria-hidden="true">
                            {dayStart(key).getDate()}
                          </span>
                          {plan && (
                            <span className="cal-title" aria-hidden="true">
                              {EXERCISES[holds ? exercise! : plan.items[0]!.exercise].short}
                              {plan.items.length > 1 ? ` +${plan.items.length - 1}` : ''}
                            </span>
                          )}
                          {status !== 'rest' && <span aria-hidden="true" className={`cal-mark lamp ${status === 'done' ? 'lamp-ok' : status === 'planned' ? 'lamp-on' : ''}`} />}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="t-meta mt-3 flex flex-wrap gap-x-5 gap-y-1" aria-hidden="true">
            <span className="flex items-center gap-2">
              <span className="lamp lamp-on" /> Planned
            </span>
            <span className="flex items-center gap-2">
              <span className="lamp lamp-ok" /> Done
            </span>
            <span className="flex items-center gap-2">
              <span className="lamp" /> Not recorded
            </span>
            {exercise && (
              <span className="flex items-center gap-2 text-cobalt">
                <span className="cal-key" /> Days with {EXERCISES[exercise].name.toLowerCase()}
              </span>
            )}
          </div>
        </div>

        <section id={detailsId} aria-label={`Selected day: ${longDate(selected)}`} aria-live="polite" className="panel min-w-0 self-start p-4">
          <div className="t-meta">{selected === today ? 'Today' : selStatus === 'done' ? 'Done' : selStatus === 'missed' ? 'Not recorded' : sel ? 'Planned' : 'Rest day'}</div>
          <h3 className="t-strip mt-1">{longDate(selected)}</h3>
          {sel ? (
            <>
              <div className="t-label mt-4 text-navy">{sel.title}</div>
              <ul className="mt-2">
                {sel.items.map((item, i) => (
                  <li key={i} className="border-b border-rule py-2 font-mono text-[12.5px] leading-[1.5] text-ink-2 last:border-b-0">
                    {EXERCISES[item.exercise].name} · {item.side} · {item.sets} × {item.reps} · {item.restSeconds} s rest · goal {item.targetDeg}°
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-[14px] text-ink-2">A rest day. Recovery is part of the plan.</p>
          )}
          {selSessions.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1">
              {selSessions.map((s) => (
                <li key={s.id}>
                  <Link to={`/sessions/${s.id}`} className="flex items-center gap-2 text-[14px]">
                    <Lamp tone="good" />
                    {EXERCISES[s.exercise].name} · best {Math.round(s.summary.bestPeakDeg)}°
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {selected === today && sel && selStatus !== 'done' && (
              <Link to="/record" className="btn btn-block btn-sm">
                <Lamp tone="primary" /> Start recording
              </Link>
            )}
            <Link to={`/plan?day=${selected}`} className="t-label text-cobalt">
              Open in the log →
            </Link>
          </div>
        </section>
      </div>
    </Strip>
  )
}

