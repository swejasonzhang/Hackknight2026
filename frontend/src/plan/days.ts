import type { SessionDto } from '@arc/dependencies'

/** A calendar day on the viewer's own clock, as `YYYY-MM-DD`. */
export type DayKey = string

const pad = (n: number) => String(n).padStart(2, '0')
const fromDate = (d: Date): DayKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Local midnight of a day key. */
export function dayStart(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

/** The local calendar day an instant falls on. */
export function dayKey(ms: number): DayKey {
  return fromDate(new Date(ms))
}

/** `days` later (or earlier, when negative); calendar arithmetic, so daylight saving cannot skip a day. */
export function shiftDay(key: DayKey, days: number): DayKey {
  const d = dayStart(key)
  return fromDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

/** Monday to Sunday of the week holding `key`. */
export function weekOf(key: DayKey): DayKey[] {
  const sinceMonday = (dayStart(key).getDay() + 6) % 7
  const monday = shiftDay(key, -sinceMonday)
  return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i))
}

/** The six Monday-to-Sunday weeks that show a month on a calendar, `monthOf` being any day in it. */
export function monthGrid(monthOf: DayKey): DayKey[] {
  const first = dayStart(monthOf)
  const firstKey = fromDate(new Date(first.getFullYear(), first.getMonth(), 1))
  const start = weekOf(firstKey)[0]!
  return Array.from({ length: 42 }, (_, i) => shiftDay(start, i))
}

/** The first of the month `months` away from the month holding `key`. */
export function shiftMonth(key: DayKey, months: number): DayKey {
  const d = dayStart(key)
  return fromDate(new Date(d.getFullYear(), d.getMonth() + months, 1))
}

/** A day key from untrusted text (a URL parameter); null unless it names a real calendar day. */
export function parseDayKey(text: string | null | undefined): DayKey | null {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  return fromDate(dayStart(text)) === text ? text : null
}

/** Sessions by local day, each day in time order. */
export function groupByDay(sessions: SessionDto[]): Map<DayKey, SessionDto[]> {
  const days = new Map<DayKey, SessionDto[]>()
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const key = dayKey(s.startedAt)
    const list = days.get(key)
    if (list) list.push(s)
    else days.set(key, [s])
  }
  return days
}

/** Where the log opens: the latest day with a workout, or today when there is none yet. */
export function defaultDay(sessions: SessionDto[], now = Date.now()): DayKey {
  if (sessions.length === 0) return dayKey(now)
  return dayKey(Math.max(...sessions.map((s) => s.startedAt)))
}

/** The first day with a workout, the earliest the log steps back to. */
export function firstDay(sessions: SessionDto[]): DayKey | null {
  if (sessions.length === 0) return null
  return dayKey(Math.min(...sessions.map((s) => s.startedAt)))
}

export interface SessionProgress {
  /** The latest earlier session of the same movement and side. */
  previous: SessionDto | null
  deltaPrevious: number | null
  /** The first session of the same movement and side, when it is not this one. */
  first: SessionDto | null
  deltaFirst: number | null
  /** The goal the session was counted against. */
  goal: number
  /** Degrees still to go; zero once the goal is reached. */
  toGoal: number
}

/** How a session's best rep compares with what came before it and with its goal. */
export function progressFor(sessions: SessionDto[], session: SessionDto): SessionProgress {
  const earlier = sessions
    .filter((s) => s.id !== session.id && s.exercise === session.exercise && s.side === session.side && s.startedAt < session.startedAt)
    .sort((a, b) => a.startedAt - b.startedAt)
  const previous = earlier.at(-1) ?? null
  const first = earlier[0] ?? null
  const best = session.summary.bestPeakDeg
  const goal = session.plan.targetDeg
  return {
    previous,
    deltaPrevious: previous ? best - previous.summary.bestPeakDeg : null,
    first,
    deltaFirst: first ? best - first.summary.bestPeakDeg : null,
    goal,
    toGoal: Math.max(0, goal - best),
  }
}
