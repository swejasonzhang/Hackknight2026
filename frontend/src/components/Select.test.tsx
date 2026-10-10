import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

const SIDES = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
] as const

describe('Select', () => {
  it('shows the chosen option and is named by its label', () => {
    render(
      <>
        <label htmlFor="side">Side</label>
        <Select id="side" value="right" options={[...SIDES]} onChange={() => {}} />
      </>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Side' })
    expect(trigger).toHaveTextContent('Right')
  })

  it('opens a themed list and reports the option picked', () => {
    const onChange = vi.fn()
    render(<Select aria-label="Side" value="right" options={[...SIDES]} onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Side' }), { key: 'Enter' })
    const listbox = screen.getByRole('listbox')
    expect(listbox).toHaveClass('select-content')
    expect(screen.getByRole('option', { name: 'Right' })).toHaveAttribute('data-state', 'checked')
    fireEvent.click(screen.getByRole('option', { name: 'Left' }))
    expect(onChange).toHaveBeenCalledWith('left')
  })
})
