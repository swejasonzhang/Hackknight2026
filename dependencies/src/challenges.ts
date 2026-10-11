/**
 * Challenges: fixed plans for a physique within a set time (a summer body in twelve weeks, a
 * year-long transformation). Each is a week the member trains for the challenge's length, in
 * phases that step the work up; joining one makes it the member's week, and each new phase
 * replaces the week when it starts. The same growth model as the figure (growth.ts) projects the
 * body at the finish, so a member sees where the plan takes them before they start.
 */
import { z } from 'zod'
import type { TrainingGoal } from './api.ts'
import { EXERCISES } from './engine/exercises.ts'
import { MUSCLE_IDS, type ExerciseId, type MuscleId } from './engine/types.ts'
import { GROWTH, growWeek, MUSCLE_SIZE } from './growth.ts'
import type { ProgramDay, ProgramItem } from './program.ts'

export const CHALLENGE_IDS = ['summer_body', 'year_transformation', 'strong_arms', 'core_30', 'legs_glutes', 'v_taper', 'posture', 'first_month'] as const
export type ChallengeId = (typeof CHALLENGE_IDS)[number]
export const ChallengeIdSchema = z.enum(CHALLENGE_IDS)

export interface ChallengePhase {
  /** The first week of the phase, counted from 1. */
  fromWeek: number
  name: string
  /** What the phase asks of the member, said plainly. */
  note: string
  /** The week the member trains through the phase. */
  days: ProgramDay[]
}

export interface Challenge {
  id: ChallengeId
  name: string
  /** One line for the card. */
  tagline: string
  /** A short paragraph: who it is for and how it works. */
  about: string
  weeks: number
  level: 'beginner' | 'intermediate' | 'advanced'
  goal: TrainingGoal
  /** The muscle groups it builds most: the card's chips and what the preview leads with. */
  focus: MuscleId[]
  /** In order, the first from week 1. */
  phases: ChallengePhase[]
}

/** One movement of a challenge day, aimed at the movement's own goal angle; the side is the member's. */
const item = (exercise: ExerciseId, sets: number, reps: number, restSeconds: number, muscle?: MuscleId): ProgramItem => ({
  exercise,
  side: 'right',
  sets,
  reps,
  restSeconds,
  targetDeg: EXERCISES[exercise].targetDeg,
  ...(muscle ? { muscle } : {}),
})
const day = (weekday: number, title: string, items: ProgramItem[]): ProgramDay => ({ weekday, title, items })
const MON = 1
const TUE = 2
const WED = 3
const THU = 4
const FRI = 5
const SAT = 6

/** The summer body's week, at a phase's sets, reps and rest. */
function summerWeek(sets: number, reps: number, rest: number, core: number): ProgramDay[] {
  return [
    day(MON, 'Chest and shoulders', [item('chest_press', sets, reps, rest), item('pec_fly', sets, reps, rest), item('shoulder_press', sets, reps, rest), item('shoulder_abduction', sets, reps, rest)]),
    day(WED, 'Arms and core', [item('elbow_flexion', sets, reps, rest), item('tricep_extension', sets, reps, rest), item('crunch', core, 15, 45), item('ab_twist', core, 15, 45)]),
    day(FRI, 'Back and shoulders', [item('lat_pulldown', sets, reps, rest), item('bent_over_row', sets, reps, rest), item('front_raise', sets, reps, rest), item('shoulder_abduction', sets, reps, rest)]),
    day(SAT, 'Legs and core', [item('squat', sets, reps, rest), item('lunge', sets, reps, rest), item('crunch', core, 15, 45)]),
  ]
}

/** A whole-body week: legs, push, pull and core on each of its days. */
function wholeBody(days: number[], sets: number, reps: number, rest: number): ProgramDay[] {
  return days.map((weekday, i) =>
    day(weekday, i % 2 ? 'Whole body: hinge and pull' : 'Whole body: squat and push', [
      item(i % 2 ? 'deadlift' : 'squat', sets, reps, rest),
      item(i % 2 ? 'bent_over_row' : 'chest_press', sets, reps, rest),
      item(i % 2 ? 'lat_pulldown' : 'shoulder_press', sets, reps, rest),
      item(i % 2 ? 'ab_twist' : 'crunch', sets, Math.max(reps, 12), 45),
    ]),
  )
}

