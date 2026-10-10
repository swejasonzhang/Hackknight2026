import { programFromIntake, type ProgramDto, type SessionDto } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { checklistFor, nextEntry, plannedDay } from './checklist'

const at = (d: number, h = 12) => new Date(2026, 9, d, h).getTime()
const session = (id: string, exercise: SessionDto['exercise'], startedAt: number) => ({ id, exercise, startedAt }) as unknown as SessionDto
const week = programFromIntake({ goals: 'Strong back', focus: 'lat_pulldown', side: 'right', limitations: 'none', experience: 'regular', daysPerWeek: 3, trainingGoal: 'hypertrophy', trainingDays: [1, 3, 5] })
// Built on Thursday 8 October; Monday the 12th is a back day.
const PROGRAM = { ...week, createdAt: at(8, 9) } as ProgramDto

describe("a day's checklist", () => {
  it('crosses out a movement once a session of it is recorded that day, one session per movement', () => {
    const day = { items: [week.days[0]!.items[0]!, week.days[0]!.items[1]!, week.days[0]!.items[0]!] }
    const list = checklistFor(day, [session('a', day.items[0]!.exercise, at(12, 9))])
    expect(list.map((e) => e.done)).toEqual([true, false, false])
    expect(list[0]!.session?.id).toBe('a')
    expect(nextEntry(list)?.index).toBe(1)
    // The same movement planned twice needs two sessions.
    const both = checklistFor(day, [session('a', day.items[0]!.exercise, at(12, 9)), session('b', day.items[0]!.exercise, at(12, 10))])
    expect(both.map((e) => e.done)).toEqual([true, false, true])
  })

  it("finds the week's plan for a day, with that day's sessions only", () => {
    const monday = plannedDay(PROGRAM, [session('a', 'lat_pulldown', at(12, 9)), session('old', 'lat_pulldown', at(5, 9))], '2026-10-12')!
    expect(monday.day.weekday).toBe(1)
    expect(monday.list.map((e) => e.item.exercise)).toEqual(['lat_pulldown', 'bent_over_row', 'deadlift'])
    expect(monday.list.map((e) => e.done)).toEqual([true, false, false])
  })

  it('has nothing for a rest day, or for a day before this week was set', () => {
    expect(plannedDay(PROGRAM, [], '2026-10-13')).toBeNull() // a Tuesday
    expect(plannedDay(PROGRAM, [], '2026-10-05')).toBeNull() // a Monday before the 8th
    expect(plannedDay(null, [], '2026-10-12')).toBeNull()
  })
})
