import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RecordPanel } from './RecordPanel'

describe('RecordPanel', () => {
  it('records the picked movement in the browser, with nothing to install, at its prescription', () => {
    render(
      <MemoryRouter>
        <RecordPanel prescription={{ exercise: 'shoulder_abduction', side: 'left', sets: 2, reps: 10, restSeconds: 60, targetDeg: 90, source: 'plan' }} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Record a session' })).toBeInTheDocument()
    expect(screen.getByText(/nothing to install/i)).toBeInTheDocument()
    expect(screen.getByText(/never leaves this device/i)).toBeInTheDocument()
    expect(screen.getByText(/^Plan ·/)).toBeInTheDocument()
    expect(screen.getByText(/lateral raise · left · 2 × 10 · 60 s rest/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start recording' })).toHaveAttribute('href', '/record?exercise=shoulder_abduction')
  })

  it("says when the numbers come from the week, or are only a suggestion", () => {
    const { rerender } = render(
      <MemoryRouter>
        <RecordPanel prescription={{ exercise: 'squat', side: 'right', sets: 4, reps: 10, restSeconds: 90, targetDeg: 100, source: 'week' }} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/^This week ·/)).toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <RecordPanel prescription={{ exercise: 'crunch', side: 'right', sets: 3, reps: 8, restSeconds: 45, targetDeg: 55, source: 'default' }} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/^Suggested ·/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start recording' })).toHaveAttribute('href', '/record?exercise=crunch')
  })
})