/** An upper and lower split over four days. */
function upperLower(sets: number, reps: number, rest: number): ProgramDay[] {
  return [
    day(MON, 'Upper body: push', [item('chest_press', sets, reps, rest), item('shoulder_press', sets, reps, rest), item('pec_fly', sets, reps, rest), item('tricep_extension', sets, reps, rest)]),
    day(TUE, 'Lower body: squat', [item('squat', sets, reps, rest), item('lunge', sets, reps, rest), item('seated_knee_extension', sets, reps, rest), item('crunch', sets, 15, 45)]),
    day(THU, 'Upper body: pull', [item('lat_pulldown', sets, reps, rest), item('bent_over_row', sets, reps, rest), item('elbow_flexion', sets, reps, rest), item('shoulder_abduction', sets, reps, rest)]),
    day(FRI, 'Lower body: hinge', [item('deadlift', sets, reps, rest), item('lunge', sets, reps, rest), item('squat', sets, reps, rest), item('ab_twist', sets, 15, 45)]),
  ]
}

export const CHALLENGES: Record<ChallengeId, Challenge> = {
  summer_body: {
    id: 'summer_body',
    name: 'Summer body',
    tagline: 'Chest, shoulders, arms and abs, ready for the beach in twelve weeks.',
    about: 'Four days a week aimed at what shows in a T-shirt and at the pool: the chest, the shoulders, the arms and the abs, with the back and the legs kept in balance. Each month adds work: lighter and longer at first, then more sets, then heavier.',
    weeks: 12,
    level: 'intermediate',
    goal: 'hypertrophy',
    focus: ['chest', 'side_delts', 'front_delts', 'biceps', 'triceps', 'abs'],
    phases: [
      { fromWeek: 1, name: 'Build the base', note: 'Three sets of twelve with a steady tempo; learn each movement to its goal.', days: summerWeek(3, 12, 75, 2) },
      { fromWeek: 5, name: 'Add volume', note: 'A fourth set on everything; rest a little longer between sets.', days: summerWeek(4, 10, 90, 3) },
      { fromWeek: 9, name: 'Sharpen', note: 'Heavier weights for eight good reps, and more core work.', days: summerWeek(4, 8, 90, 4) },
    ],
  },
  year_transformation: {
    id: 'year_transformation',
    name: '1-year transformation',
    tagline: 'A whole year from first rep to a built body: four phases, every muscle group.',
    about: 'For someone starting out who wants the long change. It begins with three easy whole-body days, then four days split into upper and lower body for size, a block for strength, and a final block that brings it together. Every phase replaces your week when it starts.',
    weeks: 52,
    level: 'beginner',
    goal: 'hypertrophy',
    focus: ['chest', 'lats', 'quads', 'glutes', 'side_delts', 'abs'],
    phases: [
      { fromWeek: 1, name: 'Foundations', note: 'Three whole-body days of light, clean reps: the habit before the load.', days: wholeBody([MON, WED, FRI], 2, 12, 60) },
      { fromWeek: 9, name: 'Build', note: 'Four days, upper and lower body, three sets of ten.', days: upperLower(3, 10, 90) },
      { fromWeek: 25, name: 'Strength', note: 'Heavier and fewer reps, longer rests: four sets of six.', days: upperLower(4, 6, 150) },
      { fromWeek: 41, name: 'Peak', note: 'Four sets of eight: the size of the build with the strength you gained.', days: upperLower(4, 8, 120) },
    ],
  },
  strong_arms: {
    id: 'strong_arms',
    name: 'Strong arms',
    tagline: 'Biceps, triceps and shoulders in eight weeks.',
    about: 'Three days a week that put the arms first, with the shoulders and the chest that frame them. Halfway through, every arm movement gets a fourth set.',
    weeks: 8,
    level: 'intermediate',
    goal: 'hypertrophy',
    focus: ['biceps', 'triceps', 'forearms', 'front_delts'],
    phases: [
      {
        fromWeek: 1,
        name: 'Pump',
        note: 'Three sets of twelve, slow on the way down.',
        days: [
          day(MON, 'Arms', [item('elbow_flexion', 3, 12, 60), item('tricep_extension', 3, 12, 60), item('front_raise', 3, 12, 60)]),
          day(WED, 'Shoulders and arms', [item('shoulder_press', 3, 12, 75), item('elbow_flexion', 3, 12, 60), item('tricep_extension', 3, 12, 60)]),
          day(FRI, 'Push and pull', [item('chest_press', 3, 12, 75), item('bent_over_row', 3, 12, 75), item('elbow_flexion', 3, 12, 60)]),
        ],
      },
      {
        fromWeek: 5,
        name: 'Grow',
        note: 'A fourth set on every arm movement, heavier for ten.',
        days: [
          day(MON, 'Arms', [item('elbow_flexion', 4, 10, 75), item('tricep_extension', 4, 10, 75), item('front_raise', 3, 10, 60)]),
          day(WED, 'Shoulders and arms', [item('shoulder_press', 3, 10, 90), item('elbow_flexion', 4, 10, 75), item('tricep_extension', 4, 10, 75)]),
          day(FRI, 'Push and pull', [item('chest_press', 3, 10, 90), item('bent_over_row', 3, 10, 90), item('elbow_flexion', 4, 10, 75)]),
        ],
      },
    ],
  },
  core_30: {
    id: 'core_30',
    name: '30-day core',
    tagline: 'Abs and obliques, five short sessions a week for a month.',
    about: 'Short sessions you can do anywhere: crunches and twists most days, with a light hinge for the lower back. The second half adds reps.',
    weeks: 4,
    level: 'beginner',
    goal: 'endurance',
    focus: ['abs', 'obliques', 'lower_back'],
    phases: [
      {
        fromWeek: 1,
        name: 'Wake it up',
        note: 'Two to three sets of fifteen, short rests.',
        days: [
          day(MON, 'Core', [item('crunch', 3, 15, 40), item('ab_twist', 3, 15, 40)]),
          day(TUE, 'Core and back', [item('crunch', 2, 15, 40), item('deadlift', 2, 15, 60)]),
          day(THU, 'Core', [item('crunch', 3, 15, 40), item('ab_twist', 3, 15, 40)]),
          day(FRI, 'Obliques', [item('ab_twist', 3, 15, 40), item('crunch', 2, 15, 40)]),
          day(SAT, 'Core and back', [item('crunch', 2, 15, 40), item('deadlift', 2, 15, 60)]),
        ],
      },
      {
        fromWeek: 3,
        name: 'Burn',
        note: 'Twenty reps a set and a third set everywhere.',
        days: [
          day(MON, 'Core', [item('crunch', 3, 20, 40), item('ab_twist', 3, 20, 40)]),
          day(TUE, 'Core and back', [item('crunch', 3, 20, 40), item('deadlift', 3, 15, 60)]),
          day(THU, 'Core', [item('crunch', 3, 20, 40), item('ab_twist', 3, 20, 40)]),
          day(FRI, 'Obliques', [item('ab_twist', 3, 20, 40), item('crunch', 3, 20, 40)]),
          day(SAT, 'Core and back', [item('crunch', 3, 20, 40), item('deadlift', 3, 15, 60)]),
        ],
      },
    ],
  },
  legs_glutes: {
    id: 'legs_glutes',
    name: 'Legs and glutes',
    tagline: 'Quads, glutes and hamstrings, three days a week for ten weeks.',
    about: 'Squats, lunges and deadlifts three times a week, with knee extensions to finish the quads. The second phase goes heavier.',
    weeks: 10,
    level: 'intermediate',
    goal: 'hypertrophy',
    focus: ['quads', 'glutes', 'hamstrings', 'calves'],
    phases: [
      {
        fromWeek: 1,
        name: 'Groove',
        note: 'Three sets of twelve, all the way to each goal.',
        days: [
          day(MON, 'Squat day', [item('squat', 3, 12, 90), item('lunge', 3, 12, 75), item('seated_knee_extension', 3, 12, 60)]),
          day(WED, 'Hinge day', [item('deadlift', 3, 12, 90), item('lunge', 3, 12, 75), item('squat', 2, 12, 75)]),
          day(FRI, 'Legs', [item('squat', 3, 12, 90), item('deadlift', 3, 12, 90), item('seated_knee_extension', 3, 12, 60)]),
        ],
      },
      {
        fromWeek: 6,
        name: 'Load',
        note: 'Four sets of eight with more weight; rest a full two minutes.',
        days: [
          day(MON, 'Squat day', [item('squat', 4, 8, 120), item('lunge', 3, 10, 90), item('seated_knee_extension', 3, 10, 60)]),
          day(WED, 'Hinge day', [item('deadlift', 4, 8, 120), item('lunge', 3, 10, 90), item('squat', 3, 10, 90)]),
          day(FRI, 'Legs', [item('squat', 4, 8, 120), item('deadlift', 3, 8, 120), item('seated_knee_extension', 3, 10, 60)]),
        ],
      },
    ],
  },
  v_taper: {
    id: 'v_taper',
    name: 'V-taper back',
    tagline: 'Wide lats and capped shoulders over twelve weeks.',
    about: 'Pulldowns and rows for width, raises and presses for the shoulders on top: the V from the shoulders to the waist. The work steps up every four weeks.',
    weeks: 12,
    level: 'intermediate',
    goal: 'hypertrophy',
    focus: ['lats', 'upper_back', 'side_delts', 'rear_delts'],
    phases: [3, 4, 4].map((sets, i) => ({
      fromWeek: 1 + i * 4,
      name: ['Width', 'Thickness', 'Shape'][i]!,
      note: ['Three sets of twelve pulls, elbows driving down.', 'A fourth set and heavier rows.', 'Heavier again for eight, raises kept light and clean.'][i]!,
      days: [
        day(TUE, 'Back width', [item('lat_pulldown', sets, [12, 10, 8][i]!, 90), item('bent_over_row', sets, [12, 10, 8][i]!, 90), item('shoulder_abduction', 3, 12, 60)]),
        day(THU, 'Shoulders', [item('shoulder_press', sets, [12, 10, 8][i]!, 90), item('shoulder_abduction', sets, 12, 60), item('front_raise', 3, 12, 60)]),
        day(SAT, 'Back and arms', [item('bent_over_row', sets, [12, 10, 8][i]!, 90), item('lat_pulldown', sets, [12, 10, 8][i]!, 90), item('elbow_flexion', 3, 12, 60)]),
      ],
    })),
  },
  posture: {
    id: 'posture',
    name: 'Strong back, better posture',
    tagline: 'Six weeks for the upper and lower back, shoulders back and down.',
    about: 'For desk days and stiff backs: rows and pulldowns for the upper back, a light hinge for the lower back, raises for the shoulders and twists for the trunk. Light and steady; stop any movement that hurts.',
    weeks: 6,
    level: 'beginner',
    goal: 'endurance',
    focus: ['upper_back', 'lower_back', 'rear_delts', 'traps'],
    phases: [
      {
        fromWeek: 1,
        name: 'Light and steady',
        note: 'Two to three sets of fifteen with a slow pull.',
        days: [
          day(MON, 'Upper back', [item('bent_over_row', 3, 15, 60), item('lat_pulldown', 2, 15, 60), item('shoulder_abduction', 2, 15, 45)]),
          day(WED, 'Lower back and trunk', [item('deadlift', 2, 15, 60), item('ab_twist', 2, 15, 45), item('crunch', 2, 15, 45)]),
          day(FRI, 'Whole back', [item('bent_over_row', 3, 15, 60), item('deadlift', 2, 15, 60), item('lat_pulldown', 2, 15, 60)]),
        ],
      },
      {
        fromWeek: 4,
        name: 'Hold it',
        note: 'Three sets throughout, a pause at the top of every row.',
        days: [
          day(MON, 'Upper back', [item('bent_over_row', 3, 15, 60), item('lat_pulldown', 3, 15, 60), item('shoulder_abduction', 3, 15, 45)]),
          day(WED, 'Lower back and trunk', [item('deadlift', 3, 15, 60), item('ab_twist', 3, 15, 45), item('crunch', 3, 15, 45)]),
          day(FRI, 'Whole back', [item('bent_over_row', 3, 15, 60), item('deadlift', 3, 15, 60), item('lat_pulldown', 3, 15, 60)]),
        ],
      },
    ],
  },
  first_month: {
    id: 'first_month',
    name: 'First month',
    tagline: 'Four weeks to learn every movement and make training a habit.',
    about: 'Three short whole-body days a week for anyone new: one movement for each part of the body, two sets each, all about reaching the goal angle with good form. The last two weeks add a set.',
    weeks: 4,
    level: 'beginner',
    goal: 'endurance',
    focus: ['quads', 'chest', 'lats', 'abs'],
    phases: [
      { fromWeek: 1, name: 'Learn', note: 'Two sets of twelve: form first, then range.', days: wholeBody([MON, WED, FRI], 2, 12, 60) },
      { fromWeek: 3, name: 'Habit', note: 'Three sets of twelve on the same days.', days: wholeBody([MON, WED, FRI], 3, 12, 60) },
    ],
  },
}

