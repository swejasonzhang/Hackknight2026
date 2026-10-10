import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SpotlightCard } from './SpotlightCard'

describe('SpotlightCard', () => {
  it('tracks the pointer into CSS variables the stylesheet reads', () => {
    render(
      <SpotlightCard className="card">
        <p>Hello</p>
      </SpotlightCard>,
    )
    const card = screen.getByText('Hello').parentElement!
    expect(card.className).toContain('spotlight')
    expect(card.style.getPropertyValue('--mx')).toBe('50%')
    card.getBoundingClientRect = () => ({ left: 100, top: 50, width: 200, height: 100, right: 300, bottom: 150, x: 100, y: 50, toJSON: () => ({}) })
    fireEvent.pointerMove(card, { clientX: 160, clientY: 90 })
    expect(card.style.getPropertyValue('--mx')).toBe('60px')
    expect(card.style.getPropertyValue('--my')).toBe('40px')
  })
})
