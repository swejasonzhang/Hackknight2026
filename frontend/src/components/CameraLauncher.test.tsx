import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CameraLauncher, LAUNCHER_URL } from './CameraLauncher'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const PLAN = { exercise: 'shoulder_abduction' as const, side: 'left' as const, sets: 2, reps: 10, restSeconds: 60, targetDeg: 160 }

describe('CameraLauncher', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('starts the camera app straight into the plan, with nothing to answer', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(url.endsWith('/status') ? json({ ok: true, app: 'arc-camera-launcher' }) : json({ opened: true }, 202)))
    vi.stubGlobal('fetch', fetchMock)
    render(<CameraLauncher plan={PLAN} exercise="elbow_flexion" />)

    expect(screen.getByRole('heading', { name: 'Record a session' })).toBeInTheDocument()
    expect(screen.getByText(/shoulder abduction · left · 2 × 10 · 60 s rest/i)).toBeInTheDocument()
    expect(screen.getByText(/opens your webcam/i)).toBeInTheDocument()
    expect(await screen.findByText(/launcher connected/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open the camera app' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/webcam window opens/i)
    const [url, init] = fetchMock.mock.calls.find(([u]) => u.endsWith('/open'))! as unknown as [string, RequestInit]
    expect(url).toBe(`${LAUNCHER_URL}/open`)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-Arc-Launcher']).toBe('1')
    expect(JSON.parse(init.body as string)).toEqual({ exercise: 'shoulder_abduction', side: 'left', sets: 2, reps: 10, restSeconds: 60 })
  })

  it('without a plan, starts the movement on screen at 3 × 8 with 45 s rest', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(url.endsWith('/status') ? json({ ok: true }) : json({ opened: true }, 202)))
    vi.stubGlobal('fetch', fetchMock)
    render(<CameraLauncher plan={null} exercise="seated_knee_extension" />)
    expect(screen.getByText(/seated knee extension · right · 3 × 8 · 45 s rest/i)).toBeInTheDocument()
    await screen.findByText(/launcher connected/i)
    fireEvent.click(screen.getByRole('button', { name: 'Open the camera app' }))
    await screen.findByRole('status')
    const [, init] = fetchMock.mock.calls.find(([u]) => u.endsWith('/open'))! as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ exercise: 'seated_knee_extension', side: 'right', sets: 3, reps: 8, restSeconds: 45 })
  })

  it('shows how to start the launcher when it is not running', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    render(<CameraLauncher plan={null} exercise="elbow_flexion" />)
    expect(await screen.findByText(/launcher not running/i)).toBeInTheDocument()
    expect(screen.getByText('cd computer-vision && uv run launcher.py')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open the camera app' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/start the launcher/i)
  })
})
