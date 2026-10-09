import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthContext'
import { PublicOnly, RequireAuth } from './RequireAuth'
import { clearToken, setToken } from './token'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function app(initialPath: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <p>dashboard</p>
              </RequireAuth>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnly>
                <p>signup page</p>
              </PublicOnly>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('route guards', () => {
  beforeEach(() => clearToken())
  afterEach(() => vi.unstubAllGlobals())

  it('sends a visitor without a token to /signup', async () => {
    vi.stubGlobal('fetch', vi.fn())
    app('/')
    expect(await screen.findByText('signup page')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('lets a valid token through once /api/auth/me confirms it', async () => {
    setToken('valid')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 'u1', name: 'Ada', email: 'ada@example.com', createdAt: 1 })))
    app('/')
    expect(await screen.findByText('dashboard')).toBeInTheDocument()
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe('/api/auth/me')
  })

  it('sends a visitor with a stale token to /signup', async () => {
    setToken('stale')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Not signed in' }, 401)))
    app('/')
    expect(await screen.findByText('signup page')).toBeInTheDocument()
  })

  it('keeps a signed-in user away from /signup', async () => {
    setToken('valid')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 'u1', name: 'Ada', email: 'ada@example.com', createdAt: 1 })))
    app('/signup')
    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })
})
