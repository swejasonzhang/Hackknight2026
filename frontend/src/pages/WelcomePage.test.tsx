import { fireEvent, render, screen } from '@testing-library/react'
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

  it('shows the plan Arc built when it has enough, and selects the new profile', async () => {
    onboarding
      .mockResolvedValueOnce({ reply: "Hi, I'm Arc.", messageId: 'm1', done: false, offline: true })
      .mockResolvedValueOnce({
        reply: 'Thanks, Ada. Your plan is ready.',
        messageId: 'm2',
        done: true,
        offline: true,
        profileId: 'p9',
        intake: { goals: 'Bend my knee', focus: 'seated_knee_extension', side: 'left', limitations: 'none', experience: 'new', daysPerWeek: 3 },
        plan: { id: 'pl1', profileId: 'p9', exercise: 'seated_knee_extension', side: 'left', sets: 3, reps: 8, restSeconds: 60, targetDeg: 175, active: true, createdAt: 1 },
      })
    renderPage()
    await screen.findByText("Hi, I'm Arc.")
    fireEvent.change(screen.getByRole('textbox', { name: /your answer/i }), { target: { value: 'Three days a week' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByText(/Seated knee extension · left · 3 × 8 · 60 s rest · goal 175°/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start recording' })).toHaveAttribute('href', '/record')
    expect(screen.getByRole('link', { name: 'Go to the dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(setSelectedId).toHaveBeenCalledWith('p9')
    expect(reload).toHaveBeenCalled()
  })
})
