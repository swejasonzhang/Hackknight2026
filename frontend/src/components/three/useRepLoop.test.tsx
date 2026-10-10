import { render, screen } from '@testing-library/react'
import { isMotionValue, type MotionValue } from 'motion/react'
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

  it('puts the limb back at rest when the movement changes, even between two that rest at the same angle', () => {
    let current: MotionValue<number> | number | null = null
    function Grab({ exercise }: { exercise: 'elbow_flexion' | 'shoulder_abduction' }) {
      current = useRepLoop(exercise, 128)
      return null
    }
    const { rerender } = render(<Grab exercise="elbow_flexion" />)
    const angle = current as unknown as MotionValue<number>
    angle.stop()
    angle.set(77) // mid-rep in the elbow loop
    rerender(<Grab exercise="shoulder_abduction" />)
    expect((current as unknown as MotionValue<number>).get()).toBe(0)
  })

  it('has nothing to show without a reading', () => {
    render(<Probe peak={null} />)
    expect(screen.getByText('none')).toBeInTheDocument()
  })
})
