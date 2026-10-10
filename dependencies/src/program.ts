/**
 * The member's week: which days they train and what each day holds. Arc builds it from the
 * onboarding answers (Gemini when configured, `programFromIntake` otherwise), the dashboard draws
 * it as a calendar, and every prescription stays inside the training goal's ranges.
 */
import { z } from 'zod'
import { PlanInputSchema, WeekdaySchema, type CoachIntake, type PlanInput, type TrainingGoal } from './api.ts'
import { EXERCISE_LIST, EXERCISES } from './engine/exercises.ts'

type Range = readonly [number, number]

export interface TrainingRange {
  sets: Range
  reps: Range
  restSeconds: Range
  /** How Arc says the goal out loud. */
  label: string
  guidance: string
}

/** Ported from ai-coach/ai_coach/training_plan.py: fixed by the product spec, never by the model. */
export const TRAINING_RANGES: Record<TrainingGoal, TrainingRange> = {
  strength: {
    sets: [2, 4],
    reps: [2, 6],
    restSeconds: [120, 300],
    label: 'strength',
    guidance: "Go heavy. Strength work is low reps with real load: if you're hitting the top of the rep range with room to spare, go up in weight next time.",
  },
  hypertrophy: {
    sets: [3, 5],
    reps: [8, 12],
    restSeconds: [60, 180],
    label: 'muscle size',
    guidance: 'Moderate weight, taken close to muscle fatigue. If every set is easily clearing 12 reps, go up in weight; if you cannot reach 8, go down.',
  },
  endurance: {
    sets: [2, 4],
    reps: [13, 25],
    restSeconds: [30, 60],
    label: 'stamina',
    guidance: 'Go light. Endurance is about reps, not load: if you cannot hit the top of the rep range with good form, drop the weight rather than push through.',
  },
}

const clamp = (value: number, [lo, hi]: Range) => Math.min(hi, Math.max(lo, Math.round(value)))

/** A prescription pulled back inside its goal's ranges (Gemini's numbers go through this). */
export function clampToRanges(p: { sets: number; reps: number; restSeconds: number }, goal: TrainingGoal) {
  const r = TRAINING_RANGES[goal]
  return { sets: clamp(p.sets, r.sets), reps: clamp(p.reps, r.reps), restSeconds: clamp(p.restSeconds, r.restSeconds) }
}

// ---- the program ----

export const ProgramDaySchema = z.object({
  weekday: WeekdaySchema,
  title: z.string().trim().min(1).max(60),
  items: z.array(PlanInputSchema).min(1).max(4),
})
export type ProgramDay = z.infer<typeof ProgramDaySchema>

export const ProgramInputSchema = z.object({
  /** Arc's few spoken sentences about the week. */
  summary: z.string().trim().min(1).max(800),
  days: z
    .array(ProgramDaySchema)
    .min(1)
    .max(7)
    .refine((days) => new Set(days.map((d) => d.weekday)).size === days.length, { message: 'Each weekday at most once' }),
})
export type ProgramInput = z.infer<typeof ProgramInputSchema>

/** Who wrote the week: Gemini, Arc's own rules, or the demo seed. */
export type ProgramSource = 'gemini' | 'arc' | 'demo'

export interface ProgramDto extends ProgramInput {
  id: string
  profileId: string
  active: boolean
  source: ProgramSource
  createdAt: number
}

// ---- days of the week ----

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
/** Monday first, the way a training week reads. */
export const mondayFirst = (a: number, b: number) => ((a + 6) % 7) - ((b + 6) % 7)

/** "Monday, Wednesday and Friday". */
export function weekdayList(days: readonly number[]): string {
  const names = [...days].sort(mondayFirst).map((d) => WEEKDAY_NAMES[d]!)
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** `count` training days spread through the week, Monday first, so rest days fall between them. */
export function spreadDays(count: number): number[] {
  const table: Record<number, number[]> = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] }
  return table[Math.min(7, Math.max(1, Math.round(count)))]!
}

const DAY_PATTERNS: [RegExp, number][] = [
  [/\bsun(day)?s?\b/, 0],
  [/\bmon(day)?s?\b/, 1],
  [/\btue(s|sday)?s?\b/, 2],
  [/\bwed(nesday)?s?\b/, 3],
  [/\bthu(r|rs|rsday)?s?\b/, 4],
  [/\bfri(day)?s?\b/, 5],
  [/\bsat(urday)?s?\b/, 6],
]
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, once: 1, twice: 2 }

/** Training days from an answer: day names, "weekdays", "weekends", "every day", or a count. Empty when unclear. */
export function parseWeekdays(raw: string): number[] {
  const text = raw.toLowerCase()
  if (/\bevery ?day\b|\bdaily\b|\ball week\b/.test(text)) return [0, 1, 2, 3, 4, 5, 6]
  const named = new Set(DAY_PATTERNS.filter(([re]) => re.test(text)).map(([, d]) => d))
  if (/\bweekdays?\b/.test(text)) [1, 2, 3, 4, 5].forEach((d) => named.add(d))
  if (/\bweekends?\b/.test(text)) [0, 6].forEach((d) => named.add(d))
  if (named.size) return [...named].sort((a, b) => a - b)
  const digit = text.match(/\b([1-7])\b/)
  const word = Object.keys(NUMBER_WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(text))
  const count = digit ? Number(digit[1]) : word ? NUMBER_WORDS[word]! : 0
  return count ? spreadDays(count) : []
}

