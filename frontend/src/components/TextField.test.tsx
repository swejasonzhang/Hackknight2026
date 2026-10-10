import { emailProblem, EMAIL_REQUIREMENT, nameProblem, NAME_REQUIREMENT } from '@arc/dependencies'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { TextField } from './TextField'

function Harness({ kind, optional = false }: { kind: 'name' | 'email'; optional?: boolean }) {
  const [value, setValue] = useState('')
  return (
    <TextField
      label={kind === 'name' ? 'Name' : 'Email'}
      value={value}
      onChange={setValue}
      requirement={kind === 'name' ? NAME_REQUIREMENT : EMAIL_REQUIREMENT}
      problem={kind === 'name' ? nameProblem : emailProblem}
      optional={optional}
      type={kind === 'email' ? 'email' : 'text'}
    />
  )
}

describe('TextField', () => {
  it('says what the field needs before anything is typed', () => {
    render(<Harness kind="name" />)
    const input = screen.getByLabelText('Name')
    expect(screen.getByText(NAME_REQUIREMENT)).toBeInTheDocument()
    expect(input).toHaveAccessibleDescription(NAME_REQUIREMENT)
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('names the exact problem once the field is left, and clears it when fixed', () => {
    render(<Harness kind="name" />)
    const input = screen.getByLabelText('Name')
    fireEvent.change(input, { target: { value: 'Ada99' } })
    expect(screen.queryByText('Use only letters, spaces, apostrophes, hyphens or periods.')).not.toBeInTheDocument()
    fireEvent.blur(input)
    expect(screen.getByText('Use only letters, spaces, apostrophes, hyphens or periods.')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(input, { target: { value: 'Ada' } })
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.getByText(NAME_REQUIREMENT)).toBeInTheDocument()
  })

  it('checks email addresses the way the server does', () => {
    render(<Harness kind="email" />)
    const input = screen.getByLabelText('Email')
    fireEvent.change(input, { target: { value: 'ada@' } })
    fireEvent.blur(input)
    expect(screen.getByText('Enter a valid email address, like name@example.com.')).toBeInTheDocument()
  })

  it('lets an optional field stay empty', () => {
    render(<Harness kind="email" optional />)
    const input = screen.getByLabelText(/Email/)
    fireEvent.blur(input)
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.getByText(/optional/i)).toBeInTheDocument()
  })
})
