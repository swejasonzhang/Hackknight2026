import { programDayOn, type ProgramDay, type ProgramDto, type ProgramItem, type SessionDto } from '@arc/dependencies'
import { dayKey, dayStart, type DayKey } from './days'

/** One movement of a training day, and whether it has been done. */
export interface ChecklistEntry {
  item: ProgramItem
  /** Its place in the day's order. */
  index: number
  done: boolean
  /** The session that did it. */
  session?: SessionDto
}

/**
 * A training day's movements in order, each done once a session of that movement was recorded
 * that day; each session ticks off one entry, so a movement planned twice needs two sessions.
 */
export function checklistFor(day: Pick<ProgramDay, 'items'>, daySessions: readonly SessionDto[]): ChecklistEntry[] {
  const unused = [...daySessions].sort((a, b) => a.startedAt - b.startedAt)
  return day.items.map((item, index) => {
    const at = unused.findIndex((s) => s.exercise === item.exercise)
    const session = at >= 0 ? unused.splice(at, 1)[0] : undefined
    return session ? { item, index, done: true, session } : { item, index, done: false }
  })
}

/** What to do next: the first movement not done yet. */
export const nextEntry = (list: readonly ChecklistEntry[]): ChecklistEntry | undefined => list.find((e) => !e.done)

/**
 * The week's plan for a day and how far through it the member got, or null when the week has no
 * training on that weekday, or the day comes before this week was set (an older week held it then).
 */
export function plannedDay(program: Pick<ProgramDto, 'days' | 'createdAt'> | null | undefined, sessions: readonly SessionDto[], key: DayKey): { day: ProgramDay; list: ChecklistEntry[] } | null {
  if (!program || key < dayKey(program.createdAt)) return null
  const day = programDayOn(program, dayStart(key))
  if (!day) return null
  return { day, list: checklistFor(day, sessions.filter((s) => dayKey(s.startedAt) === key)) }
}
