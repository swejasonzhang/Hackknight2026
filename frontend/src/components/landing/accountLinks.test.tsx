import { render, screen } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../auth/AuthContext'
import { clearToken, setToken } from '../../auth/token'
import { useAccountLinks } from './accountLinks'

function Links() {
  return (
    <>
      {useAccountLinks().map((l) => (
        <Link key={l.to} to={l.to}>
          {l.label}
        </Link>
      ))}
    </>
  )
}

const renderLinks = () =>
  render(
    <AuthProvider>
      <MemoryRouter>
        <Links />
      </MemoryRouter>
    </AuthProvider>,
  )

describe('the landing page account links', () => {
  beforeEach(() => clearToken())
  afterEach(() => vi.unstubAllGlobals())

  it('invite a visitor to create an account or log in', () => {
    vi.stubGlobal('fetch', vi.fn())
    renderLinks()
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/signup')
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  })

  it('take a signed-in user back into the app', async () => {
    setToken('valid')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'u1', name: 'Ada', email: 'ada@example.com', createdAt: 1 }), { status: 200 })))
    renderLinks()
    expect(await screen.findByRole('link', { name: 'Open dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Profiles' })).toHaveAttribute('href', '/profiles')
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
  })
})
