import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthForm } from './AuthForm'

describe('AuthForm', () => {
  it('signup mode collects name, email and password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AuthForm mode="signup" onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct horse battery' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada', email: 'ada@example.com', password: 'correct horse battery' }))
  })

  it('login mode has no name field and submits email and password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AuthForm mode="login" onSubmit={onSubmit} />)
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret-pass' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'secret-pass' }))
  })

  it('shows the error when submission fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Invalid email or password'))
    render(<AuthForm mode="login" onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })
})
