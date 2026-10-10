import type { SessionDto } from '@arc/dependencies'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { DayLog } from './DayLog'
import type { DayKey } from './days'

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime()

function session(id: string, startedAt: number, best: number, exercise: SessionDto['exercise'] = 'elbow_flexion'): SessionDto {
  return {
    id,
    profileId: 'p1',
    exercise,
    side: 'right',
    startedAt,
    endedAt: startedAt + 240_000,
    plan: { sets: 3, reps: 8, restSeconds: 45, targetDeg: exercise === 'elbow_flexion' ? 140 : 160 },
    sets: [],
    summary: { totalReps: 24, bestPeakDeg: best, meanPeakDeg: best - 4, fatigueIndex: 0.06 },
    demo: false,
  } as unknown as SessionDto
}

const SESSIONS = [
  session('a', at(9, 1), 100),
  session('b', at(10, 6, 8), 127),
  session('c', at(10, 9, 7), 132),
  session('d', at(10, 9, 18), 150, 'shoulder_abduction'),
]

function Harness({ start, onChange = () => {} }: { start: DayKey; onChange?: (d: DayKey) => void }) {
  const [day, setDay] = useState(start)
  return (
    <MemoryRouter>
      <DayLog
        sessions={SESSIONS}
        day={day}
        today="2026-10-10"
        onDayChange={(d) => {
          onChange(d)
          setDay(d)
        }}
      />
    </MemoryRouter>
  )
}

describe('DayLog', () => {
  it("lists the day's workouts with progress against the previous session and the goal", () => {
    render(<Harness start="2026-10-09" />)
    expect(screen.getByRole('heading', { level: 3, name: /October 9/ })).toBeInTheDocument()
    const elbow = screen.getByRole('article', { name: /Elbow flexion/ })
    expect(within(elbow).getByText('132°')).toBeInTheDocument()
    expect(within(elbow).getByText(/\+5° vs Oct 6/)).toBeInTheDocument()
    expect(within(elbow).getByText(/\+32° since Sep 1/)).toBeInTheDocument()
    expect(within(elbow).getByText(/8° to the 140° goal/)).toBeInTheDocument()
    expect(within(elbow).getByRole('link', { name: /open session/i })).toHaveAttribute('href', '/sessions/c')
    expect(screen.getByRole('article', { name: /Shoulder abduction/ })).toBeInTheDocument()
    expect(screen.getByText(/first shoulder abduction session/i)).toBeInTheDocument()
  })

  it('steps a day at a time and stops at today', () => {
    const onChange = vi.fn()
    render(<Harness start="2026-10-09" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(onChange).toHaveBeenLastCalledWith('2026-10-10')
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(onChange).toHaveBeenLastCalledWith('2026-10-08')
  })

  it('calls a day without workouts a rest day and offers the last workout before it', () => {
    render(<Harness start="2026-10-08" />)
    expect(screen.getByText('Rest day')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /last workout.*Oct 6/i }))
    expect(screen.getByRole('heading', { level: 3, name: /October 6/ })).toBeInTheDocument()
  })

  it('shows the week with the days that have workouts, and selects a day from it', () => {
    render(<Harness start="2026-10-09" />)
    const week = screen.getByRole('group', { name: /week of/i })
    const days = within(week).getAllByRole('button')
    expect(days).toHaveLength(7)
    expect(within(week).getByRole('button', { name: /October 9.*2 workouts/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(week).getByRole('button', { name: /October 11/ })).toBeDisabled()
    fireEvent.click(within(week).getByRole('button', { name: /October 6.*1 workout/ }))
    expect(screen.getByRole('heading', { level: 3, name: /October 6/ })).toBeInTheDocument()
  })
})
