import { EXERCISES, programFromIntake, sideLabel, type ProgramDto, type SessionDto } from '@arc/dependencies'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '../api/client'

const program = vi.fn()
const sessions = vi.fn()
vi.mock('../api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('../api/client')>()
  return { ...real, api: { plan: { program: (id: string) => program(id) }, sessions: { list: (id: string) => sessions(id) } } }
})
const { PlanCalendar } = await import('./PlanCalendar')

// Wednesday 14 October 2026, midday local time.
const NOW = new Date(2026, 9, 14, 12).getTime()
const week = programFromIntake({ goals: 'Bend my elbow', focus: 'elbow_flexion', side: 'right', limitations: 'none', experience: 'some', daysPerWeek: 3, trainingGoal: 'hypertrophy', trainingDays: [1, 3, 5] })
const PROGRAM: ProgramDto = { ...week, id: 'w1', profileId: 'p1', active: true, source: 'gemini', createdAt: new Date(2026, 9, 1).getTime() }
const session = (day: number, best: number): SessionDto =>
  ({
    id: `s${day}`,
    profileId: 'p1',
    exercise: 'elbow_flexion',
    side: 'right',
    startedAt: new Date(2026, 9, day, 18).getTime(),
    endedAt: new Date(2026, 9, day, 18, 20).getTime(),
    plan: { sets: 3, reps: 10, restSeconds: 120, targetDeg: 140 },
    sets: [],
    summary: { bestPeakDeg: best, meanPeakDeg: best - 5, totalReps: 30, fatigueIndex: 0.1 },
    source: 'browser',
    createdAt: 0,
  }) as unknown as SessionDto

const renderCalendar = () =>
  render(
    <MemoryRouter>
      <PlanCalendar profileId="p1" now={NOW} />
    </MemoryRouter>,
  )
const day = (name: RegExp) => screen.getByRole('button', { name })

describe('PlanCalendar', () => {
  beforeEach(() => {
    program.mockReset().mockResolvedValue(PROGRAM)
    // Monday 12th done; Friday 9th missed; Monday 5th done.
    sessions.mockReset().mockResolvedValue([session(12, 128), session(5, 120)])
  })

  it("shows the month with Arc's training days, what was done, and what was missed", async () => {
    renderCalendar()
    expect(await screen.findByRole('grid', { name: 'October 2026' })).toBeInTheDocument()
    expect(screen.getByText(PROGRAM.summary)).toBeInTheDocument()
    expect(day(/^Monday 12 October.*training day.*done/i)).toBeInTheDocument()
    expect(day(/^Friday 9 October.*training day.*not recorded/i)).toBeInTheDocument()
    expect(day(/^Tuesday 13 October.*rest day/i)).toBeInTheDocument()
    expect(day(/^Friday 16 October.*training day.*planned/i)).toBeInTheDocument()
    // Before the week was built, a Wednesday is not a training day.
    expect(day(/^Wednesday 30 September.*rest day/i)).toBeInTheDocument()
    expect(screen.getByText('1 of 3 done this week')).toBeInTheDocument()
  })

  it("opens on today, with today's workout and the way to record it", async () => {
    renderCalendar()
    const today = await screen.findByRole('button', { name: /^Wednesday 14 October, today/i })
    expect(today.closest('[role="gridcell"]')).toHaveAttribute('aria-selected', 'true')
    const details = screen.getByRole('region', { name: /selected day/i })
    const [first, second] = week.days[1]!.items
    // Wednesday is a legs day: the week works a different area each training day, several movements a day.
    expect(EXERCISES[first!.exercise].area).toBe('legs')
    const list = within(details).getByRole('group', { name: /workout for wednesday 14 october/i })
    expect(list).toHaveTextContent(`0 of ${week.days[1]!.items.length} done`)
    expect(list).toHaveTextContent(`${EXERCISES[first!.exercise].name}${sideLabel(first!.exercise, 'right')} · ${first!.sets} × ${first!.reps} · goal ${first!.targetDeg}°`)
    expect(within(list).getByRole('region', { name: 'Quads' })).toBeInTheDocument()
    // The way on: the first movement next, any of them on its own.
    expect(within(details).getByRole('link', { name: `Next: ${EXERCISES[first!.exercise].name}` })).toHaveAttribute('href', `/record?exercise=${first!.exercise}`)
    expect(within(details).getByRole('link', { name: `Record ${EXERCISES[second!.exercise].name.toLowerCase()}` })).toHaveAttribute('href', `/record?exercise=${second!.exercise}`)
    expect(within(details).getByRole('link', { name: /open in the log/i })).toHaveAttribute('href', '/plan?day=2026-10-14')
  })

  it("shows a past day's session, and a rest day as rest", async () => {
    renderCalendar()
    fireEvent.click(await screen.findByRole('button', { name: /^Monday 12 October/i }))
    const details = screen.getByRole('region', { name: /selected day/i })
    // The curl was done: crossed out, its session a tap away; the rest of the day was not recorded.
    expect(within(details).getByText('Bicep curl')).toHaveClass('line-through')
    expect(within(details).getByRole('link', { name: 'Open →' })).toHaveAttribute('href', '/sessions/s12')
    expect(within(details).getAllByText('Not recorded').length).toBe(week.days[0]!.items.length - 1)
    expect(within(details).queryByRole('link', { name: /^next:/i })).not.toBeInTheDocument()
    fireEvent.click(day(/^Tuesday 13 October/i))
    expect(within(screen.getByRole('region', { name: /selected day/i })).getByText(/^A rest day/)).toBeInTheDocument()
  })

  it('steps through months and moves the selection with the arrow keys', async () => {
    renderCalendar()
    const today = await screen.findByRole('button', { name: /^Wednesday 14 October, today/i })
    fireEvent.keyDown(today, { key: 'ArrowRight' })
    expect(day(/^Thursday 15 October/i).closest('[role="gridcell"]')).toHaveAttribute('aria-selected', 'true')
    expect(day(/^Thursday 15 October/i)).toHaveFocus()
    fireEvent.keyDown(day(/^Thursday 15 October/i), { key: 'ArrowDown' })
    expect(day(/^Thursday 22 October/i)).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^today$/i }))
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument()
  })

  it('marks the days that hold the movement picked on the dashboard', async () => {
    render(
      <MemoryRouter>
        <PlanCalendar profileId="p1" now={NOW} exercise="tricep_extension" />
      </MemoryRouter>,
    )
    await screen.findByRole('grid')
    const withTriceps = week.days.filter((d) => d.items.some((i) => i.exercise === 'tricep_extension')).map((d) => d.weekday)
    expect(withTriceps).toEqual([1]) // Monday, the upper-body day
    const holds = screen.getAllByRole('button', { name: /includes tricep extension/i })
    expect(holds.length).toBeGreaterThan(0)
    for (const b of holds) expect(b).toHaveAttribute('data-holds', 'true')
    expect(screen.getByText(/days with tricep extension/i)).toBeInTheDocument()
  })

  it('invites the member to plan a week with Arc when there is none', async () => {
    program.mockRejectedValue(new ApiRequestError(404, 'No program yet'))
    renderCalendar()
    expect(await screen.findByRole('link', { name: /plan my week with arc/i })).toHaveAttribute('href', '/welcome?profile=p1')
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })
})
