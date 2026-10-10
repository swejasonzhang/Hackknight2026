import { EXERCISES, type ExerciseId, type PlanInput } from '@arc/dependencies'
import { useCallback, useEffect, useId, useState } from 'react'
import { Lamp, type Tone } from './ui'

/** Where the camera launcher listens (computer-vision/launcher.py); this computer only. */
export const LAUNCHER_URL = (import.meta.env.VITE_CAMERA_LAUNCHER_URL as string | undefined) ?? 'http://127.0.0.1:8765'
const START_COMMAND = 'cd computer-vision && uv run launcher.py'

type Launcher = 'checking' | 'connected' | 'offline'
/** What the camera app starts into: the plan's fields the launcher accepts. */
type CameraPlan = Pick<PlanInput, 'exercise' | 'side' | 'sets' | 'reps' | 'restSeconds'>
/** Without a saved plan: the movement on screen, right side, 3 sets of 8, 45 s rest. */
const DEFAULTS = { side: 'right', sets: 3, reps: 8, restSeconds: 45 } as const
type Attempt = { kind: 'idle' } | { kind: 'opening' } | { kind: 'opened' } | { kind: 'failed'; message: string }

const STATUS: Record<Launcher, { text: string; tone: Tone }> = {
  checking: { text: 'Looking for the launcher…', tone: 'default' },
  connected: { text: 'Launcher connected', tone: 'good' },
  offline: { text: 'Launcher not running', tone: 'default' },
}

async function launcherFetch(path: string, init: RequestInit = {}, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(`${LAUNCHER_URL}${path}`, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function useIsPhone(): boolean {
  const query = '(max-width: 639px)'
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const update = () => setPhone(m.matches)
    m.addEventListener?.('change', update)
    return () => m.removeEventListener?.('change', update)
  }, [])
  return phone
}

/**
 * The dashboard's way into the camera app. The camera app is the Python program in
 * computer-vision/ that runs on the computer with the webcam; a web page cannot start a program
 * by itself, so a small launcher (computer-vision/launcher.py) listens on 127.0.0.1 and, when this
 * button sends the plan, starts the camera app straight into it: no prompts, the webcam window
 * opens and counting begins. Without a saved plan it starts the movement on screen at 3 × 8.
 * When the launcher is not running, the panel shows the one command that starts it. On a phone it
 * explains where to open it instead.
 */
export function CameraLauncher({ plan, exercise }: { plan: CameraPlan | null; exercise: ExerciseId }) {
  const titleId = useId()
  const phone = useIsPhone()
  const [launcher, setLauncher] = useState<Launcher>('checking')
  const [attempt, setAttempt] = useState<Attempt>({ kind: 'idle' })

  const check = useCallback(async () => {
    setLauncher('checking')
    try {
      const res = await launcherFetch('/status', { headers: { 'X-Arc-Launcher': '1' } })
      setLauncher(res.ok ? 'connected' : 'offline')
    } catch {
      setLauncher('offline')
    }
  }, [])

  useEffect(() => {
    if (phone) return
    void check()
    // Look again when the person comes back to the tab, for instance after starting the launcher.
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [check, phone])

  const start: CameraPlan = plan ? { exercise: plan.exercise, side: plan.side, sets: plan.sets, reps: plan.reps, restSeconds: plan.restSeconds } : { exercise, ...DEFAULTS }
  const summary = `${EXERCISES[start.exercise].name} · ${start.side} · ${start.sets} × ${start.reps} · ${start.restSeconds} s rest`

  const open = async () => {
    setAttempt({ kind: 'opening' })
    try {
      const res = await launcherFetch('/open', { method: 'POST', headers: { 'X-Arc-Launcher': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(start) })
      setLauncher('connected')
      if (res.ok || res.status === 429) setAttempt({ kind: 'opened' })
      else {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setAttempt({ kind: 'failed', message: body.error ?? `The launcher answered ${res.status}.` })
      }
    } catch {
      setLauncher('offline')
      setAttempt({ kind: 'failed', message: 'Start the launcher on this computer first, then press the button again.' })
    }
  }

  const status = STATUS[launcher]

  return (
    <section aria-labelledby={titleId} className="panel mb-6 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6">
        <div className="min-w-0">
          <div className="t-label flex items-center gap-2">
            <Lamp tone={phone ? 'default' : status.tone} blink={!phone && launcher === 'checking'} />
            Camera app{phone ? '' : ` · ${status.text}`}
          </div>
          <h2 id={titleId} className="t-strip mt-2">
            Record a session
          </h2>
          <p className="t-desc mt-1 max-w-[62ch]">
            Arc's camera app runs on the laptop or desktop with the webcam. One press starts it straight into your plan, with nothing to answer: it opens your webcam, finds the joints of the movement (shoulder, elbow and wrist, or hip, knee and ankle), measures every rep in degrees, counts your sets and times the rest.
          </p>
          <p className="t-meta mt-3 text-navy">
            {plan ? 'Plan' : 'No plan yet'} · <span className="normal-case">{summary}</span>
          </p>
          {phone && <p className="t-desc mt-2 max-w-[62ch]">Open Arc on that computer to start it from here.</p>}
          {!phone && launcher === 'offline' && (
            <div className="mt-3">
              <p className="t-desc">Start the launcher once on this computer, and leave its window open:</p>
              <code className="mt-2 block border border-rule bg-vellum px-3 py-2 font-mono text-[12.5px] break-all text-navy">{START_COMMAND}</code>
            </div>
          )}
          {attempt.kind === 'opened' && (
            <p role="status" className="t-mono mt-3 flex items-center gap-2 text-ok">
              <Lamp tone="good" /> OK · Starting. The webcam window opens in a moment and counting begins.
            </p>
          )}
          {attempt.kind === 'failed' && (
            <p role="alert" className="t-mono mt-3 flex items-center gap-2 text-bad">
              <Lamp tone="bad" /> {attempt.message}
            </p>
          )}
        </div>
        {!phone && (
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
            <button type="button" className="btn btn-block" onClick={open} disabled={attempt.kind === 'opening'}>
              <Lamp tone="primary" blink={attempt.kind === 'opening'} />
              Open the camera app
            </button>
            {launcher === 'offline' && (
              <button type="button" className="btn" onClick={() => void check()}>
                Check again
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
