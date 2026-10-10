import { EMAIL_REQUIREMENT, NAME_REQUIREMENT } from '@arc/dependencies'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthForm } from './AuthForm'

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const blur = (label: RegExp) => fireEvent.blur(screen.getByLabelText(label))

describe('AuthForm (sign up)', () => {
  it('collects name, email, password and confirmation and submits once everything is valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AuthForm mode="signup" onSubmit={onSubmit} />)
    const button = screen.getByRole('button', { name: /create account/i })
    expect(button).toBeDisabled()
    type(/^name/i, 'Ada')
    type(/^email/i, 'ada@example.com')
    type(/^password/i, 'correct horse battery')
    type(/confirm password/i, 'correct horse battery')
    expect(button).toBeEnabled()
    fireEvent.click(button)
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada', email: 'ada@example.com', password: 'correct horse battery' }))
    expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty('confirmPassword')
  })

  it('shows and hides the password without changing it, with an accessible toggle that does not submit', () => {
    const onSubmit = vi.fn()
    render(<AuthForm mode="signup" onSubmit={onSubmit} />)
    const password = screen.getByLabelText(/^password/i) as HTMLInputElement
    type(/^password/i, 'secret-phrase-1')
    expect(password.type).toBe('password')
    const toggle = screen.getAllByRole('button', { name: /show password/i })[0]!
    expect(toggle).toHaveAttribute('type', 'button')
    fireEvent.click(toggle)
    expect(password.type).toBe('text')
    expect(password.value).toBe('secret-phrase-1')
    expect(screen.getAllByRole('button', { name: /hide password/i })[0]).toBe(toggle)
    fireEvent.click(toggle)
    expect(password.type).toBe('password')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('gives the confirmation field its own independent toggle', () => {
    render(<AuthForm mode="signup" onSubmit={vi.fn()} />)
    const password = screen.getByLabelText(/^password/i) as HTMLInputElement
    const confirm = screen.getByLabelText(/confirm password/i) as HTMLInputElement
    const toggles = screen.getAllByRole('button', { name: /show password/i })
    expect(toggles).toHaveLength(2)
    fireEvent.click(toggles[1]!)
    expect(confirm.type).toBe('text')
    expect(password.type).toBe('password')
  })

  it('flags a mismatch inline, ties the message to the field, and blocks submission', async () => {
    const onSubmit = vi.fn()
    render(<AuthForm mode="signup" onSubmit={onSubmit} />)
    type(/^name/i, 'Ada')
    type(/^email/i, 'ada@example.com')
    type(/^password/i, 'correct horse battery')
    type(/confirm password/i, 'correct horse')
    const confirm = screen.getByLabelText(/confirm password/i)
    const message = screen.getByText(/passwords do not match/i)
    expect(confirm).toHaveAttribute('aria-invalid', 'true')
    expect(confirm.getAttribute('aria-describedby')).toContain(message.id)
    const button = screen.getByRole('button', { name: /create account/i })
    expect(button).toBeDisabled()
    fireEvent.submit(button.closest('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
    // fixing the confirmation clears the message and shows the match indicator
    type(/confirm password/i, 'correct horse battery')
    expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument()
    expect(screen.getByText(/passwords match/i)).toBeInTheDocument()
    expect(button).toBeEnabled()
  })

  it('explains the password rule and flags a short password and a bad email after the field is left', () => {
    render(<AuthForm mode="signup" onSubmit={vi.fn()} />)
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    type(/^password/i, 'short')
    blur(/^password/i)
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('aria-invalid', 'true')
    type(/^email/i, 'not-an-email')
    blur(/^email/i)
    expect(screen.getByText(/valid email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it('states the name and email requirements up front and holds the form until both are met', () => {
    render(<AuthForm mode="signup" onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/^name/i)).toHaveAccessibleDescription(NAME_REQUIREMENT)
    expect(screen.getByLabelText(/^email/i)).toHaveAccessibleDescription(EMAIL_REQUIREMENT)
    type(/^name/i, 'Ada99')
    blur(/^name/i)
    type(/^email/i, 'ada@example.com')
    type(/^password/i, 'correct horse battery')
    type(/confirm password/i, 'correct horse battery')
    expect(screen.getByText('Use only letters, spaces, apostrophes, hyphens or periods.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^name/i)).toHaveAttribute('aria-invalid', 'true')
    const button = screen.getByRole('button', { name: /create account/i })
    expect(button).toBeDisabled()
    type(/^name/i, "Ada O'Brien")
    expect(button).toBeEnabled()
  })

  it('trims the name and email it submits', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AuthForm mode="signup" onSubmit={onSubmit} />)
    type(/^name/i, '  Ada  ')
    type(/^email/i, ' ada@example.com ')
    type(/^password/i, 'correct horse battery')
    type(/confirm password/i, 'correct horse battery')
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada', email: 'ada@example.com', password: 'correct horse battery' }))
  })

  it('shows a loading state and ignores a second click while submitting', async () => {
    let resolve!: () => void
    const onSubmit = vi.fn().mockImplementation(() => new Promise<void>((r) => (resolve = r)))
    render(<AuthForm mode="signup" onSubmit={onSubmit} />)
    type(/^name/i, 'Ada')
    type(/^email/i, 'ada@example.com')
    type(/^password/i, 'correct horse battery')
    type(/confirm password/i, 'correct horse battery')
    const button = screen.getByRole('button', { name: /create account/i })
    fireEvent.click(button)
    expect(await screen.findByRole('button', { name: /creating/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /creating/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    resolve()
  })

  it('uses the right autocomplete hints', () => {
    render(<AuthForm mode="signup" onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('autocomplete', 'new-password')
  })
})

describe('AuthForm (log in)', () => {
  it('has no name or confirmation field and submits email and password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AuthForm mode="login" onSubmit={onSubmit} />)
    expect(screen.queryByLabelText(/^name/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument()
    type(/^email/i, 'ada@example.com')
    type(/^password/i, 'secret-pass')
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'secret-pass' }))
  })

  it('states the email requirement on log in too', () => {
    render(<AuthForm mode="login" onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/^email/i)).toHaveAccessibleDescription(EMAIL_REQUIREMENT)
    type(/^email/i, 'ada@')
    type(/^password/i, 'secret-pass')
    expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled()
  })

  it('shows the server error and keeps the entered values when submission fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Invalid email or password'))
    render(<AuthForm mode="login" onSubmit={onSubmit} />)
    type(/^email/i, 'ada@example.com')
    type(/^password/i, 'wrong-pass')
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(screen.getByLabelText(/^email/i)).toHaveValue('ada@example.com')
    expect(screen.getByLabelText(/^password/i)).toHaveValue('wrong-pass')
    expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled()
  })
})
