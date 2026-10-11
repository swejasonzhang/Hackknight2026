import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'

// The 3D scenes need WebGL; here each stands in as its label.
vi.mock('../components/three/lazy', () => ({
  LazyJointScene: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
  LazyProgressScene: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
  SceneBoundary: ({ children }: { children: ReactNode }) => children,
}))
const { LandingPage } = await import('./LandingPage')

describe('LandingPage', () => {
  it('leads every logo back to the landing page, the footer one included', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Every rep,\s*in degrees/)
    expect(screen.getByRole('link', { name: 'Arc home page' })).toHaveAttribute('href', '/')
    // The title block's wordmark too.
    expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/').length).toBeGreaterThanOrEqual(2)
  })
})
