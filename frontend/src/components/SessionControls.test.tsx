import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SessionControls } from './SessionControls'

const noop = { onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onEndSet: vi.fn(), onSkipRest: vi.fn(), onReset: vi.fn() }

describe('SessionControls', () => {
  it('offers Start while idle and calls onStart', () => {
    const onStart = vi.fn()
    render(<SessionControls phase="idle" paused={false} restSecondsLeft={0} {...noop} onStart={onStart} />)
    fireEvent.click(screen.getByRole('button', { name: /start session/i }))
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument()
  })

  it('offers Pause and End set while active, Resume while paused', () => {
    const { rerender } = render(<SessionControls phase="active" paused={false} restSecondsLeft={0} {...noop} />)
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /end set/i })).toBeInTheDocument()
    rerender(<SessionControls phase="active" paused={true} restSecondsLeft={0} {...noop} />)
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
  })

  it('shows the rest countdown and a Skip rest button during rest', () => {
    const onSkipRest = vi.fn()
    render(<SessionControls phase="rest" paused={false} restSecondsLeft={37} {...noop} onSkipRest={onSkipRest} />)
    expect(screen.getByText(/37/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /skip rest/i }))
    expect(onSkipRest).toHaveBeenCalledTimes(1)
  })

  it('offers a reset when complete', () => {
    const onReset = vi.fn()
    render(<SessionControls phase="complete" paused={false} restSecondsLeft={0} {...noop} onReset={onReset} />)
    fireEvent.click(screen.getByRole('button', { name: /new session/i }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
