import { programFromIntake, type ProgramDto } from '@arc/dependencies'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const putProgram = vi.fn()
const programs = vi.fn()
vi.mock('../api/client', () => ({ api: { plan: { putProgram: (...a: unknown[]) => putProgram(...a), programs: (...a: unknown[]) => programs(...a) } } }))
const { WeekEditor } = await import('./WeekEditor')

const week = programFromIntake({ goals: 'Get stronger', focus: 'squat', side: 'right', limitations: 'none', experience: 'new', daysPerWeek: 2, trainingGoal: 'strength', trainingDays: [1, 5] })
const PROGRAM: ProgramDto = { ...week, id: 'w1', profileId: 'p1', active: true, source: 'arc', createdAt: 1 }

const day = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}: `) }).closest('li')!
function pick(label: string, option: string | RegExp, scope: HTMLElement = document.body) {
  fireEvent.keyDown(within(scope).getByRole('combobox', { name: label }), { key: 'Enter' })
  fireEvent.click(screen.getByRole('option', { name: option }))
}

describe('WeekEditor', () => {
  beforeEach(() => {
    putProgram.mockReset().mockImplementation((_id: string, input: { days: unknown[] }) => Promise.resolve({ ...PROGRAM, id: 'w2', source: 'member', ...input }))
    programs.mockReset().mockResolvedValue([PROGRAM])
  })

  it('shows the week Monday first: training days with each movement under its muscle group, rest days as rest', () => {
    render(<WeekEditor profileId="p1" program={PROGRAM} onSaved={() => {}} />)
    expect(screen.getAllByRole('button', { name: /: (training|rest) day$/ }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Monday: training day',
      'Tuesday: rest day',
      'Wednesday: rest day',
      'Thursday: rest day',
      'Friday: training day',
      'Saturday: rest day',
      'Sunday: rest day',
    ])
    expect(within(day('Monday')).getByText('Squat')).toBeInTheDocument()
    expect(within(day('Monday')).getAllByText('Quads').length).toBe(2)
  })

  it('adds a movement for a muscle group to a new training day, titles it, and saves the week', async () => {
    const onSaved = vi.fn()
    render(<WeekEditor profileId="p1" program={PROGRAM} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Wednesday: rest day' }))
    const add = screen.getByRole('group', { name: 'Add a movement to Wednesday' })
    // The back is three groups, with no left or right.
    fireEvent.keyDown(within(add).getByRole('combobox', { name: 'Target muscle' }), { key: 'Enter' })
    for (const name of ['Upper back', 'Lats', 'Lower back']) expect(screen.getByRole('option', { name })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: 'Lower back' }))
    expect(within(add).getByRole('combobox', { name: 'Movement' })).toHaveTextContent('Deadlift')
    fireEvent.click(within(add).getByRole('button', { name: 'Add' }))

    const wednesday = day('Wednesday')
    expect(within(wednesday).getByText('Lower back')).toBeInTheDocument()
    expect(within(wednesday).getByRole('textbox', { name: "Wednesday's title" })).toHaveValue('Back · Lower back')
    expect(wednesday).toHaveTextContent('both sides')

    fireEvent.click(screen.getByRole('button', { name: 'Save my week' }))
    await waitFor(() => expect(putProgram).toHaveBeenCalledTimes(1))
    const { days } = putProgram.mock.calls[0]![1] as { days: { weekday: number; title: string; items: { exercise: string; muscle?: string }[] }[] }
    expect(days.map((d) => d.weekday)).toEqual([1, 3, 5])
    expect(days[1]).toMatchObject({ weekday: 3, title: 'Back · Lower back', items: [{ exercise: 'deadlift', muscle: 'lower_back' }] })
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'w2', source: 'member' }))
  })

  it('reorders, changes and removes movements; a side only for one-sided ones', () => {
    render(<WeekEditor profileId="p1" program={PROGRAM} onSaved={() => {}} />)
    const monday = day('Monday')
    const names = () => within(monday).getAllByText(/^(Squat|Lunge|Seated knee extension)$/).map((n) => n.firstChild?.textContent)
    expect(names()).toEqual(['Squat', 'Lunge'])
    fireEvent.click(within(monday).getByRole('button', { name: 'Move lunge up' }))
    expect(names()).toEqual(['Lunge', 'Squat'])

    fireEvent.click(within(monday).getByRole('button', { name: 'Change squat' }))
    fireEvent.change(within(monday).getByRole('spinbutton', { name: 'Sets for squat' }), { target: { value: '5' } })
    expect(monday).toHaveTextContent(/Squatboth sides · 5 ×/)
    expect(within(monday).queryByRole('combobox', { name: 'Side for squat' })).not.toBeInTheDocument()
    fireEvent.click(within(monday).getByRole('button', { name: 'Change lunge' }))
    pick('Side for lunge', 'Left', monday)
    expect(monday).toHaveTextContent(/Lungeleft ·/)

    fireEvent.click(within(monday).getByRole('button', { name: 'Remove lunge' }))
    expect(names()).toEqual(['Squat'])
  })

  it('will not save a training day with nothing in it', () => {
    render(<WeekEditor profileId="p1" program={PROGRAM} onSaved={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thursday: rest day' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save my week' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Add a movement to Thursday, or make it a rest day.')
    expect(putProgram).not.toHaveBeenCalled()
  })

  it('starts from an earlier week in the history', async () => {
    const older: ProgramDto = { ...PROGRAM, id: 'w0', active: false, source: 'demo', days: [{ weekday: 2, title: 'Core', items: [{ ...week.days[0]!.items[0]!, exercise: 'crunch', muscle: 'abs' }] }] }
    programs.mockResolvedValue([PROGRAM, older])
    render(<WeekEditor profileId="p1" program={PROGRAM} onSaved={() => {}} history />)
    await screen.findByRole('combobox', { name: 'Start from' })
    pick('Start from', /Demo week/)
    expect(screen.getByRole('button', { name: 'Tuesday: training day' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Monday: rest day' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save my week' })).toBeEnabled()
  })
})
