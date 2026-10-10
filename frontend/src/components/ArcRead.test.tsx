import type { SessionDto } from '@arc/dependencies'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const summary = vi.fn()
vi.mock('../api/client', () => ({
  api: { coach: { summary: (id: string) => summary(id), status: () => Promise.resolve({ gemini: false, voice: false }), audio: vi.fn() } },
}))
const { ArcRead } = await import('./ArcRead')

const SESSION = { id: 's1', exercise: 'elbow_flexion', summary: { bestPeakDeg: 126 } } as unknown as SessionDto

describe('ArcRead', () => {
  beforeEach(() => summary.mockReset())

  it("shows Arc's stored read of the session", () => {
    render(<ArcRead session={{ ...SESSION, coachSummary: { text: 'Nice work, Ada.', messageId: 'm1', createdAt: 1, offline: true } }} autoSpeak={false} />)
    expect(screen.getByRole('heading', { name: "Arc's read" })).toBeInTheDocument()
    expect(screen.getByText('Nice work, Ada.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    expect(summary).not.toHaveBeenCalled()
  })

  it('asks Arc for a read when there is none yet', async () => {
    summary.mockResolvedValue({ id: 'm2', kind: 'session', text: 'Your best rep reached 126 degrees.', createdAt: 1, offline: false })
    render(<ArcRead session={SESSION} autoSpeak={false} />)
    fireEvent.click(screen.getByRole('button', { name: /ask arc/i }))
    expect(await screen.findByText('Your best rep reached 126 degrees.')).toBeInTheDocument()
    expect(summary).toHaveBeenCalledWith('s1')
  })

  it('reads a session that was just recorded without being asked', async () => {
    summary.mockResolvedValue({ id: 'm3', kind: 'session', text: 'That was your first session.', createdAt: 1, offline: true })
    render(<ArcRead session={SESSION} autoSpeak />)
    expect(await screen.findByText('That was your first session.')).toBeInTheDocument()
  })
})
