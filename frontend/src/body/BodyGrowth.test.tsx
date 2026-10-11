import { MUSCLE_IDS, type BodyDto, type MuscleId } from '@arc/dependencies'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JointSceneProps } from '../components/three/JointScene'

// The scene records what it is asked to draw; reduced motion can be switched on per test.
const seen = vi.hoisted(() => ({ scenes: [] as unknown[], reduce: false }))
vi.mock('../components/three/lazy', () => ({
  LazyJointScene: (props: { label: string }) => {
    seen.scenes.push(props)
    return <div role="img" aria-label={props.label} />
  },
  SceneBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('motion/react', async (original) => ({ ...(await original<typeof import('motion/react')>()), useReducedMotion: () => seen.reduce }))
const { BodyGrowth } = await import('./BodyGrowth')
/** What the figure was last drawn with. */
const scene = () => seen.scenes.at(-1) as JointSceneProps

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
  seen.scenes = []
  seen.reduce = false
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
    expect(rows[0]).toHaveAccessibleName('Biceps: 40% built, 16 sets in 4 weeks · up 20')
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
    // A past week's level alone: today's sets and change belong to today.
    expect(rows[0]).toHaveAccessibleName('Quads: 12% built')
    expect(screen.getByLabelText(/as at week 1/)).toBeInTheDocument()
    // The figure itself is drawn as at that week.
    expect(scene().growth!.levels.quads).toBe(0.12)
    expect(scene().growth!.levels.biceps).toBe(0.1)
  })

  it('dates each week by the day it starts, wherever the viewer is', () => {
    // A viewer west of Greenwich, where midnight UTC is still the evening before.
    vi.stubEnv('TZ', 'America/Los_Angeles')
    try {
      render(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={() => {}} />)
      fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } })
      // Week 1 starts on 20 Sep 2026 at 00:00 UTC: never labelled with the day before.
      expect(screen.getByText(/Week 1 of 3 · from/).textContent).toMatch(/\b20\b/)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('draws the body it is given: the figure, its growth, and the growth map on request', () => {
    const { rerender } = render(<BodyGrowth name="Ada" body={trainedBody()} figure={null} onFigure={() => {}} />)
    expect(scene().figure).toBe('neutral')
    expect(scene().growth!.levels.biceps).toBe(0.4)
    expect(scene().growthShade).toBe(false)
    fireEvent.click(screen.getByRole('tab', { name: 'Growth map' }))
    expect(scene().growthShade).toBe(true)
    rerender(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={() => {}} />)
    expect(scene().figure).toBe('female')
  })

  it('shows a new body at today from its first frame, even one with fewer weeks', () => {
    const { rerender } = render(<BodyGrowth name="Ada" body={null} figure="female" onFigure={() => {}} />)
    rerender(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={() => {}} />)
    // Never a frame at week 1 first: the figure arrives as today's.
    expect(seen.scenes.filter((p) => (p as JointSceneProps).growth).every((p) => (p as JointSceneProps).growth!.levels.biceps === 0.4)).toBe(true)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'today')
    const shorter = { ...trainedBody(), weeks: trainedBody().weeks.slice(1) }
    rerender(<BodyGrowth name="Ben" body={shorter} figure="female" onFigure={() => {}} />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'today')
    expect(screen.getByRole('slider')).toHaveAttribute('max', '1')
  })

  it('says when the body could not load, offers to try again, and never draws the untrained start in its place', () => {
    const onRetry = vi.fn()
    render(<BodyGrowth name="Ada" body={null} error="Network error" onRetry={onRetry} figure="female" onFigure={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent("Could not load Ada's body (Network error)")
    expect(screen.queryByText(/Loading Ada's body/)).toBeNull()
    expect(seen.scenes).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('says a group is not worked lately only when it had no sets in the last four weeks', () => {
    const body = trainedBody()
    body.muscles.quads = { ...body.muscles.quads, change: -0.05, recentSets: 3 }
    body.muscles.forearms = { ...body.muscles.forearms, change: -0.04, recentSets: 0 }
    render(<BodyGrowth name="Ada" body={body} figure="female" onFigure={() => {}} />)
    expect(screen.getByLabelText('Quads: 30% built, 3 sets in 4 weeks · down 5')).toBeInTheDocument()
    expect(screen.getByLabelText('Forearms: 20% built, 0 sets in 4 weeks · down 4, not worked lately')).toBeInTheDocument()
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

  it('pauses, and stops playing when the slider is moved', () => {
    vi.useFakeTimers()
    render(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Watch it grow' }))
    act(() => {
      vi.advanceTimersByTime(700)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('slider')).toHaveValue('1')
    expect(screen.getByRole('button', { name: 'Watch it grow' })).toBeInTheDocument()
    // Playing again from the start, then taking the slider back a week: it stays where it was put.
    fireEvent.click(screen.getByRole('button', { name: 'Watch it grow' }))
    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(screen.getByRole('slider')).toHaveValue('1')
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('slider')).toHaveValue('0')
  })

  it('jumps straight to today, and to the end build, under reduced motion', () => {
    seen.reduce = true
    vi.useFakeTimers()
    render(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={() => {}} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Watch it grow' }))
    expect(screen.getByRole('slider')).toHaveValue('2')
    fireEvent.click(screen.getByRole('button', { name: 'Play transformation' }))
    expect(screen.getByLabelText(/mock transformation toward a random .* build: week 52 of 52/)).toBeInTheDocument()
  })

  it('changes the figure: female, male, or between the two', () => {
    const onFigure = vi.fn()
    render(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={onFigure} />)
    const group = screen.getByRole('group', { name: "Ada's figure" })
    expect(within(group).getByRole('button', { name: 'Female' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(group).getByRole('button', { name: 'Female' }))
    expect(onFigure).not.toHaveBeenCalled()
    fireEvent.click(within(group).getByRole('button', { name: 'Male' }))
    expect(onFigure).toHaveBeenLastCalledWith('male')
    fireEvent.click(within(group).getByRole('button', { name: 'Either' }))
    expect(onFigure).toHaveBeenLastCalledWith(null)
  })

  it('plays a mock transformation to a random end build, marked as a mock, and goes back to the real body', () => {
    vi.useFakeTimers()
    render(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play transformation' }))
    expect(screen.getByLabelText(/mock transformation toward a random .* build: week 0 of 52/)).toBeInTheDocument()
    // A week a step: React schedules each next step once the last has shown.
    for (let w = 0; w < 52; w++) {
      act(() => {
        vi.advanceTimersByTime(130)
      })
    }
    expect(screen.getByLabelText(/mock transformation toward a random .* build: week 52 of 52/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    // The real week slider gives way to the mock's own while it shows.
    expect(screen.getByText(/End build: .* · week 52 of 52/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Back to Ada's body" }))
    expect(screen.getByLabelText(/Ada's figure, female, turning slowly/)).toBeInTheDocument()
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'today')
  })

  it('draws another end build on demand', () => {
    vi.useFakeTimers()
    render(<BodyGrowth name="Ada" body={trainedBody()} figure="female" onFigure={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Randomize end build' }))
    for (let w = 0; w < 52; w++) {
      act(() => {
        vi.advanceTimersByTime(130)
      })
    }
    expect(screen.getByText(/End build: .+ · week 52 of 52/)).toBeInTheDocument()
  })
})

