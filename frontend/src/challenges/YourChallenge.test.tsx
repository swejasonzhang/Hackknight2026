import { CHALLENGES, type ChallengeProgress, type ChallengeRunDto } from '@arc/dependencies'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { YourChallenge } from './YourChallenge'

// Summer body from Monday 6 July 2026, in its eleventh week.
const STARTED = new Date(2026, 6, 6).getTime()
const RUN: ChallengeRunDto = { id: 'r1', profileId: 'p1', challengeId: 'summer_body', startedAt: STARTED, status: 'active', phase: 2 }
const progress = (doneSoFar: number, plannedSoFar: number): ChallengeProgress => ({
  week: 11,
  weeks: 12,
  phase: 2,
  plannedSoFar,
  doneSoFar,
  plannedTotal: 48,
  adherence: doneSoFar / plannedSoFar,
  daysLeft: 10,
  finished: false,
})

const renderStrip = (p: ChallengeProgress, counted = true) =>
  render(
    <MemoryRouter>
      <YourChallenge run={RUN} challenge={CHALLENGES.summer_body} progress={p} counted={counted} index="01" onLeave={() => {}} onPickNext={() => {}} now={STARTED + 74 * 86_400_000} />
    </MemoryRouter>,
  )
/** The lamp of the readout showing `text`. */
const lampOf = (text: string) => screen.getByText(text).closest('.readout-row')!.querySelector('.lamp')

describe('YourChallenge', () => {
  it('lights the share of training days by the number it shows: 80% or more is good', () => {
    // 35 of 44 is 79.5%, shown as 80%.
    renderStrip(progress(35, 44))
    expect(lampOf('80%')).toHaveClass('lamp-ok')
  })

  it('warns below 80%', () => {
    renderStrip(progress(7, 9))
    expect(lampOf('78%')).toHaveClass('lamp-warn')
  })

  it('counts no days trained when the sessions could not load', () => {
    renderStrip(progress(0, 40), false)
    expect(screen.getByText('48 in all')).toBeInTheDocument()
    expect(screen.queryByLabelText('Training days done')).toBeNull()
    expect(lampOf('–')).not.toHaveClass('lamp-warn')
    expect(screen.getByText('Sessions could not load')).toBeInTheDocument()
    expect(screen.getByText('Week 11 of 12 · Sharpen')).toBeInTheDocument()
  })
})
