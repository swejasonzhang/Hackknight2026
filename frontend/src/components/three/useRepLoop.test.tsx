import { render, screen } from '@testing-library/react'
import { isMotionValue } from 'motion/react'
import { describe, expect, it } from 'vitest'
import { useRepLoop } from './useRepLoop'

function Probe({ peak, exercise = 'elbow_flexion' }: { peak: number | null; exercise?: 'elbow_flexion' | 'seated_knee_extension' }) {
  const angle = useRepLoop(exercise, peak)
  const kind = angle == null ? 'none' : isMotionValue(angle) ? `loop from ${angle.get()}` : `held at ${angle}`
  return <p>{kind}</p>
}

describe('useRepLoop', () => {
  it('moves the figure from rest through the whole range to the best rep', () => {
    render(<Probe peak={128} />)
    expect(screen.getByText('loop from 0')).toBeInTheDocument()
  })

  it('starts the knee from the hanging shin at 90 degrees', () => {
    render(<Probe peak={160} exercise="seated_knee_extension" />)
    expect(screen.getByText('loop from 90')).toBeInTheDocument()
  })

  it('has nothing to show without a reading', () => {
    render(<Probe peak={null} />)
    expect(screen.getByText('none')).toBeInTheDocument()
  })
})
