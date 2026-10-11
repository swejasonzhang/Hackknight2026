import { daysPerWeek, type Challenge } from '@arc/dependencies'

/** A challenge's level as the cards say it. */
const LEVEL_NAME: Record<Challenge['level'], string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

/** The weeks phase `index` runs, counted from 1: from its first to the week before the next phase starts, or to the last. */
export function phaseSpan(challenge: Challenge, index: number): { from: number; to: number } {
  const next = challenge.phases[index + 1]
  return { from: challenge.phases[index]!.fromWeek, to: next ? next.fromWeek - 1 : challenge.weeks }
}

/** "Weeks 1–4", or "Week 5" for a phase of a single week. */
export function weeksText(challenge: Challenge, index: number): string {
  const { from, to } = phaseSpan(challenge, index)
  return from === to ? `Week ${from}` : `Weeks ${from}–${to}`
}

/** How long, how often (the first phase's days) and for whom: "12 weeks · 4 days a week · Intermediate". */
export function factsOf(challenge: Challenge): string {
  const days = daysPerWeek(challenge.phases[0]!)
  return `${challenge.weeks} weeks · ${days} ${days === 1 ? 'day' : 'days'} a week · ${LEVEL_NAME[challenge.level]}`
}

/**
 * What to ask before `name` starts `challenge`, or null when nothing is lost. Starting replaces
 * the week in force (it stays in the plan's history) and leaves a challenge under way.
 */
export function startQuestion(challenge: Challenge, name: string, running: Challenge | null, hasWeek: boolean): string | null {
  if (running) return `Start ${challenge.name}? ${name} leaves ${running.name}, and ${challenge.name}'s first phase replaces the week. Earlier weeks stay in the plan's history.`
  if (hasWeek) return `Start ${challenge.name}? Its first phase replaces ${name}'s current week. Earlier weeks stay in the plan's history.`
  return null
}
