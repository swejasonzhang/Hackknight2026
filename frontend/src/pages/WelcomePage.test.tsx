import { catalogByArea, EXERCISE_IDS } from '@arc/dependencies'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const onboarding = vi.fn()
const reload = vi.fn()
const setSelectedId = vi.fn()
vi.mock('../api/client', () => ({
  api: { coach: { onboarding: (input: unknown) => onboarding(input), status: () => Promise.resolve({ gemini: false, voice: false }), audio: vi.fn() } },
}))
vi.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ reload, setSelectedId, profiles: [], selected: null, selectedId: '', loading: false }) }))
const { WelcomePage } = await import('./WelcomePage')

const renderPage = () =>
  render(
    <MemoryRouter>
      <WelcomePage />
    </MemoryRouter>,
  )

describe('WelcomePage', () => {
  beforeEach(() => {
    onboarding.mockReset()
    reload.mockReset()
    setSelectedId.mockReset()
  })

  it('opens with Arc asking what the member wants from their body', async () => {
    onboarding.mockResolvedValue({ reply: "Hi Ada, I'm Arc, your coach. What would you like to do with your body?", messageId: 'm1', done: false, offline: true })
    renderPage()
    expect(await screen.findByText(/I'm Arc, your coach/)).toBeInTheDocument()
    expect(onboarding).toHaveBeenCalledWith({ messages: [] })
  })

  it('sends each answer with the whole conversation, and shows Arc the next question', async () => {
    onboarding
      .mockResolvedValueOnce({ reply: "Hi, I'm Arc. What would you like to do with your body?", messageId: 'm1', done: false, offline: true })
      .mockResolvedValueOnce({ reply: 'Which part should we work on first?', messageId: 'm2', done: false, offline: true })
    renderPage()
    await screen.findByText(/What would you like to do/)
    fireEvent.change(screen.getByRole('textbox', { name: /your answer/i }), { target: { value: 'Get my knee bending again' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText('Which part should we work on first?')).toBeInTheDocument()
    expect(screen.getByText('Get my knee bending again')).toBeInTheDocument()
    expect(onboarding).toHaveBeenLastCalledWith({
      messages: [
        { role: 'arc', text: "Hi, I'm Arc. What would you like to do with your body?" },
        { role: 'user', text: 'Get my knee bending again' },
      ],
    })
  })

  it('offers quick answers for the question Arc is asking, and a tap sends one', async () => {
    onboarding
      .mockResolvedValueOnce({ reply: 'Left side or right side?', messageId: 'm1', done: false, offline: true, topic: 'side' })
      .mockResolvedValueOnce({ reply: 'Any injuries?', messageId: 'm2', done: false, offline: true, topic: 'limitations' })
    renderPage()
    await screen.findByText('Left side or right side?')
    expect(screen.getByText('4 of 9')).toBeInTheDocument()
    const quick = screen.getByRole('group', { name: /quick answers/i })
    fireEvent.click(within(quick).getByRole('button', { name: 'Left' }))
    expect(await screen.findByText('Any injuries?')).toBeInTheDocument()
    expect(onboarding).toHaveBeenLastCalledWith({ messages: [{ role: 'arc', text: 'Left side or right side?' }, { role: 'user', text: 'Left' }] })
    expect(within(screen.getByRole('group', { name: /quick answers/i })).getByRole('button', { name: 'None' })).toBeInTheDocument()
  })

  it('offers every exercise in the catalog, by area, when Arc asks where to start', async () => {
    onboarding
      .mockResolvedValueOnce({ reply: 'Where should we start?', messageId: 'm1', done: false, offline: true, topic: 'focus', choices: catalogByArea() })
      .mockResolvedValueOnce({ reply: 'Left side or right side?', messageId: 'm2', done: false, offline: true, topic: 'side' })
    renderPage()
    await screen.findByText('Where should we start?')
    const start = screen.getByRole('group', { name: /where to start/i })
    for (const area of ['Upper body', 'Back', 'Legs', 'Core']) expect(within(start).getByText(area)).toBeInTheDocument()
    expect(within(start).getAllByRole('button')).toHaveLength(EXERCISE_IDS.length)
    fireEvent.click(within(start).getByRole('button', { name: 'Lat pulldown' }))
    expect(await screen.findByText('Left side or right side?')).toBeInTheDocument()
    expect(onboarding).toHaveBeenLastCalledWith({ messages: [{ role: 'arc', text: 'Where should we start?' }, { role: 'user', text: 'Lat pulldown' }] })
    expect(screen.queryByRole('group', { name: /where to start/i })).not.toBeInTheDocument()
  })

  it('can be skipped at any point, straight to the dashboard', async () => {
    onboarding.mockResolvedValue({ reply: "Hi, I'm Arc.", messageId: 'm1', done: false, offline: true, topic: 'goals' })
    renderPage()
    await screen.findByText("Hi, I'm Arc.")
    expect(screen.getByRole('link', { name: /skip for now/i })).toHaveAttribute('href', '/dashboard')
  })

  it('shows the week Arc built when it has enough, and selects the new profile', async () => {
    const program = {
      id: 'w1',
      profileId: 'p9',
      active: true,
      source: 'arc',
      createdAt: 1,
      summary: '3 days a week (Monday, Wednesday and Friday), built for muscle size.',
      days: [1, 3, 5].map((weekday) => ({ weekday, title: 'Seated knee extension', items: [{ exercise: 'seated_knee_extension', side: 'left', sets: 3, reps: 8, restSeconds: 180, targetDeg: 175 }] })),
    }
    onboarding
      .mockResolvedValueOnce({ reply: "Hi, I'm Arc.", messageId: 'm1', done: false, offline: true, topic: 'weight' })
      .mockResolvedValueOnce({
        reply: 'Thanks, Ada. Your week is ready.',
        messageId: 'm2',
        done: true,
        offline: true,
        profileId: 'p9',
        intake: { goals: 'Bend my knee', focus: 'seated_knee_extension', side: 'left', limitations: 'none', experience: 'new', daysPerWeek: 3 },
        plan: { id: 'pl1', profileId: 'p9', exercise: 'seated_knee_extension', side: 'left', sets: 3, reps: 8, restSeconds: 180, targetDeg: 175, active: true, createdAt: 1 },
        program,
      })
    renderPage()
    await screen.findByText("Hi, I'm Arc.")
    fireEvent.change(screen.getByRole('textbox', { name: /your answer/i }), { target: { value: 'skip' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    const week = await screen.findByRole('region', { name: 'Your week' })
    expect(within(week).getByText(program.summary)).toBeInTheDocument()
    expect(within(week).getAllByText('Seated knee extension · left · 3 × 8 · 180 s rest')).toHaveLength(3)
    expect(within(week).getAllByText('Rest')).toHaveLength(4)
    expect(within(week).getByRole('link', { name: /see it on your dashboard/i })).toHaveAttribute('href', '/dashboard')
    expect(within(week).getByRole('link', { name: 'Start recording' })).toHaveAttribute('href', '/record')
    expect(screen.queryByRole('textbox', { name: /your answer/i })).not.toBeInTheDocument()
    expect(screen.getByText('All done')).toBeInTheDocument()
    expect(setSelectedId).toHaveBeenCalledWith('p9')
    expect(reload).toHaveBeenCalled()
  })
})
