import { describe, expect, it } from 'vitest'
import { CHALLENGE_IDS, CHALLENGE_LIST, CHALLENGES, challengeProgress, challengeWeek, phaseAt, plannedDays, projectChallenge, weeklySets } from './challenges.ts'
import { MUSCLE_IDS } from './engine/types.ts'
import { ProgramEditSchema } from './program.ts'

const DAY = 86_400_000
/** Monday 5 October 2026, 00:00 UTC. */
const MONDAY = Date.UTC(2026, 9, 5)

describe('the challenges', () => {
  it('offers eight, each a fixed length with phases from week 1 that never go past the end', () => {
    expect(CHALLENGE_LIST.map((c) => c.id)).toEqual([...CHALLENGE_IDS])
    expect(CHALLENGES.summer_body.weeks).toBe(12)
    expect(CHALLENGES.year_transformation.weeks).toBe(52)
    for (const c of CHALLENGE_LIST) {
      expect(c.phases[0]!.fromWeek, c.id).toBe(1)
      c.phases.forEach((p, i) => {
        if (i) expect(p.fromWeek, `${c.id} ${p.name}`).toBeGreaterThan(c.phases[i - 1]!.fromWeek)
        expect(p.fromWeek, `${c.id} ${p.name}`).toBeLessThanOrEqual(c.weeks)
      })
    }
  })

  it('gives every phase a week a member could have arranged themselves: valid days, goals in range', () => {
    for (const c of CHALLENGE_LIST) {
      for (const p of c.phases) {
        const parsed = ProgramEditSchema.safeParse({ days: p.days })
        expect(parsed.success, `${c.id} ${p.name}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`).toBe(true)
      }
    }
  })

  it('trains every muscle group it promises, in every phase', () => {
    for (const c of CHALLENGE_LIST) {
      for (const p of c.phases) {
        const sets = weeklySets(p)
        for (const m of c.focus) expect(sets[m], `${c.id} ${p.name} ${m}`).toBeGreaterThan(0)
      }
    }
  })

  it('steps through its phases by week', () => {
    const c = CHALLENGES.summer_body
    expect([1, 4, 5, 8, 9, 12].map((w) => phaseAt(c, w))).toEqual([0, 0, 1, 1, 2, 2])
    expect(phaseAt(CHALLENGES.year_transformation, 30)).toBe(2)
    // Four days a week for twelve weeks.
    expect(plannedDays(c)).toBe(48)
  })
})

describe('the body at the finish', () => {
  it('grows the focus groups most, from an untrained start', () => {
    const { levels } = projectChallenge(CHALLENGES.strong_arms)
    expect(levels.biceps).toBeGreaterThan(0.2)
    expect(levels.triceps).toBeGreaterThan(levels.quads)
    expect(levels.quads).toBe(0)
    const legs = projectChallenge(CHALLENGES.legs_glutes).levels
    expect(legs.quads).toBeGreaterThan(legs.chest)
  })

  it('goes further the longer the challenge, and builds on what the member already has', () => {
    const year = projectChallenge(CHALLENGES.year_transformation)
    const month = projectChallenge(CHALLENGES.first_month)
    expect(year.overall).toBeGreaterThan(month.overall)
    expect(year.overall).toBeGreaterThan(0.6)
    expect(year.overall).toBeLessThan(1)
    const start = Object.fromEntries(MUSCLE_IDS.map((m) => [m, 0.3]))
    const fromTrained = projectChallenge(CHALLENGES.summer_body, start)
    const fromScratch = projectChallenge(CHALLENGES.summer_body)
    for (const m of MUSCLE_IDS) expect(fromTrained.levels[m], m).toBeGreaterThanOrEqual(0.3)
    expect(fromTrained.levels.chest).toBeGreaterThan(fromScratch.levels.chest)
  })

  it('projects only the weeks left of a run already under way', () => {
    const whole = projectChallenge(CHALLENGES.summer_body)
    const lastMonth = projectChallenge(CHALLENGES.summer_body, {}, 9)
    expect(lastMonth.overall).toBeGreaterThan(0)
    expect(lastMonth.overall).toBeLessThan(whole.overall)
    expect(projectChallenge(CHALLENGES.summer_body, { chest: 0.5 }, 13).levels.chest).toBe(0.5)
  })
})

describe('a run at a challenge', () => {
  const run = { startedAt: MONDAY }
  const c = CHALLENGES.summer_body // Monday, Wednesday, Friday and Saturday

  it('counts the training days so far and the ones trained, today only once it is trained', () => {
    // Wednesday of week 1: Monday trained, Wednesday not yet.
    const wednesday = MONDAY + 2 * DAY + 10 * 3_600_000
    const p = challengeProgress(run, c, [MONDAY + 18 * 3_600_000], wednesday)
    expect(p).toMatchObject({ week: 1, phase: 0, plannedSoFar: 1, doneSoFar: 1, adherence: 1, finished: false })
    const later = challengeProgress(run, c, [MONDAY + 18 * 3_600_000, wednesday - 3_600_000], wednesday)
    expect(later).toMatchObject({ plannedSoFar: 2, doneSoFar: 2 })
    // Saturday: Friday was missed.
    const saturday = challengeProgress(run, c, [MONDAY + 18 * 3_600_000, wednesday - 3_600_000], MONDAY + 5 * DAY + 9 * 3_600_000)
    expect(saturday).toMatchObject({ plannedSoFar: 3, doneSoFar: 2 })
    expect(saturday.adherence).toBeCloseTo(2 / 3, 9)
    expect(saturday.plannedTotal).toBe(48)
  })

  it('reads the days on the member\'s own calendar', () => {
    // 11 pm Monday in New York is already Tuesday in UTC: still Monday's session there.
    const nyMonday = MONDAY + 4 * 3_600_000 // midnight in New York (UTC−4)
    const late = nyMonday + 23 * 3_600_000
    const p = challengeProgress({ startedAt: nyMonday }, c, [late], nyMonday + 2 * DAY + 3_600_000, 240)
    expect(p).toMatchObject({ plannedSoFar: 1, doneSoFar: 1 })
  })

  it('keeps the start on its own day after the clocks go back', () => {
    // Started at midnight in New York in summer (UTC−4); read in winter (UTC−5), an hour further west.
    const nyMonday = MONDAY + 4 * 3_600_000
    const p = challengeProgress({ startedAt: nyMonday }, c, [nyMonday + 18 * 3_600_000], nyMonday + 2 * DAY + 3_600_000, 300)
    // Monday is still the first day (planned and trained), not the Sunday before it.
    expect(p).toMatchObject({ week: 1, plannedSoFar: 1, doneSoFar: 1, adherence: 1 })
    expect(challengeProgress({ startedAt: nyMonday }, c, [], nyMonday + 2 * 3_600_000, 300).daysLeft).toBe(83)
  })

  it('moves through the weeks and phases and finishes after its last day', () => {
    expect(challengeWeek(run, c, MONDAY + 30 * DAY)).toBe(5)
    expect(challengeProgress(run, c, [], MONDAY + 30 * DAY).phase).toBe(1)
    const end = challengeProgress(run, c, [], MONDAY + 12 * 7 * DAY + DAY)
    expect(end).toMatchObject({ week: 12, finished: true, daysLeft: 0 })
    expect(challengeProgress(run, c, [], MONDAY).daysLeft).toBe(83)
  })

  it('ignores sessions from before the challenge began', () => {
    const p = challengeProgress(run, c, [MONDAY - DAY], MONDAY + DAY)
    expect(p.doneSoFar).toBe(0)
  })
})
