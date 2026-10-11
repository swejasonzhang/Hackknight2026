import type { ChallengeRunDto } from '@arc/dependencies'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from '../api/client'

const getRun = vi.fn()
vi.mock('../api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('../api/client')>()
  return { ...real, api: { challenge: { get: (id: string) => getRun(id) } } }
})
const { ChallengeLink } = await import('./ChallengeLink')

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 14, 12)
// Sixteen days in: week 3.
const RUN: ChallengeRunDto = { id: 'r1', profileId: 'p1', challengeId: 'summer_body', startedAt: NOW - 16 * DAY, status: 'active', phase: 0 }

const renderLink = () =>
  render(
    <MemoryRouter>
      <p>Header</p>
      <ChallengeLink profileId="p1" />
    </MemoryRouter>,
  )

describe('ChallengeLink', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    getRun.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('leads to the challenge under way, with the week it is in', async () => {
    getRun.mockResolvedValue(RUN)
    renderLink()
    expect(await screen.findByRole('link', { name: 'Challenge: Summer body · week 3 of 12 →' })).toHaveAttribute('href', '/challenges')
    expect(getRun).toHaveBeenCalledWith('p1')
  })

  it.each([
    ['without a challenge', () => Promise.reject(new ApiRequestError(404, 'No challenge'))],
    ['once it is finished', () => Promise.resolve({ ...RUN, status: 'done' })],
    ['when it cannot load', () => Promise.reject(new Error('Network down'))],
  ])('shows nothing %s', async (_, result) => {
    getRun.mockImplementation(result)
    renderLink()
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(getRun).toHaveBeenCalledWith('p1')
    expect(screen.getByText('Header')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
