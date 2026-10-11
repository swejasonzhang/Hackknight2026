import { MUSCLE_IDS, type BodyDto, type MuscleId } from '@arc/dependencies'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../components/three/lazy', () => ({
  LazyJointScene: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
  SceneBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
const { BodyGrowth } = await import('./BodyGrowth')

const levels = (pick: Partial<Record<MuscleId, number>>) => Object.fromEntries(MUSCLE_IDS.map((m) => [m, pick[m] ?? 0])) as Record<MuscleId, number>
const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 11)

/** A body three weeks into curls and squats: biceps and quads built most, the back never worked. */
function trainedBody(): BodyDto {
  const now = levels({ biceps: 0.4, quads: 0.3, forearms: 0.2, glutes: 0.15, hamstrings: 0.1, calves: 0.05, front_delts: 0.04, lower_back: 0.03 })
  const muscles = Object.fromEntries(
    MUSCLE_IDS.map((m) => [m, { level: now[m], recentSets: now[m] > 0 ? Math.round(now[m] * 40) : 0, totalSets: now[m] > 0 ? Math.round(now[m] * 40) : 0, change: now[m] / 2 }]),
  ) as BodyDto['muscles']
  return {
    profileId: 'p1',
    figure: 'female',
    asOf: NOW,
    overall: 0.12,
    muscles,
    weeks: [
      { from: NOW - 21 * DAY, levels: levels({ biceps: 0.1, quads: 0.12 }) },
      { from: NOW - 14 * DAY, levels: levels({ biceps: 0.25, quads: 0.2 }) },
      { from: NOW - 7 * DAY, levels: now },
    ],
  }
}

function untrainedBody(): BodyDto {
  return {
    profileId: 'p1',
    figure: null,
    asOf: NOW,
    overall: 0,
    muscles: Object.fromEntries(MUSCLE_IDS.map((m) => [m, { level: 0, recentSets: 0, totalSets: 0, change: 0 }])) as BodyDto['muscles'],
    weeks: [],
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('BodyGrowth', () => {
  it('starts skinny: every group at the start, with a movement for the groups not worked yet', () => {
    render(<BodyGrowth name="Ada" body={untrainedBody()} figure={null} onFigure={() => {}} />)
    expect(screen.getByText(/Every muscle group is at the start/)).toBeInTheDocument()
    expect(screen.getByText('Untrained: the start')).toBeInTheDocument()
    expect(screen.getByLabelText(/Ada's figure, neutral.*0% built, untrained/)).toBeInTheDocument()
    expect(screen.getByText('Chest')).toBeInTheDocument()
    expect(screen.getByText(/try chest press/)).toBeInTheDocument()
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('ranks the trained groups, most built first, with their sets in the last four weeks', () => {
    render(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={() => {}} />)
    const list = screen.getByLabelText('Muscle groups, most built first')
    const rows = within(list).getAllByRole('listitem')
    expect(rows.map((r) => r.getAttribute('aria-label')!.split(':')[0])).toEqual(['Biceps', 'Quads', 'Forearms', 'Glutes', 'Hamstrings', 'Calves'])
    expect(rows[0]).toHaveAccessibleName('Biceps: 40% built, 16 sets in the last 4 weeks')
    // Eight trained, six shown, the rest one tap away; the back was never worked.
    fireEvent.click(screen.getByRole('button', { name: 'Show all 8' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByText('Chest')).toBeInTheDocument()
    expect(screen.getByText('and 4 more')).toBeInTheDocument()
    expect(screen.getByLabelText(/Ada's figure, female.*12% built, most in biceps, quads, forearms/)).toBeInTheDocument()
  })

  it('goes back week by week on the slider, the list and the figure with it', () => {
    render(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={() => {}} />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuetext', 'today')
    fireEvent.change(slider, { target: { value: '0' } })
    expect(screen.getByLabelText(/Week 1 of 3 · from/)).toBe(slider)
    const rows = within(screen.getByLabelText('Muscle groups, most built first')).getAllByRole('listitem')
    expect(rows[0]).toHaveAccessibleName(/^Quads: 12% built/)
    expect(screen.getByLabelText(/as at week 1/)).toBeInTheDocument()
  })

  it('plays the weeks forward to today', () => {
    vi.useFakeTimers()
    render(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Watch it grow' }))
    expect(screen.getByRole('slider')).toHaveValue('0')
    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(screen.getByRole('slider')).toHaveValue('1')
    act(() => {
      vi.advanceTimersByTime(1400)
    })
    expect(screen.getByRole('slider')).toHaveValue('2')
    expect(screen.getByRole('button', { name: 'Watch it grow' })).toBeInTheDocument()
  })

  it('changes the figure: female, male, or between the two', () => {
    const onFigure = vi.fn()
    render(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={onFigure} />)
    const group = screen.getByRole('group', { name: 'Figure' })
    expect(within(group).getByRole('button', { name: 'Female' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(group).getByRole('button', { name: 'Female' }))
    expect(onFigure).not.toHaveBeenCalled()
    fireEvent.click(within(group).getByRole('button', { name: 'Male' }))
    expect(onFigure).toHaveBeenLastCalledWith('male')
    fireEvent.click(within(group).getByRole('button', { name: 'Either' }))
    expect(onFigure).toHaveBeenLastCalledWith(null)
  })
})
