import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Avatar, EmptyState, Segmented, StatTile } from './ui'

describe('Segmented', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ] as const

  it('marks the active tab and reports clicks', () => {
    const onChange = vi.fn()
    render(<Segmented options={[...options]} value="a" onChange={onChange} label="Exercise" />)
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'false')
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('keeps the full label as the accessible name when a short label is shown on phones', () => {
    render(<Segmented options={[{ value: 'reps', label: 'Rep by rep', short: 'Reps' }]} value="reps" onChange={() => {}} label="Chart" />)
    expect(screen.getByRole('tab', { name: 'Rep by rep' })).toBeInTheDocument()
  })
})

describe('StatTile and EmptyState', () => {
  it('render label, value and hint', () => {
    render(<StatTile label="Best range" value="132°" hint="goal 140°" tone="good" />)
    expect(screen.getByText('Best range')).toBeInTheDocument()
    expect(screen.getByText('132°')).toBeInTheDocument()
    expect(screen.getByText('goal 140°')).toBeInTheDocument()
  })

  it('EmptyState exposes a status region with its title', () => {
    render(<EmptyState title="Nothing yet" description="Come back later" />)
    expect(screen.getByRole('status')).toHaveTextContent('Nothing yet')
  })
})

describe('Avatar', () => {
  it('shows up to two initials', () => {
    const { container } = render(<Avatar name="Ada Lovelace King" />)
    expect(container.textContent).toBe('AL')
  })
})
