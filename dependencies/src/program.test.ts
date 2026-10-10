import { describe, expect, it } from 'vitest'
import { CoachIntakeSchema, PlanInputSchema, type PlanInput } from './api.ts'
import { EXERCISE_LIST, EXERCISES } from './engine/exercises.ts'
import { EXERCISE_IDS, type ExerciseId, type MuscleId } from './engine/types.ts'
import {
  clampToRanges,
  parseHeightCm,
  parseTrainingGoal,
  parseWeekdays,
  parseWeightKg,
  areaOfDay,
  describeWeek,
  isDiverseWeek,
  MAX_DAY_ITEMS,
  muscleGroupsOf,
  muscleOf,
  prescriptionFor,
  ProgramDaySchema,
  programDayOn,
  programFromIntake,
  ProgramInputSchema,
  spreadDays,
  titleForDay,
  TRAINING_RANGES,
  weekdayList,
} from './program.ts'

const intake = CoachIntakeSchema.parse({
  goals: 'Get my elbow bending again',
  focus: 'elbow_flexion',
  side: 'right',
  limitations: 'none',
  experience: 'some',
  daysPerWeek: 3,
  trainingGoal: 'hypertrophy',
  trainingDays: [1, 3, 5],
})

describe('training ranges (from the ai-coach module)', () => {
  it('keeps the strength, muscle and stamina numbers the team agreed', () => {
    expect(TRAINING_RANGES.strength).toMatchObject({ sets: [2, 4], reps: [2, 6], restSeconds: [120, 300] })
    expect(TRAINING_RANGES.hypertrophy).toMatchObject({ sets: [3, 5], reps: [8, 12], restSeconds: [60, 180] })
    expect(TRAINING_RANGES.endurance).toMatchObject({ sets: [2, 4], reps: [13, 25], restSeconds: [30, 60] })
  })

  it('pulls a prescription back inside its goal range', () => {
    expect(clampToRanges({ sets: 9, reps: 1, restSeconds: 20 }, 'strength')).toEqual({ sets: 4, reps: 2, restSeconds: 120 })
    expect(clampToRanges({ sets: 3, reps: 10, restSeconds: 90 }, 'hypertrophy')).toEqual({ sets: 3, reps: 10, restSeconds: 90 })
  })
})