export const CHALLENGE_LIST: Challenge[] = CHALLENGE_IDS.map((id) => CHALLENGES[id])

/** Which phase (its index) week `week` (from 1) falls in. */
export function phaseAt(challenge: Challenge, week: number): number {
  let index = 0
  challenge.phases.forEach((p, i) => {
    if (week >= p.fromWeek) index = i
  })
  return index
}

/** Training days a week in a phase. */
export const daysPerWeek = (phase: ChallengePhase) => phase.days.length

/** Total training days over the whole challenge. */
export function plannedDays(challenge: Challenge): number {
  let n = 0
  for (let week = 1; week <= challenge.weeks; week++) n += challenge.phases[phaseAt(challenge, week)]!.days.length
  return n
}

/** A phase week's effective sets for every muscle group, counted as the growth model counts them. */
export function weeklySets(phase: ChallengePhase): Record<MuscleId, number> {
  const sets = Object.fromEntries(MUSCLE_IDS.map((m) => [m, 0])) as Record<MuscleId, number>
  for (const d of phase.days) {
    for (const it of d.items) {
      const full = (it.sets * Math.min(GROWTH.fullSetReps, it.reps)) / GROWTH.fullSetReps
      const { primary, secondary } = EXERCISES[it.exercise].muscles
      for (const m of primary) sets[m] += GROWTH.primary * full
      for (const m of secondary) sets[m] += GROWTH.secondary * full
    }
  }
  return sets
}

