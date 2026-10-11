import { CHALLENGES } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { factsOf, phaseSpan, startQuestion, weeksText } from './facts'

describe('challenge facts', () => {
  it('runs each phase to the week before the next, the last to the finish', () => {
    const year = CHALLENGES.year_transformation
    expect(year.phases.map((_, i) => phaseSpan(year, i))).toEqual([
      { from: 1, to: 8 },
      { from: 9, to: 24 },
      { from: 25, to: 40 },
      { from: 41, to: 52 },
    ])
    expect(weeksText(year, 3)).toBe('Weeks 41–52')
    expect(weeksText({ ...year, weeks: 41 }, 3)).toBe('Week 41')
  })

  it('says how long, how often and for whom', () => {
    expect(factsOf(CHALLENGES.summer_body)).toBe('12 weeks · 4 days a week · Intermediate')
    expect(factsOf(CHALLENGES.core_30)).toBe('4 weeks · 5 days a week · Beginner')
  })

  it('asks before a start replaces a week or leaves a challenge, and only then', () => {
    const { summer_body: summer, strong_arms: arms } = CHALLENGES
    expect(startQuestion(summer, 'Ada', null, false)).toBeNull()
    expect(startQuestion(summer, 'Ada', null, true)).toBe("Start Summer body? Its first phase replaces Ada's current week. Earlier weeks stay in the plan's history.")
    expect(startQuestion(summer, 'Ada', arms, true)).toBe("Start Summer body? Ada leaves Strong arms, and Summer body's first phase replaces the week. Earlier weeks stay in the plan's history.")
  })
})