describe('reading answers', () => {
  it('reads training days by name, as groups, or as a count', () => {
    expect(parseWeekdays('Monday, Wednesday and Friday')).toEqual([1, 3, 5])
    expect(parseWeekdays('tue thu')).toEqual([2, 4])
    expect(parseWeekdays('weekdays')).toEqual([1, 2, 3, 4, 5])
    expect(parseWeekdays('weekends only')).toEqual([0, 6])
    expect(parseWeekdays('every day')).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(parseWeekdays('maybe 4 days')).toEqual(spreadDays(4))
    expect(parseWeekdays('two')).toEqual(spreadDays(2))
    expect(parseWeekdays('not sure')).toEqual([])
  })

  it('spreads a count of days through the week, Monday first', () => {
    expect(spreadDays(1)).toEqual([1])
    expect(spreadDays(2)).toEqual([1, 4])
    expect(spreadDays(3)).toEqual([1, 3, 5])
    expect(spreadDays(5)).toEqual([1, 2, 3, 4, 5])
    expect(spreadDays(7)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('reads strength, muscle or stamina from plain words', () => {
    expect(parseTrainingGoal('I want to get stronger')).toBe('strength')
    expect(parseTrainingGoal('build muscle')).toBe('hypertrophy')
    expect(parseTrainingGoal('more stamina please')).toBe('endurance')
    expect(parseTrainingGoal('no idea')).toBeNull()
  })

  it('reads height in centimetres, metres, or feet and inches, and lets it be skipped', () => {
    expect(parseHeightCm('180 cm')).toBe(180)
    expect(parseHeightCm('1.75 m')).toBe(175)
    expect(parseHeightCm(`5'11"`)).toBe(180)
    expect(parseHeightCm('6 foot')).toBe(183)
    expect(parseHeightCm('5 ft 4 in')).toBe(163)
    expect(parseHeightCm('172')).toBe(172)
    expect(parseHeightCm('skip')).toBeUndefined()
    expect(parseHeightCm('999 cm')).toBeUndefined()
  })

  it('reads weight in kilograms or pounds, and lets it be skipped', () => {
    expect(parseWeightKg('75 kg')).toBe(75)
    expect(parseWeightKg('165 lbs')).toBe(75)
    expect(parseWeightKg('180 pounds')).toBe(82)
    expect(parseWeightKg('70')).toBe(70)
    expect(parseWeightKg('rather not say')).toBeUndefined()
  })
})

describe('programFromIntake', () => {
  it('trains on the chosen days and opens the week with the focus movement on the chosen side', () => {
    const program = ProgramInputSchema.parse(programFromIntake(intake))
    expect(program.days.map((d) => d.weekday)).toEqual([1, 3, 5])
    expect(program.days[0]!.items[0]).toMatchObject({ exercise: 'elbow_flexion', side: 'right', targetDeg: EXERCISES.elbow_flexion.targetDeg })
    for (const item of program.days.flatMap((d) => d.items)) PlanInputSchema.parse(item)
    expect(program.summary).toMatch(/Monday, Wednesday and Friday/)
    expect(program.summary).toMatch(/upper body, legs and back/)
    expect(program.summary).toMatch(/Your right bicep curl opens the week/)
    // A movement with no side to pick names none.
    expect(programFromIntake({ ...intake, focus: 'deadlift' }).summary).toMatch(/The deadlift opens the week/)
  })

  it('works a different body area each day: never the same area two training days running', () => {
    for (const focus of EXERCISE_IDS) {
      for (let count = 1; count <= 7; count++) {
        for (const experience of ['new', 'some', 'regular'] as const) {
          const program = programFromIntake({ ...intake, focus, experience, trainingDays: spreadDays(count), daysPerWeek: count })
          const areas = program.days.map((d) => areaOfDay(d))
          // Each day keeps to one area...
          for (const day of program.days) expect(new Set(day.items.map((i) => EXERCISES[i.exercise].area)).size, `${focus} ${count}`).toBe(1)
          // ...the next training day moves on...
          areas.forEach((a, i) => i > 0 && expect(a, `${focus} ${count} day ${i}`).not.toBe(areas[i - 1]))
          // ...and the week covers as many areas as it has days, up to all four.
          expect(new Set(areas).size, `${focus} ${count}`).toBe(Math.min(count, 4))
          expect(isDiverseWeek(program.days), `${focus} ${count}`).toBe(true)
        }
      }
    }
  })

  it('starts with the focus area and uses its other movements when an area comes round again', () => {
    // Someone new does two of the three leg movements, so the second legs day turns to the third.
    const week = programFromIntake({ ...intake, focus: 'squat', experience: 'new', trainingDays: [0, 1, 2, 3, 4, 5, 6], daysPerWeek: 7 })
    expect(week.days.map((d) => areaOfDay(d))).toEqual(['legs', 'back', 'core', 'upper', 'legs', 'back', 'core'])
    expect(week.days[0]!.items.map((i) => i.exercise)).toEqual(['squat', 'lunge'])
    expect(week.days[4]!.items.map((i) => i.exercise)).toEqual(['seated_knee_extension', 'squat'])
  })

  it('keeps every prescription inside the goal range, and lighter for someone new', () => {
    for (const goal of ['strength', 'hypertrophy', 'endurance'] as const) {
      const range = TRAINING_RANGES[goal]
      for (const experience of ['new', 'some', 'regular'] as const) {
        const program = programFromIntake({ ...intake, trainingGoal: goal, experience })
        for (const item of program.days.flatMap((d) => d.items)) {
          expect(item.sets).toBeGreaterThanOrEqual(range.sets[0])
          expect(item.sets).toBeLessThanOrEqual(range.sets[1])
          expect(item.reps).toBeGreaterThanOrEqual(range.reps[0])
          expect(item.reps).toBeLessThanOrEqual(range.reps[1])
          expect(item.restSeconds).toBeGreaterThanOrEqual(range.restSeconds[0])
          expect(item.restSeconds).toBeLessThanOrEqual(range.restSeconds[1])
        }
      }
    }
    const fresh = programFromIntake({ ...intake, experience: 'new' }).days[0]!.items[0]!
    const seasoned = programFromIntake({ ...intake, experience: 'regular' }).days[0]!.items[0]!
    expect(fresh.sets).toBeLessThanOrEqual(seasoned.sets)
    expect(fresh.restSeconds).toBeGreaterThanOrEqual(seasoned.restSeconds)
  })

  it('spreads the days itself when the member gave only a count', () => {
    const program = programFromIntake({ ...intake, trainingDays: undefined, daysPerWeek: 2 })
    expect(program.days.map((d) => d.weekday)).toEqual([1, 4])
  })

  it('fills each day with several movements for its muscle groups: two for someone new, three for everyone else', () => {
    const fresh = programFromIntake({ ...intake, experience: 'new' })
    for (const day of fresh.days) expect(day.items.length).toBe(Math.min(2, EXERCISE_LIST.filter((e) => e.area === areaOfDay(day)).length))
    const varied = programFromIntake({ ...intake, experience: 'regular' })
    for (const day of varied.days) expect(day.items.length).toBe(Math.min(3, EXERCISE_LIST.filter((e) => e.area === areaOfDay(day)).length))
    // Each movement names the muscle group it is there for.
    for (const item of varied.days.flatMap((d) => d.items)) expect(item.muscle).toBe(EXERCISES[item.exercise].muscles.primary[0])
  })
})

describe('the program on the calendar', () => {
  it('finds the training day for a date by its weekday, and none on a rest day', () => {
    const program = programFromIntake(intake)
    expect(programDayOn(program, new Date(2026, 9, 12))?.weekday).toBe(1) // a Monday
    expect(programDayOn(program, new Date(2026, 9, 13))).toBeUndefined() // a Tuesday
  })

  it('names weekday lists in plain English, Monday first', () => {
    expect(weekdayList([1, 3, 5])).toBe('Monday, Wednesday and Friday')
    expect(weekdayList([0, 6])).toBe('Saturday and Sunday')
    expect(weekdayList([2])).toBe('Tuesday')
  })

  it('refuses a program with the same weekday twice', () => {
    const day = programFromIntake(intake).days[0]!
    expect(ProgramInputSchema.safeParse({ summary: 'x', days: [day, day] }).success).toBe(false)
  })
})

describe('prescriptionFor: what Record runs for the movement picked', () => {
  const program = programFromIntake({ ...intake, focus: 'squat', experience: 'regular', trainingDays: [1, 3, 5] })
  const plan = { exercise: 'squat' as const, side: 'left' as const, sets: 5, reps: 6, restSeconds: 90, targetDeg: 95 }
  const monday = new Date(2026, 9, 12)

  const tuesday = new Date(2026, 9, 13)
  const numbers = ({ exercise, side, sets, reps, restSeconds, targetDeg }: PlanInput) => ({ exercise, side, sets, reps, restSeconds, targetDeg })

  it("uses the day's own prescription when the week holds the movement that day", () => {
    const squat = programDayOn(program, monday)!.items.find((i) => i.exercise === 'squat')!
    expect(prescriptionFor('squat', { plan, program, intake, date: monday })).toEqual({ ...numbers(squat), source: 'week' })
  })

  it('else the saved plan when it is for that movement', () => {
    expect(prescriptionFor('squat', { plan, program, intake, date: tuesday })).toEqual({ ...plan, source: 'plan' })
  })

  it("else the week's first day that holds it", () => {
    const lunge = program.days.flatMap((d) => d.items).find((i) => i.exercise === 'lunge')!
    expect(prescriptionFor('lunge', { plan, program, intake, date: tuesday })).toEqual({ ...numbers(lunge), source: 'week' })
  })

  it("falls back to the goal's ranges on the member's side, with the movement's own goal angle", () => {
    // A legs-first three-day week works legs, back and core: no upper-body day.
    expect(program.days.map(areaOfDay)).toEqual(['legs', 'back', 'core'])
    const p = prescriptionFor('pec_fly', { plan, program, intake: { ...intake, side: 'left', trainingGoal: 'endurance' }, date: monday })
    expect(p).toMatchObject({ exercise: 'pec_fly', side: 'left', targetDeg: 160, source: 'default' })
    expect(p.reps).toBeGreaterThanOrEqual(13)
    expect(prescriptionFor('crunch', { date: monday })).toEqual({ exercise: 'crunch', side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg: 55, source: 'default' })
  })

  it('tells a varied week from one that keeps to one area', () => {
    const day = (weekday: number, exercise: (typeof EXERCISE_IDS)[number]) => ({ weekday, title: 'x', items: [{ exercise, side: 'right' as const, sets: 3, reps: 8, restSeconds: 60, targetDeg: 90 }] })
    expect(isDiverseWeek([day(1, 'squat'), day(3, 'lunge'), day(5, 'deadlift')])).toBe(false) // legs two days running
    expect(isDiverseWeek([day(1, 'squat'), day(3, 'elbow_flexion'), day(5, 'squat')])).toBe(false) // only two areas in three days
    expect(isDiverseWeek([day(1, 'squat'), day(3, 'elbow_flexion'), day(5, 'deadlift')])).toBe(true)
    expect(isDiverseWeek([day(1, 'squat')])).toBe(true)
  })
})

describe('muscle groups through a day', () => {
  const item = (exercise: ExerciseId, muscle?: MuscleId) => ({ exercise, side: 'right' as const, sets: 3, reps: 8, restSeconds: 60, targetDeg: EXERCISES[exercise].targetDeg, ...(muscle ? { muscle } : {}) })

  it("gathers a day's movements under the muscle each works, in the order the day reaches them", () => {
    const day = [item('lat_pulldown'), item('bent_over_row', 'upper_back'), item('deadlift', 'lower_back'), item('bent_over_row')]
    expect(muscleGroupsOf(day).map((g) => [g.muscle, g.items.map((x) => x.index)])).toEqual([
      ['lats', [0, 3]],
      ['upper_back', [1]],
      ['lower_back', [2]],
    ])
    expect(muscleOf(item('deadlift'))).toBe('hamstrings')
  })

  it('titles a day by its area and muscle groups, within sixty characters', () => {
    expect(titleForDay([item('lat_pulldown'), item('bent_over_row', 'upper_back'), item('deadlift', 'lower_back')])).toBe('Back · Lats, Upper back, Lower back')
    expect(titleForDay([item('squat'), item('crunch')])).toBe('Legs + Core · Quads, Abs')
    const long = titleForDay(EXERCISE_IDS.slice(0, 8).map((e) => item(e)))
    expect(long.length).toBeLessThanOrEqual(60)
  })

  it("says what a member's own week holds, day by day", () => {
    const text = describeWeek([
      { weekday: 3, items: [item('squat'), item('lunge')] },
      { weekday: 1, items: [item('lat_pulldown'), item('deadlift', 'lower_back')] },
    ])
    expect(text).toBe('Your own week: 2 days and 4 movements. Monday lats and lower back; Wednesday quads.')
  })

  it('takes up to eight movements a day, each with the muscle it was picked for', () => {
    const day = { weekday: 1, title: 'Back', items: Array.from({ length: MAX_DAY_ITEMS }, () => item('deadlift', 'lower_back')) }
    expect(ProgramDaySchema.safeParse(day).success).toBe(true)
    expect(ProgramDaySchema.safeParse({ ...day, items: [...day.items, item('squat')] }).success).toBe(false)
    expect(ProgramDaySchema.safeParse({ ...day, items: [{ ...item('squat'), muscle: 'neck' }] }).success).toBe(false)
  })
})
