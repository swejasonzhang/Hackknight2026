import { render, screen } from '@testing-library/react'
import { isMotionValue } from 'motion/react'
import { describe, expect, it, vi } from 'vitest'
import { useRepLoop } from './useRepLoop'

// Motion reads the reduced-motion preference once per module, so this file sets it before any render.
vi.spyOn(window, 'matchMedia').mockImplementation(
  (query: string) => ({ matches: query.includes('reduce'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }) as unknown as MediaQueryList,
)

function Probe({ peak }: { peak: number }) {
  const angle = useRepLoop('elbow_flexion', peak)
  return <p>{angle != null && !isMotionValue(angle) ? `held at ${angle}` : 'moving'}</p>
}

describe('useRepLoop under reduced motion', () => {
  it('holds the best rep still instead of looping', () => {
    render(<Probe peak={128} />)
    expect(screen.getByText('held at 128')).toBeInTheDocument()
  })
})
