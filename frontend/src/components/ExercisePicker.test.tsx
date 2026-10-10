import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ExerciseId } from '@arc/dependencies'
import { ExercisePicker } from './ExercisePicker'

function Harness({ start = 'elbow_flexion', onPick = () => {} }: { start?: ExerciseId; onPick?: (e: ExerciseId) => void }) {
  const [exercise, setExercise] = useState<ExerciseId>(start)
  return (
    <ExercisePicker
      value={exercise}
      onChange={(e) => {
        setExercise(e)
        onPick(e)
      }}
    />
  )
}

describe('ExercisePicker', () => {
  it('has four body-area tabs, with the picked movement and its area selected', () => {
    render(<Harness start="squat" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.getAttribute('aria-label') ?? t.textContent)).toEqual(['Upper body', 'Back', 'Legs', 'Core'])
    expect(screen.getByRole('tab', { name: 'Legs' })).toHaveAttribute('data-state', 'active')
    const group = screen.getByRole('group', { name: /legs exercises/i })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Squat', 'Lunge', 'Seated knee extension'])
    expect(within(group).getByRole('button', { name: 'Squat' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switching area picks its first movement; picking a movement reports it', () => {
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    expect(within(screen.getByRole('group', { name: /upper body exercises/i })).getAllByRole('button')).toHaveLength(7)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Back' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Back' }))
    expect(onPick).toHaveBeenLastCalledWith('lat_pulldown')
    fireEvent.click(screen.getByRole('button', { name: 'Deadlift' }))
    expect(onPick).toHaveBeenLastCalledWith('deadlift')
    expect(screen.getByRole('button', { name: 'Deadlift' })).toHaveAttribute('aria-pressed', 'true')
  })
})