/**
 * The body at the finish if every planned day is trained: each group grown week by week from
 * `start` (today's levels, or untrained) with the phase's sets, the growth model's own way, from
 * `fromWeek` (a run already under way) to the last. Weights are left out, so it errs low for a
 * member who lifts heavy.
 */
export function projectChallenge(challenge: Challenge, start: Partial<Record<MuscleId, number>> = {}, fromWeek = 1): { levels: Record<MuscleId, number>; overall: number } {
  const levels = Object.fromEntries(MUSCLE_IDS.map((m) => [m, start[m] ?? 0])) as Record<MuscleId, number>
  const perPhase = challenge.phases.map(weeklySets)
  for (let week = Math.max(1, fromWeek); week <= challenge.weeks; week++) {
    const sets = perPhase[phaseAt(challenge, week)]!
    for (const m of MUSCLE_IDS) levels[m] = growWeek(levels[m], sets[m])
  }
  const size = MUSCLE_IDS.reduce((n, m) => n + MUSCLE_SIZE[m], 0)
  return { levels, overall: MUSCLE_IDS.reduce((n, m) => n + levels[m] * MUSCLE_SIZE[m], 0) / size }
}

// ---- a member's run at a challenge ----

export const CHALLENGE_STATUSES = ['active', 'done', 'left'] as const
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number]

