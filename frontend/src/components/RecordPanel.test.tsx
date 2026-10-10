import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RecordPanel } from './RecordPanel'

const PLAN = { exercise: 'shoulder_abduction' as const, side: 'left' as const, sets: 2, reps: 10, restSeconds: 60, targetDeg: 160 }

describe('RecordPanel', () => {
  it('records in the browser, straight into the plan, with nothing to install', () => {
    render(
      <MemoryRouter>
        <RecordPanel plan={PLAN} exercise="elbow_flexion" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Record a session' })).toBeInTheDocument()
    expect(screen.getByText(/nothing to install/i)).toBeInTheDocument()
    expect(screen.getByText(/never leaves this device/i)).toBeInTheDocument()
    expect(screen.getByText(/shoulder abduction · left · 2 × 10 · 60 s rest/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start recording' })).toHaveAttribute('href', '/record')
  })

  it('without a plan, records the movement on screen', () => {
    render(
      <MemoryRouter>
        <RecordPanel plan={null} exercise="seated_knee_extension" />
      </MemoryRouter>,
    )
    expect(screen.getByText(/seated knee extension · right · 3 × 8 · 45 s rest/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start recording' })).toHaveAttribute('href', '/record?exercise=seated_knee_extension')
  })
})
