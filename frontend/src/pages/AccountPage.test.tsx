import { EMAIL_REQUIREMENT } from '@arc/dependencies'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteAccount = vi.fn()
const logout = vi.fn()
const user = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', createdAt: Date.UTC(2026, 9, 1) }
vi.mock('../api/client', () => ({ api: { auth: { deleteAccount: (input: unknown) => deleteAccount(input) } } }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user, logout, status: 'signedIn' }) }))
const { AccountPage } = await import('./AccountPage')

function Landing() {
  const state = useLocation().state as { notice?: string } | null
  return <p>landing: {state?.notice}</p>
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<AccountPage />} />
        <Route path="/" element={<Landing />} />
      </Routes>
    </MemoryRouter>,
  )
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const deleteButton = () => screen.getByRole('button', { name: /delete account/i })
const fillAll = () => {
  type(/^email/i, 'ada@example.com')
  type(/^password/i, 'correct horse battery')
  type(/^type delete/i, 'DELETE')
}

describe('AccountPage', () => {
  beforeEach(() => {
    deleteAccount.mockReset()
    logout.mockReset()
  })

  it('shows who is signed in and lets them log out', () => {
    renderPage()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(logout).toHaveBeenCalled()
  })

  it('holds deletion until the email, password and DELETE are all entered', () => {
    renderPage()
    expect(screen.getByLabelText(/^email/i)).toHaveAccessibleDescription(EMAIL_REQUIREMENT)
    expect(deleteButton()).toBeDisabled()
    type(/^email/i, 'ada@example.com')
    type(/^password/i, 'correct horse battery')
    expect(deleteButton()).toBeDisabled()
    type(/^type delete/i, 'delete')
    expect(deleteButton()).toBeDisabled()
    type(/^type delete/i, 'DELETE')
    expect(deleteButton()).toBeEnabled()
  })

  it("says so when the email is not this account's", () => {
    renderPage()
    type(/^email/i, 'grace@example.com')
    fireEvent.blur(screen.getByLabelText(/^email/i))
    expect(screen.getByText('Use the email address on this account.')).toBeInTheDocument()
    type(/^password/i, 'correct horse battery')
    type(/^type delete/i, 'DELETE')
    expect(deleteButton()).toBeDisabled()
  })

  it('deletes with the credentials, signs out and lands on the home page with a notice', async () => {
    deleteAccount.mockResolvedValue(null)
    renderPage()
    fillAll()
    fireEvent.click(deleteButton())
    expect(await screen.findByText(/landing: your account and everything in it/i)).toBeInTheDocument()
    expect(deleteAccount).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'correct horse battery', confirm: 'DELETE' })
    expect(logout).toHaveBeenCalled()
  })

  it('keeps the member signed in and shows the reason when the server refuses, without echoing the password', async () => {
    deleteAccount.mockRejectedValue(new Error('That email and password do not match this account'))
    renderPage()
    fillAll()
    fireEvent.click(deleteButton())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('That email and password do not match this account')
    expect(alert).not.toHaveTextContent('correct horse battery')
    expect(logout).not.toHaveBeenCalled()
    expect(deleteButton()).toBeEnabled()
  })
})