/** A profile's run at a challenge (GET/POST /api/profiles/:id/challenge). */
export interface ChallengeRunDto {
  id: string
  profileId: string
  challengeId: ChallengeId
  /** When it started, ms since the epoch: the start of the member's day. */
  startedAt: number
  status: ChallengeStatus
  /** The phase whose week is in force (its index). */
  phase: number
  /** When it finished or was left. */
  endedAt?: number
}

export const StartChallengeSchema = z.object({
  challengeId: ChallengeIdSchema,
  /** The browser's getTimezoneOffset(), so the challenge starts at the member's midnight. */
  tzOffsetMinutes: z.number().int().min(-840).max(840).optional(),
})
export type StartChallengeInput = z.infer<typeof StartChallengeSchema>

const DAY = 86_400_000

/** The week of the challenge `t` falls in, counted from 1 (past the end, the last). */
export function challengeWeek(run: Pick<ChallengeRunDto, 'startedAt'>, challenge: Challenge, t: number): number {
  return Math.min(challenge.weeks, Math.max(1, Math.floor((t - run.startedAt) / (7 * DAY)) + 1))
}

/** When the challenge ends: its last day's end. */
export const challengeEnds = (run: Pick<ChallengeRunDto, 'startedAt'>, challenge: Challenge) => run.startedAt + challenge.weeks * 7 * DAY

