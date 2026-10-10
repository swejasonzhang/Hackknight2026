import { describe, expect, it } from 'vitest'
import { CoachIntakeSchema, PlanInputSchema } from './api.ts'
import { EXERCISES } from './engine/exercises.ts'
import {
  clampToRanges,
  parseHeightCm,
  parseTrainingGoal,
  parseWeekdays,
  parseWeightKg,
  programDayOn,
  programFromIntake,
  ProgramInputSchema,
  spreadDays,
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
  it('trains on the chosen days, starting each with the focus movement on the chosen side', () => {
    const program = ProgramInputSchema.parse(programFromIntake(intake))
    expect(program.days.map((d) => d.weekday)).toEqual([1, 3, 5])
    for (const day of program.days) {
      expect(day.items[0]).toMatchObject({ exercise: 'elbow_flexion', side: 'right', targetDeg: EXERCISES.elbow_flexion.targetDeg })
      for (const item of day.items) PlanInputSchema.parse(item)
    }
    expect(program.summary).toMatch(/Monday, Wednesday and Friday/)
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

  it('gives someone new one movement a day, and adds variety for everyone else', () => {
    expect(programFromIntake({ ...intake, experience: 'new' }).days.every((d) => d.items.length === 1)).toBe(true)
    const varied = programFromIntake({ ...intake, experience: 'regular' })
    expect(new Set(varied.days.flatMap((d) => d.items.map((i) => i.exercise))).size).toBeGreaterThan(1)
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
