import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CameraLauncher, LAUNCHER_URL } from './CameraLauncher'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('CameraLauncher', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('explains the camera app and opens it through the launcher on this computer', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(url.endsWith('/status') ? json({ ok: true, app: 'arc-camera-launcher' }) : json({ opened: true }, 202)))
    vi.stubGlobal('fetch', fetchMock)
    render(<CameraLauncher />)

    expect(screen.getByRole('heading', { name: 'Record a session' })).toBeInTheDocument()
    expect(screen.getByText(/opens your webcam/i)).toBeInTheDocument()
    expect(await screen.findByText(/launcher connected/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open the camera app' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/new terminal window/i)
    const [url, init] = fetchMock.mock.calls.find(([u]) => u.endsWith('/open'))! as unknown as [string, RequestInit]
    expect(url).toBe(`${LAUNCHER_URL}/open`)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-Arc-Launcher']).toBe('1')
  })

  it('shows how to start the launcher when it is not running', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    render(<CameraLauncher />)
    expect(await screen.findByText(/launcher not running/i)).toBeInTheDocument()
    expect(screen.getByText('cd computer-vision && uv run launcher.py')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open the camera app' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/start the launcher/i)
  })
})