export interface ChallengeProgress {
  /** The week it is now, from 1. */
  week: number
  weeks: number
  phase: number
  /** Training days from the start through today, and how many of them had a session. */
  plannedSoFar: number
  doneSoFar: number
  /** Training days in the whole challenge. */
  plannedTotal: number
  /** The share of the days so far that were trained (1 before the first training day). */
  adherence: number
  /** Days left until the finish (0 once it is over). */
  daysLeft: number
  finished: boolean
}

/**
 * How far into a challenge a member is, from the sessions they recorded: day by day on their own
 * calendar (`tzOffsetMinutes`, as getTimezoneOffset gives it), a training day counts as done when
 * any session was recorded that day. Today counts once it has a session; until then it is still
 * ahead.
 */
export function challengeProgress(
  run: Pick<ChallengeRunDto, 'startedAt'>,
  challenge: Challenge,
  sessionStarts: readonly number[],
  now: number,
  tzOffsetMinutes = 0,
): ChallengeProgress {
  const offset = tzOffsetMinutes * 60_000
  const localDay = (t: number) => Math.floor((t - offset) / DAY)
  // The run started at a local midnight, under the offset of its day: rounded, not floored, so
  // after the clocks change (or a trip a few hours west) it is still that day, not the one before.
  const first = Math.round((run.startedAt - offset) / DAY)
  const today = localDay(now)
  const last = first + challenge.weeks * 7 - 1
  const trained = new Set(sessionStarts.filter((t) => t >= run.startedAt).map(localDay))
  let plannedSoFar = 0
  let doneSoFar = 0
  for (let d = first; d <= Math.min(today, last); d++) {
    const week = Math.floor((d - first) / 7) + 1
    // The weekday of local day d (day 0 of the epoch was a Thursday).
    const weekday = (d + 4) % 7
    const planned = challenge.phases[phaseAt(challenge, week)]!.days.some((x) => x.weekday === weekday)
    if (!planned) continue
    const done = trained.has(d)
    if (d === today && !done) continue
    plannedSoFar++
    if (done) doneSoFar++
  }
  const week = Math.min(challenge.weeks, Math.floor((Math.min(today, last) - first) / 7) + 1)
  return {
    week,
    weeks: challenge.weeks,
    phase: phaseAt(challenge, week),
    plannedSoFar,
    doneSoFar,
    plannedTotal: plannedDays(challenge),
    adherence: plannedSoFar ? doneSoFar / plannedSoFar : 1,
    daysLeft: Math.max(0, last - today),
    finished: today > last,
  }
}
