import { CHALLENGE_LIST, CHALLENGES, MUSCLE_IDS, projectChallenge, type BodyDto, type ChallengeRunDto, type MuscleId, type ProfileDto, type SessionDto } from '@arc/dependencies'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '../api/client'
import { percent } from '../body/growth'

const getRun = vi.fn()
const startRun = vi.fn()
const leaveRun = vi.fn()
const program = vi.fn()
const sessions = vi.fn()
const body = vi.fn()
vi.mock('../api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('../api/client')>()
  return {
    ...real,
    api: {
      challenge: { get: (id: string) => getRun(id), start: (id: string, input: unknown) => startRun(id, input), leave: (id: string) => leaveRun(id) },
      plan: { program: (id: string) => program(id) },
      sessions: { list: (id: string) => sessions(id) },
      body: (id: string) => body(id),
    },
  }
})
vi.mock('../components/three/lazy', () => ({
  LazyJointScene: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
  SceneBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
const ADA = { id: 'p1', ownerId: 'u1', name: 'Ada', figure: 'female', createdAt: 0 } as ProfileDto
const BEN = { id: 'p2', ownerId: 'u1', name: 'Ben', figure: 'male', createdAt: 0 } as ProfileDto
// The profile picked; a test switches it and renders again.
let who = ADA
vi.mock('../hooks/useProfiles', () => ({ useProfiles: () => ({ profiles: [who], selected: who, selectedId: who.id, setSelectedId: () => {}, reload: async () => {}, loading: false, error: null }) }))
const { ChallengesPage } = await import('../pages/ChallengesPage')

/** Midnight (or `hour`) local time on a day of 2026, months from 0. */
const local = (month: number, day: number, hour = 0) => new Date(2026, month, day, hour).getTime()
// Wednesday 14 October 2026, midday.
const NOW = local(9, 14, 12)
// Summer body from Monday 28 September: week 3 today.
const RUN: ChallengeRunDto = { id: 'r1', profileId: 'p1', challengeId: 'summer_body', startedAt: local(8, 28), status: 'active', phase: 0 }
// Strong arms from the same day, a challenge that is not the first card: week 3 of 8.
const ARMS: ChallengeRunDto = { ...RUN, challengeId: 'strong_arms' }
// It trains Monday, Wednesday, Friday and Saturday: every training day so far but Saturday 3 October.
const TRAINED = [
  [8, 28],
  [8, 30],
  [9, 2],
  [9, 5],
  [9, 7],
  [9, 9],
  [9, 10],
  [9, 12],
].map(([month, day]) => ({ id: `s${month}-${day}`, profileId: 'p1', exercise: 'chest_press', startedAt: local(month!, day!, 18) }) as unknown as SessionDto)

const levels = (pick: Partial<Record<MuscleId, number>>) => Object.fromEntries(MUSCLE_IDS.map((m) => [m, pick[m] ?? 0])) as Record<MuscleId, number>
const now = levels({ chest: 0.1, biceps: 0.2, quads: 0.3 })
const BODY: BodyDto = {
  profileId: 'p1',
  figure: 'female',
  asOf: NOW,
  overall: 0.12,
  muscles: Object.fromEntries(MUSCLE_IDS.map((m) => [m, { level: now[m], recentSets: 0, totalSets: 0, change: 0 }])) as BodyDto['muscles'],
  weeks: [],
}

const page = (path: string) => (
  <MemoryRouter initialEntries={[path]}>
    <ChallengesPage />
  </MemoryRouter>
)
const renderPage = (path = '/challenges') => render(page(path))
// Label queries over role queries: the page is large, and working out every role on it is slow.
const card = (name: string) => screen.getByLabelText(name, { selector: 'button' })
const detail = (name: string) => screen.getByLabelText(name, { selector: 'section' })
/** A cell of the switch between the body now and at the finish. */
const view = (name: string) => within(screen.getByLabelText('Show the body')).getByText(name)
/** The lamp of the readout showing `text`. */
const lampOf = (text: string) => screen.getByText(text).closest('.readout-row')!.querySelector('.lamp')

describe('ChallengesPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    who = ADA
    getRun.mockReset().mockRejectedValue(new ApiRequestError(404, 'No challenge'))
    startRun.mockReset()
    leaveRun.mockReset().mockResolvedValue(null)
    program.mockReset().mockRejectedValue(new ApiRequestError(404, 'No program yet'))
    sessions.mockReset().mockResolvedValue([])
    body.mockReset().mockResolvedValue(BODY)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('lists all eight: how long, how often, the level and the muscles each builds', async () => {
    renderPage()
    const cards = within(screen.getByLabelText('Challenges')).getAllByRole('button')
    expect(cards).toHaveLength(8)
    cards.forEach((c, i) => expect(c).toHaveAccessibleName(CHALLENGE_LIST[i]!.name))
    expect(cards[0]).toHaveAccessibleDescription(/12 weeks · 4 days a week · Intermediate/)
    expect(within(cards[0]!).getByText('Side shoulders')).toBeInTheDocument()
    expect(cards[1]).toHaveAccessibleDescription(/52 weeks · 3 days a week · Beginner/)
    // Without a challenge under way, the first is open.
    expect(await screen.findByLabelText('Summer body', { selector: 'section' })).toBeInTheDocument()
    expect(cards[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the one picked: its phases, and the week its first phase trains', async () => {
    renderPage()
    await screen.findByLabelText('Summer body', { selector: 'section' })
    const vTaper = card('V-taper back')
    fireEvent.click(vTaper)
    expect(vTaper).toHaveAttribute('aria-pressed', 'true')
    expect(card('Summer body')).toHaveAttribute('aria-pressed', 'false')
    const open = detail('V-taper back')
    const phases = within(within(open).getByLabelText('3 phases')).getAllByRole('listitem')
    expect(phases).toHaveLength(3)
    expect(phases[0]).toHaveTextContent('Width')
    expect(phases[0]).toHaveTextContent('Weeks 1–4')
    expect(phases[2]).toHaveTextContent('Shape')
    expect(phases[2]).toHaveTextContent('Weeks 9–12')
    const week = within(open).getByLabelText('The first week · Width')
    expect(within(week).getAllByText(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/).map((d) => d.textContent)).toEqual(['Tuesday', 'Thursday', 'Saturday'])
    expect(within(week).getByText('Back width')).toBeInTheDocument()
    expect(within(week).getAllByText('Lat pulldown · 3 × 12')).toHaveLength(2)
  })

  it('asks before its first phase replaces the week, then starts it from today', async () => {
    program.mockResolvedValue({ id: 'w1' })
    startRun.mockResolvedValue({ ...RUN, startedAt: local(9, 14) })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderPage()
    const start = await screen.findByText('Start this challenge')
    await vi.waitFor(() => expect(start).toBeEnabled())
    fireEvent.click(start)
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    expect(confirm).toHaveBeenCalledWith("Start Summer body? Its first phase replaces Ada's current week. Earlier weeks stay in the plan's history.")
    await vi.waitFor(() => expect(start).toBeEnabled())
    expect(startRun).not.toHaveBeenCalled()

    fireEvent.click(start)
    await vi.waitFor(() => expect(startRun).toHaveBeenCalledWith('p1', { challengeId: 'summer_body', tzOffsetMinutes: new Date(NOW).getTimezoneOffset() }))
    expect(await screen.findByText('Week 1 of 12 · Build the base')).toBeInTheDocument()
    expect(screen.getByText('Ada started Summer body. The week is now phase 1: Build the base.')).toBeInTheDocument()
    expect(screen.getByText('Summer body', { selector: 'h3' })).toHaveFocus()
  })

  it('starts straight away when there is no week to replace', async () => {
    startRun.mockResolvedValue({ ...RUN, challengeId: 'core_30', startedAt: local(9, 14) })
    const confirm = vi.spyOn(window, 'confirm')
    renderPage('/challenges?challenge=core_30')
    const start = await screen.findByText('Start this challenge')
    await vi.waitFor(() => expect(start).toBeEnabled())
    fireEvent.click(start)
    await vi.waitFor(() => expect(startRun).toHaveBeenCalledWith('p1', { challengeId: 'core_30', tzOffsetMinutes: new Date(NOW).getTimezoneOffset() }))
    expect(confirm).not.toHaveBeenCalled()
  })

  it('says why a start failed, and lets it be tried again', async () => {
    startRun.mockRejectedValue(new ApiRequestError(500, 'Could not write the week'))
    renderPage()
    const start = await screen.findByText('Start this challenge')
    await vi.waitFor(() => expect(start).toBeEnabled())
    fireEvent.click(start)
    expect((await screen.findByText('Could not write the week')).closest('[role="alert"]')).not.toBeNull()
    expect(start).toBeEnabled()
    expect(screen.queryByText('Week 1 of 12 · Build the base')).toBeNull()
  })

  it('shows the challenge under way: its days trained, its phase and the body it is heading for', async () => {
    getRun.mockResolvedValue(RUN)
    sessions.mockResolvedValue(TRAINED)
    renderPage()
    expect(await screen.findByText('Week 3 of 12 · Build the base')).toBeInTheDocument()
    expect(screen.getByText('Week 3 of 12 · 67 days left')).toBeInTheDocument()
    expect(screen.getByLabelText('Training days done')).toHaveAttribute('aria-valuetext', '8 of 48 training days done')
    expect(screen.getByText('8 of 9 training days so far')).toBeInTheDocument()
    // 89%: good, at 80% or more.
    expect(lampOf('89%')).toHaveClass('lamp-ok')
    const phases = within(screen.getByLabelText('Phases')).getAllByRole('listitem')
    expect(phases.map((li) => li.getAttribute('aria-current'))).toEqual(['step', null, null])
    expect(screen.getByText('You are on it · week 3 of 12')).toBeInTheDocument()
    expect(screen.queryByText('Start this challenge')).toBeNull()
    // The body at the finish grows on from today's body through the weeks left, from week 3.
    const at3 = projectChallenge(CHALLENGES.summer_body, now, 3)
    const chest = percent(at3.levels.chest)
    expect(await screen.findByLabelText(/at the finish of Summer body/)).toHaveAccessibleName(new RegExp(`at the finish of Summer body, ${percent(at3.overall)}% built, `))
    expect(screen.getByLabelText(/^Chest: up/)).toHaveAccessibleName(`Chest: up ${chest - 10} points, from 10% to ${chest}% built`)
  })

  it('keeps the challenge under way when the sessions will not load, without counting its days', async () => {
    getRun.mockResolvedValue(RUN)
    sessions.mockRejectedValue(new ApiRequestError(500, 'HTTP 500'))
    renderPage()
    expect(await screen.findByText('Week 3 of 12 · Build the base')).toBeInTheDocument()
    expect(screen.getByText('48 in all')).toBeInTheDocument()
    expect(screen.queryByLabelText('Training days done')).toBeNull()
    expect(screen.getByText('Sessions could not load')).toBeInTheDocument()
    expect(screen.getByText('Leave the challenge')).toBeEnabled()
  })

  it('starts nothing while it cannot tell whether a challenge is under way', async () => {
    getRun.mockRejectedValue(new ApiRequestError(500, 'HTTP 500'))
    renderPage()
    expect((await screen.findByText(/^Could not check for Ada's challenge \(HTTP 500\)/)).closest('[role="alert"]')).not.toBeNull()
    expect(detail('Summer body')).toBeInTheDocument()
    expect(screen.getByText('Start this challenge')).toBeDisabled()
  })

  it('opens the challenge under way rather than the first, and keeps it open once left', async () => {
    getRun.mockResolvedValue(ARMS)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderPage()
    expect(await screen.findByText('Week 3 of 8 · Pump')).toBeInTheDocument()
    expect(card('Strong arms')).toHaveAttribute('aria-pressed', 'true')
    expect(card('Summer body')).toHaveAttribute('aria-pressed', 'false')
    expect(detail('Strong arms')).toBeInTheDocument()

    const leave = screen.getByText('Leave the challenge')
    fireEvent.click(leave)
    expect(confirm).toHaveBeenLastCalledWith("Leave Strong arms? Ada's week stays as it is, to keep or to change on the plan page.")
    expect(leaveRun).not.toHaveBeenCalled()
    fireEvent.click(leave)
    await vi.waitFor(() => expect(leaveRun).toHaveBeenCalledWith('p1'))
    const left = await screen.findByText('Ada left Strong arms. The week stays as it was.')
    expect(screen.queryByText('Week 3 of 8 · Pump')).toBeNull()
    // The strip with the focused button is gone: the message where it stood takes the focus.
    await vi.waitFor(() => expect(left.closest('[tabindex="-1"]')).toHaveFocus())
    // Still open on the challenge just left, to start again.
    expect(detail('Strong arms')).toBeInTheDocument()
    expect(screen.getByText('Start this challenge')).toBeEnabled()
  })

  it('says which challenge a start leaves', async () => {
    getRun.mockResolvedValue(ARMS)
    program.mockResolvedValue({ id: 'w1' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage('/challenges?challenge=v_taper')
    const start = await screen.findByText('Start this challenge')
    await vi.waitFor(() => expect(start).toBeEnabled())
    fireEvent.click(start)
    await vi.waitFor(() =>
      expect(confirm).toHaveBeenCalledWith("Start V-taper back? Ada leaves Strong arms, and V-taper back's first phase replaces the week. Earlier weeks stay in the plan's history."),
    )
    expect(startRun).not.toHaveBeenCalled()
  })

  it('keeps a finished challenge with its numbers, and points to the next', async () => {
    // Twelve weeks from Monday 6 July: the last day was Sunday 27 September.
    getRun.mockResolvedValue({ ...RUN, startedAt: local(6, 6), status: 'done', phase: 2, endedAt: local(8, 30) })
    sessions.mockResolvedValue(TRAINED.slice(0, 1))
    program.mockResolvedValue({ id: 'w1' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage('/challenges?challenge=v_taper')
    expect(await screen.findByText('All 12 weeks · finished')).toBeInTheDocument()
    expect(screen.getByLabelText('Training days done')).toHaveAttribute('aria-valuetext', '0 of 48 training days done')
    expect(screen.getByText('0 of 48 training days')).toBeInTheDocument()
    expect(screen.queryByText('Leave the challenge')).toBeNull()
    fireEvent.click(screen.getByText('Pick the next challenge'))
    expect(card('V-taper back')).toHaveFocus()
    // A finished challenge is not one to leave: a start only replaces the week.
    fireEvent.click(screen.getByText('Start this challenge'))
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledWith("Start V-taper back? Its first phase replaces Ada's current week. Earlier weeks stay in the plan's history."))
  })

  it('turns the figure from the body today to the body at the finish, and says what grows', async () => {
    renderPage()
    const at1 = projectChallenge(CHALLENGES.summer_body, now)
    const chest = percent(at1.levels.chest)
    const figure = await screen.findByLabelText(/at the finish of Summer body/)
    expect(figure).toHaveAccessibleName(new RegExp(`^Ada's figure, female, turning slowly: at the finish of Summer body, ${percent(at1.overall)}% built, most gained in [a-z ,]+$`))
    fireEvent.click(view('Now'))
    expect(screen.getByLabelText(/^Ada's figure/)).toHaveAccessibleName("Ada's figure, female, turning slowly: now, 12% built")
    const gains = within(screen.getByLabelText('What Summer body builds most')).getAllByRole('listitem')
    expect(gains.map((li) => li.getAttribute('aria-label')!.split(':')[0])).toEqual(['Chest', 'Side shoulders', 'Front shoulders', 'Biceps', 'Triceps', 'Abs'])
    expect(gains[0]).toHaveAccessibleName(`Chest: up ${chest - 10} points, from 10% to ${chest}% built`)
    fireEvent.click(view('At the finish'))
    expect(screen.getByLabelText(/^Ada's figure/)).toHaveAccessibleName(new RegExp(`at the finish of Summer body, ${percent(at1.overall)}% built, `))
  })

  it("keeps a start that comes back after a switch to another profile off that profile's page", async () => {
    let started!: (run: ChallengeRunDto) => void
    startRun.mockReturnValue(new Promise<ChallengeRunDto>((resolve) => (started = resolve)))
    const { rerender } = renderPage()
    const start = await screen.findByText('Start this challenge')
    await vi.waitFor(() => expect(start).toBeEnabled())
    fireEvent.click(start)
    await vi.waitFor(() => expect(startRun).toHaveBeenCalledWith('p1', expect.anything()))

    who = BEN
    rerender(page('/challenges'))
    await vi.waitFor(() => expect(sessions).toHaveBeenCalledWith('p2'))
    started({ ...RUN, startedAt: local(9, 14) })
    await vi.waitFor(() => expect(screen.getByText('Start this challenge')).toBeEnabled())
    expect(screen.queryByText('Week 1 of 12 · Build the base')).toBeNull()
    expect(screen.queryByText(/started Summer body/)).toBeNull()
  })
})
