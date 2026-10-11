import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fromKg, LoadField, toKg } from './LoadField'

describe('the weight held', () => {
  beforeEach(() => localStorage.clear())

  it('converts pounds to kilograms to the nearest 0.1, and reads blanks as not given', () => {
    expect(toKg('20', 'lb')).toBe(9.1)
    expect(toKg('12.5', 'kg')).toBe(12.5)
    expect(toKg('', 'kg')).toBeNull()
    expect(toKg('-3', 'kg')).toBeNull()
    expect(fromKg(9.1, 'lb')).toBe('20')
  })

  it('starts from the last weight, reports kilograms, and keeps the value when the unit changes', () => {
    const onChange = vi.fn()
    render(<LoadField initialKg={10} onChange={onChange} />)
    const input = screen.getByLabelText('Weight held')
    expect(input).toHaveValue(10)
    fireEvent.change(input, { target: { value: '12' } })
    expect(onChange).toHaveBeenLastCalledWith(12)
    fireEvent.click(screen.getByRole('button', { name: 'lb' }))
    expect(input).toHaveValue(26.5)
    fireEvent.change(input, { target: { value: '30' } })
    expect(onChange).toHaveBeenLastCalledWith(13.6)
    expect(localStorage.getItem('arc.loadUnit')).toBe('lb')
  })
})
