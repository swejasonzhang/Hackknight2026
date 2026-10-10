import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The 3D guide needs WebGL; here it stands in as its label.
vi.mock('../components/three/lazy', () => ({
  LazyJointScene: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
  SceneBoundary: ({ children }: { children: ReactNode }) => children,
}))

const { LiveRecorder } = await import('./LiveRecorder')

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

  it('shows the movement done right beside the camera: a figure to the goal, the muscles it works and the cue', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    renderRecorder()
    const guide = screen.getByRole('region', { name: 'How to do it' })
    expect(guide).toHaveTextContent('How to do it · right')
    expect(screen.getByRole('img', { name: /bicep curl reps the right way, from the start position to the 140 degree goal/i })).toBeInTheDocument()
    expect(guide).toHaveTextContent('Biceps')
    expect(guide).toHaveTextContent('Forearms')
    expect(guide).toHaveTextContent(/keep the upper arm still/i)
    await screen.findByRole('alert')
  })

  it('says the camera needs a secure page when the browser offers none', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    renderRecorder()
    expect(await screen.findByRole('alert')).toHaveTextContent(/secure page/i)
  })
})
