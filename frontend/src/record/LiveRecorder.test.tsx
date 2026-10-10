import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LiveRecorder } from './LiveRecorder'

const CONFIG = { exercise: 'elbow_flexion' as const, side: 'right' as const, plan: { sets: 3, reps: 8, restSeconds: 45, targetDeg: 140 } }

function renderRecorder() {
  return render(
    <MemoryRouter>
      <LiveRecorder profileId="p1" config={CONFIG} />
    </MemoryRouter>,
  )
}

describe('LiveRecorder', () => {
  const original = navigator.mediaDevices
  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: original, configurable: true })
  })

  it('asks for the camera as soon as it opens, and explains a blocked camera', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
    renderRecorder()
    expect(await screen.findByRole('alert')).toHaveTextContent(/camera access was blocked/i)
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('says the camera needs a secure page when the browser offers none', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    renderRecorder()
    expect(await screen.findByRole('alert')).toHaveTextContent(/secure page/i)
  })
})