/** Strength, muscle size or stamina from plain words; null when the answer says none of them. */
export function parseTrainingGoal(raw: string): TrainingGoal | null {
  const text = raw.toLowerCase()
  if (/stamina|endur|cardio|conditioning|longer|lighter|tone up/.test(text)) return 'endurance'
  if (/strong|strength|power|heav|lift more/.test(text)) return 'strength'
  if (/muscle|size|bigger|bulk|hypertroph|mass|build/.test(text)) return 'hypertrophy'
  return null
}

const inRange = (value: number, lo: number, hi: number) => (value >= lo && value <= hi ? Math.round(value) : undefined)

/** Height in whole centimetres from "180 cm", "1.75 m", "5'11", "6 foot", "5 ft 4 in" or a bare number; undefined to skip. */
export function parseHeightCm(raw: string): number | undefined {
  const text = raw.toLowerCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"')
  const feet = text.match(/(\d+(?:\.\d+)?)\s*(?:'|ft\b|feet\b|foot\b)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in\b|inch(?:es)?\b)?)?/)
  if (feet) return inRange(Number(feet[1]) * 30.48 + Number(feet[2] ?? 0) * 2.54, 80, 250)
  const cm = text.match(/(\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?)\b/)
  if (cm) return inRange(Number(cm[1]), 80, 250)
  const m = text.match(/(\d(?:\.\d+)?)\s*(?:m|met(?:er|re)s?)\b/)
  if (m) return inRange(Number(m[1]) * 100, 80, 250)
  const inches = text.match(/(\d+(?:\.\d+)?)\s*(?:in|inch(?:es)?)\b/)
  if (inches) return inRange(Number(inches[1]) * 2.54, 80, 250)
  const bare = text.match(/\b(\d+(?:\.\d+)?)\b/)
  if (!bare) return undefined
  const n = Number(bare[1])
  return n >= 100 ? inRange(n, 80, 250) : n >= 48 ? inRange(n * 2.54, 80, 250) : undefined
}

/** Weight in whole kilograms from "75 kg", "165 lbs", "180 pounds" or a bare number; undefined to skip. */
export function parseWeightKg(raw: string): number | undefined {
  const text = raw.toLowerCase()
  const lbs = text.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/)
  if (lbs) return inRange(Number(lbs[1]) * 0.45359237, 25, 350)
  const kg = text.match(/(\d+(?:\.\d+)?)\s*(?:kgs?|kilos?|kilograms?)\b/)
  if (kg) return inRange(Number(kg[1]), 25, 350)
  const bare = text.match(/\b(\d+(?:\.\d+)?)\b/)
  if (!bare) return undefined
  const n = Number(bare[1])
  // A bare number above 150 is far likelier pounds than kilograms.
  return n > 150 ? inRange(n * 0.45359237, 25, 350) : inRange(n, 25, 350)
}

// ---- building a week ----

const LEVEL = { new: 0, some: 0.5, regular: 1 } as const

/**
 * Arc's own week from the answers, used whenever Gemini is off or sends something unusable.
 * Every day opens with the focus movement on the member's side; anyone past "new" gets a second,
 * rotating movement for variety. Sets and reps sit higher in the goal's range with experience,
 * rest lower.
 */
export function programFromIntake(intake: CoachIntake): ProgramInput {
  const goal = intake.trainingGoal ?? 'hypertrophy'
  const range = TRAINING_RANGES[goal]
  const level = LEVEL[intake.experience]
  const at = ([lo, hi]: Range, t: number) => lo + (hi - lo) * t
  const sets = Math.round(at(range.sets, level))
  const reps = Math.round(at(range.reps, level))
  const restSeconds = clamp(Math.round(at(range.restSeconds, 1 - level) / 15) * 15, range.restSeconds)
  const item = (exercise: PlanInput['exercise']): PlanInput => ({ exercise, side: intake.side, sets, reps, restSeconds, targetDeg: EXERCISES[exercise].targetDeg })

  const weekdays = (intake.trainingDays?.length ? [...new Set(intake.trainingDays)] : spreadDays(intake.daysPerWeek)).sort(mondayFirst)
  const others = EXERCISE_LIST.map((e) => e.id).filter((id) => id !== intake.focus)
  const days: ProgramDay[] = weekdays.map((weekday, i) => {
    const items = [item(intake.focus)]
    if (intake.experience !== 'new' && others.length) items.push(item(others[i % others.length]!))
    return { weekday, title: items.map((x) => EXERCISES[x.exercise].name).join(' + ').slice(0, 60), items }
  })
  const focus = EXERCISES[intake.focus]
  const count = weekdays.length
  const summary = `${count} ${count === 1 ? 'day' : 'days'} a week (${weekdayList(weekdays)}), built for ${range.label}: ${sets} sets of ${reps} with ${restSeconds} seconds of rest. Every day starts with your ${intake.side} ${focus.name.toLowerCase()}, aiming for ${focus.targetDeg} degrees.`
  return { summary, days }
}

/** The training day that falls on `date` (by its local weekday), or undefined on a rest day. */
export function programDayOn(program: Pick<ProgramInput, 'days'>, date: Date): ProgramDay | undefined {
  return program.days.find((d) => d.weekday === date.getDay())
}
