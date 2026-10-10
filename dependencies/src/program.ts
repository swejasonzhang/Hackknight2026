/**
 * The member's week: which days they train and what each day holds. Arc builds it from the
 * onboarding answers (Gemini when configured, `programFromIntake` otherwise), the dashboard draws
 * it as a calendar, and every prescription stays inside the training goal's ranges.
 */
import { z } from 'zod'
import { PlanInputSchema, WeekdaySchema, type CoachIntake, type PlanDto, type PlanInput, type TrainingGoal } from './api.ts'
import { BODY_AREAS, EXERCISE_LIST, EXERCISES } from './engine/exercises.ts'
import type { BodyArea, ExerciseId } from './engine/types.ts'

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

/** The order areas follow through a week: upper body, legs, back, core, then round again. */
const AREA_CYCLE: BodyArea[] = ['upper', 'legs', 'back', 'core']
const areaName = (a: BodyArea) => BODY_AREAS.find((x) => x.id === a)!.name

/** The body area a training day works: its first movement's. */
export function areaOfDay(day: Pick<ProgramDay, 'items'>): BodyArea {
  return EXERCISES[day.items[0]!.exercise].area
}

/**
 * A week worth training: no body area on two training days running (Monday-first order), and at
 * least three areas once there are three days or more (two days: two areas).
 */
export function isDiverseWeek(days: Pick<ProgramDay, 'weekday' | 'items'>[]): boolean {
  const areas = [...days].sort((a, b) => mondayFirst(a.weekday, b.weekday)).map(areaOfDay)
  if (areas.some((a, i) => i > 0 && a === areas[i - 1])) return false
  return new Set(areas).size >= Math.min(areas.length, 3)
}

/** "upper body, legs and back". */
const listOf = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

/**
 * Arc's own week from the answers, used whenever Gemini is off or sends something unusable. Each
 * training day works one body area, in turn from the focus's area (upper body, legs, back, core),
 * so no area comes two training days running and the week covers as many areas as it has days.
 * The focus movement opens the week; an area that comes round again uses its other movements.
 * Someone new does one movement a day, everyone else two. Sets and reps sit higher in the goal's
 * range with experience, rest lower.
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
  const focus = EXERCISES[intake.focus]
  const start = AREA_CYCLE.indexOf(focus.area)
  const perDay = intake.experience === 'new' ? 1 : 2
  const seen = new Map<BodyArea, number>()
  const days: ProgramDay[] = weekdays.map((weekday, i) => {
    const area = AREA_CYCLE[(start + i) % AREA_CYCLE.length]!
    // The area's movements, the focus first when it is the focus's area.
    const pool = EXERCISE_LIST.filter((e) => e.area === area).sort((a, b) => Number(b.id === focus.id) - Number(a.id === focus.id))
    const round = seen.get(area) ?? 0
    seen.set(area, round + 1)
    const picks = Array.from({ length: Math.min(perDay, pool.length) }, (_, k) => pool[(round * perDay + k) % pool.length]!.id)
    const items = picks.map(item)
    return { weekday, title: `${areaName(area)} · ${picks.map((id) => EXERCISES[id].short).join(' + ')}`.slice(0, 60), items }
  })
  const count = weekdays.length
  const areas = [...new Set(days.map(areaOfDay))].map((a) => areaName(a).toLowerCase())
  const spread = count === 1 ? `working your ${areas[0]}` : `a different area each day: ${listOf(areas)}`
  const summary = `${count} ${count === 1 ? 'day' : 'days'} a week (${weekdayList(weekdays)}), built for ${range.label}: ${sets} sets of ${reps} with ${restSeconds} seconds of rest, ${spread}. Your ${intake.side} ${focus.name.toLowerCase()} opens the week, aiming for ${focus.targetDeg} degrees.`
  return { summary, days }
}

/** The training day that falls on `date` (by its local weekday), or undefined on a rest day. */
export function programDayOn(program: Pick<ProgramInput, 'days'>, date: Date): ProgramDay | undefined {
  return program.days.find((d) => d.weekday === date.getDay())
}

export type PrescriptionSource = 'plan' | 'week' | 'default'
export interface Prescription extends PlanInput {
  /** Where the numbers came from: the saved plan, the week Arc built, or the goal's ranges. */
  source: PrescriptionSource
}

/**
 * What Record runs for the movement picked on the dashboard: the saved plan when it is for that
 * movement; else the week's prescription for it (the one on `date` first, else its first day);
 * else the member's goal ranges on their side (3 x 8 with 45 s rest without an intake), always
 * with the movement's own goal angle unless a plan or the week sets one.
 */
export function prescriptionFor(
  exercise: ExerciseId,
  { plan, program, intake, date = new Date() }: { plan?: Pick<PlanDto, keyof PlanInput> | null; program?: Pick<ProgramInput, 'days'> | null; intake?: CoachIntake | null; date?: Date },
): Prescription {
  if (plan && plan.exercise === exercise) {
    const { side, sets, reps, restSeconds, targetDeg } = plan
    return { exercise, side, sets, reps, restSeconds, targetDeg, source: 'plan' }
  }
  if (program) {
    const today = programDayOn(program, date)?.items.find((i) => i.exercise === exercise)
    const any = program.days.flatMap((d) => d.items).find((i) => i.exercise === exercise)
    const item = today ?? any
    if (item) return { ...item, source: 'week' }
  }
  const targetDeg = EXERCISES[exercise].targetDeg
  if (!intake) return { exercise, side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg, source: 'default' }
  const own = programFromIntake({ ...intake, focus: exercise }).days[0]!.items[0]!
  return { ...own, source: 'default' }
}
