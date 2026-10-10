import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStickyTop } from './useStickyTop'

function Column({ gap }: { gap: number }) {
  const [ref, top] = useStickyTop<HTMLDivElement>(gap)
  return (
    <div ref={ref} data-testid="column" style={{ top }}>
      column
    </div>
  )
}

describe('useStickyTop', () => {
  afterEach(() => vi.restoreAllMocks())

  it('pins a column that fits the window at the gap', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900)
    render(<Column gap={32} />)
    expect(screen.getByTestId('column').style.top).toBe('32px')
  })

  it('lets a column taller than the window scroll until its bottom is in view, with no scrollbar of its own', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(1200)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800)
    render(<Column gap={32} />)
    // 800 − 1200 − 32: the column sticks once its bottom edge sits 32 px above the window's.
    expect(screen.getByTestId('column').style.top).toBe('-432px')
  })
})
