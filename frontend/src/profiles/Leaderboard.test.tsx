import { leaderboard, type LeaderboardWindow } from '@arc/dependencies'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 10, 12)
const session = (profileId: string, reps: number, sets: number, fatigue: number, loadKg?: number, daysAgo = 1) => ({
  profileId,
  startedAt: NOW - daysAgo * DAY,
  sets: Array.from({ length: sets }, () => ({ reps: Array.from({ length: Math.round(reps / sets) }) })) as never,
  summary: { totalReps: reps, bestPeakDeg: 120, meanPeakDeg: 110, fatigueIndex: fatigue },
  demo: false,
  ...(loadKg != null ? { loadKg } : {}),
})
const PROFILES = [
  { id: 'ada', name: 'Ada' },
  { id: 'grace', name: 'Grace' },
  { id: 'alan', name: 'Alan' },
]
// Ada: most reps and weight; Grace: the steadiest; Alan: nothing this week, a lot last month.
const SESSIONS = [session('ada', 60, 6, 0.3, 10), session('grace', 30, 3, 0.02, 10), session('alan', 90, 9, 0.1, 5, 20)]
const fetchBoard = vi.fn((window: LeaderboardWindow) => Promise.resolve(leaderboard(PROFILES, SESSIONS, { window, now: NOW })))
vi.mock('../api/client', () => ({ api: { leaderboard: (w: LeaderboardWindow) => fetchBoard(w) } }))
const { Leaderboard } = await import('./Leaderboard')

const places = () => within(screen.getByRole('list', { name: /^ranked by/i })).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))

describe('Leaderboard', () => {
  beforeEach(() => fetchBoard.mockClear())

  it("ranks the household on the week's Arc score, the profile being viewed marked", async () => {
    render(<Leaderboard selectedId="grace" />)
    await screen.findByRole('list', { name: 'Ranked by arc score' })
    expect(fetchBoard).toHaveBeenCalledWith('week')
    expect(places()).toEqual([expect.stringMatching(/^1st: Ada, \d+ Arc score$/), expect.stringMatching(/^2nd: Grace, \d+ Arc score$/), '3rd: Alan, 0 Arc score'])
    expect(screen.getByText(/Arc score: reps, sets, weight moved, steadiness \(low fatigue\)/)).toBeInTheDocument()
    expect(screen.getByText('Viewing')).toBeInTheDocument()
    expect(screen.getByText('600 kg moved', { exact: false })).toBeInTheDocument()
  })

  it('re-ranks by any one measure: fatigue puts the steadiest first', async () => {
    render(<Leaderboard selectedId="ada" />)
    await screen.findByRole('list', { name: 'Ranked by arc score' })
    fireEvent.click(screen.getByRole('button', { name: 'Fatigue' }))
    expect(places()[0]).toBe('1st: Grace, fatigue 0.02')
    fireEvent.click(screen.getByRole('button', { name: 'Weight' }))
    expect(places()[0]).toBe('1st: Ada, 600 kg')
    // Ada and Grace held the same weight; Ada did twice the reps.
    expect(places()[1]).toBe('2nd: Grace, 300 kg')
  })

  it('looks further back on request', async () => {
    render(<Leaderboard selectedId="ada" />)
    await screen.findByRole('list', { name: 'Ranked by arc score' })
    fireEvent.click(screen.getByRole('button', { name: '30 days' }))
    await screen.findByText(/90 reps/)
    expect(fetchBoard).toHaveBeenLastCalledWith('month')
    fireEvent.click(screen.getByRole('button', { name: 'Reps' }))
    expect(places()[0]).toBe('1st: Alan, 90 reps')
  })
})
