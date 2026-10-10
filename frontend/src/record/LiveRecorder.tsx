import { EXERCISES, type CoachStatus, type ExerciseId, type SessionPlan, type Side, type VoiceCommand } from '@arc/dependencies'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Lamp, StatTile } from '../components/ui'
import { deg } from '../format'
import { readJoint, type JointReading, type Landmark } from './angle'
import type { PoseTracker } from './pose'
import { SessionRecorder, type RecorderView } from './recorder'
import { COMMAND_LABEL, parseCommand } from '../voice/commands'
import { createListener, type Listener, type ListenerState } from '../voice/listener'
import { createSpeaker, type Speaker, type SpokenLine } from '../voice/speaker'

export interface RecordConfig {
  exercise: ExerciseId
  side: Side
  plan: SessionPlan
}

type Status = { kind: 'camera' } | { kind: 'model' } | { kind: 'live' } | { kind: 'saving' } | { kind: 'empty' } | { kind: 'error'; message: string }

/** The body's outline drawn faintly under the tracked joint (MediaPipe landmark pairs). */
const OUTLINE: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
]
const JOINT_NAMES: Record<ExerciseId, string> = {
  elbow_flexion: 'shoulder, elbow and wrist',
  shoulder_abduction: 'hip, shoulder and elbow',
  seated_knee_extension: 'hip, knee and ankle',
}

/** Short spoken acknowledgements, so a hands-free member knows Arc heard them. */
const ACK: Partial<Record<VoiceCommand, string>> = { start: 'Starting.', pause: 'Paused.', resume: 'Back to it.', skip: 'Skipping.', rest: 'Rest.', stop: 'Finishing up.' }
const HANDS_FREE_KEY = 'arc.handsFree'
const readHandsFree = () => {
  try {
    return localStorage.getItem(HANDS_FREE_KEY) !== 'off'
  } catch {
    return true
  }
}

function statusText(view: RecorderView | null, cfg: RecordConfig): string {
  if (!view || view.phase === 'waiting') return `Waiting for your ${JOINT_NAMES[cfg.exercise]} to be in view.`
  if (view.phase === 'rest') return `Resting. Set ${view.setNumber + 1} of ${view.setsPlanned} starts in ${Math.ceil(view.restLeftMs / 1000)} seconds.`
  const best = view.bestDeg != null ? ` Best rep ${Math.round(view.bestDeg)} degrees.` : ''
  return `Set ${view.setNumber} of ${view.setsPlanned}. ${view.repsInSet} of ${view.repsPlanned} reps.${best}${view.paused ? ' Paused.' : ''}`
}

function cameraError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was blocked. Allow the camera for this site in the browser (the camera icon in the address bar), then try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found. Connect a webcam, then try again.'
  if (name === 'NotReadableError') return 'The camera is busy in another app. Close it there, then try again.'
  return 'The camera could not start. Try again.'
}

/** Where the video sits inside the stage under object-contain, so landmarks land on it. */
function fit(stageW: number, stageH: number, videoAspect: number) {
  const w = stageW / stageH > videoAspect ? stageH * videoAspect : stageW
  const h = w / videoAspect
  return { x: (stageW - w) / 2, y: (stageH - h) / 2, w, h }
}

function draw(canvas: HTMLCanvasElement, aspect: number, landmarks: Landmark[] | null, reading: JointReading) {
  const dpr = window.devicePixelRatio || 1
  const { clientWidth: cw, clientHeight: ch } = canvas
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr)
    canvas.height = Math.round(ch * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cw, ch)
  if (!landmarks) return
  const box = fit(cw, ch, aspect)
  const px = (p: { x: number; y: number }) => [box.x + p.x * box.w, box.y + p.y * box.h] as const
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 2
  for (const [a, b] of OUTLINE) {
    const p = landmarks[a]
    const q = landmarks[b]
    if (!p || !q || (p.visibility ?? 1) < 0.5 || (q.visibility ?? 1) < 0.5) continue
    ctx.beginPath()
    ctx.moveTo(...px(p))
    ctx.lineTo(...px(q))
    ctx.stroke()
  }
  if (!reading.tracked || !reading.points) return
  const [base, mid, end] = reading.points.map(([x, y]) => px({ x, y }))
  ctx.strokeStyle = '#0b3dff'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(...base!)
  ctx.lineTo(...mid!)
  ctx.lineTo(...end!)
  ctx.stroke()
  // The angle at the joint, as a goniometer arc.
  const a0 = Math.atan2(base![1] - mid![1], base![0] - mid![0])
  const a1 = Math.atan2(end![1] - mid![1], end![0] - mid![0])
  let sweep = a1 - a0
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  while (sweep < -Math.PI) sweep += 2 * Math.PI
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(11,61,255,0.85)'
  ctx.beginPath()
  ctx.arc(mid![0], mid![1], 34, a0, a0 + sweep, sweep < 0)
  ctx.stroke()
  for (const [x, y] of [base!, mid!, end!]) {
    ctx.fillStyle = '#0b1b3a'
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, 2 * Math.PI)
    ctx.fill()
    ctx.strokeStyle = '#0b3dff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, 12, 0, 2 * Math.PI)
    ctx.stroke()
  }
}

/**
 * Recording in the browser, with nothing to press: the camera starts as soon as this opens, the
 * pose model loads, and counting begins once the movement's joints are in view. The plan's sets
 * and rests run by themselves; after the last set (or "Finish and save") the session is saved
 * as the signed-in user and its report opens. The video stays in the browser.
 */
export function LiveRecorder({ profileId, config, simulate = false }: { profileId: string; config: RecordConfig; simulate?: boolean }) {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recorderRef = useRef<SessionRecorder | null>(null)
  const savingRef = useRef(false)
  const [status, setStatus] = useState<Status>({ kind: 'camera' })
  const [view, setView] = useState<RecorderView | null>(null)
  const [aspect, setAspect] = useState(16 / 9)
  const [attempt, setAttempt] = useState(0)
  const cfg = EXERCISES[config.exercise]

  // Arc: hands-free listening, and Arc's voice for set reads and quick replies.
  const coachRef = useRef<CoachStatus | null>(null)
  const speakerRef = useRef<Speaker | null>(null)
  const listenerRef = useRef<Listener | null>(null)
  const lastLineRef = useRef<SpokenLine | null>(null)
  const viewRef = useRef<RecorderView | null>(null)
  const [handsFree, setHandsFree] = useState(readHandsFree)
  const [listenState, setListenState] = useState<ListenerState>('off')
  const [heard, setHeard] = useState<VoiceCommand | null>(null)
  const [arcLine, setArcLine] = useState<SpokenLine | null>(null)
  const [arcSpeaking, setArcSpeaking] = useState(false)

  const say = useCallback((line: SpokenLine, remember = true) => {
    if (remember) {
      lastLineRef.current = line
      setArcLine(line)
    }
    void speakerRef.current?.say(line)
  }, [])

  const runCommand = useCallback(
    (command: VoiceCommand) => {
      const recorder = recorderRef.current
      if (!recorder) return
      setHeard(command)
      if (command === 'status') return say({ text: statusText(viewRef.current, config) }, false)
      if (command === 'repeat') return lastLineRef.current && say(lastLineRef.current, false)
      const next = recorder.command(command, performance.timeOrigin + performance.now())
      viewRef.current = next
      setView(next)
      if (ACK[command] && command !== 'stop') void speakerRef.current?.say({ text: ACK[command]! })
    },
    [config, say],
  )

  useEffect(() => {
    let cancelled = false
    api.coach
      .status()
      .then((s) => !cancelled && (coachRef.current = s))
      .catch(() => !cancelled && (coachRef.current = { gemini: false, voice: false }))
    speakerRef.current = createSpeaker({
      elevenLabs: () => coachRef.current?.voice ?? false,
      onSpeaking: (speaking) => {
        setArcSpeaking(speaking)
        listenerRef.current?.mute(speaking)
      },
    })
    listenerRef.current = createListener((text) => {
      const command = parseCommand(text)
      if (command) runCommand(command)
    }, setListenState)
    return () => {
      cancelled = true
      listenerRef.current?.stop()
      speakerRef.current?.stop()
    }
  }, [runCommand])

  const save = useCallback(async () => {
    if (savingRef.current) return
    savingRef.current = true
    const input = recorderRef.current?.toSessionInput(profileId)
    if (!input) {
      setStatus({ kind: 'empty' })
      return
    }
    setStatus({ kind: 'saving' })
    try {
      const session = await api.sessions.create(input)
      listenerRef.current?.stop()
      navigate(`/sessions/${session.id}`, { state: { from: '/dashboard', label: 'Dashboard', arcRead: true } })
    } catch (err) {
      savingRef.current = false
      setStatus({ kind: 'error', message: err instanceof Error ? `The session could not be saved: ${err.message}` : 'The session could not be saved.' })
    }
  }, [navigate, profileId])

  useEffect(() => {
    let cancelled = false
    let raf = 0
    let stream: MediaStream | null = null
    let tracker: PoseTracker | null = null
    savingRef.current = false
    recorderRef.current = new SessionRecorder(config)
    setView(recorderRef.current.view)

    const run = async () => {
      setStatus({ kind: 'camera' })
      if (!simulate) {
        if (!navigator.mediaDevices?.getUserMedia) {
          setStatus({ kind: 'error', message: 'The camera needs a secure page (https, or localhost while developing). Open Arc at its https address.' })
          return
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        } catch (err) {
          if (!cancelled) setStatus({ kind: 'error', message: cameraError(err) })
          return
        }
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        const video = videoRef.current!
        video.srcObject = stream
        await video.play().catch(() => {})
        if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight)
      }
      setStatus({ kind: 'model' })
      try {
        tracker = simulate
          ? (await import('./simulated')).createSimulatedTracker(config.exercise, config.side, Math.min(config.plan.targetDeg - 8, 170))
          : await (await import('./pose')).createPoseTracker()
      } catch {
        if (!cancelled) setStatus({ kind: 'error', message: 'The pose model could not load. Check the internet connection, then try again.' })
        return
      }
      if (cancelled) return tracker.close()
      setStatus({ kind: 'live' })

      let lastVideoTime = -1
      let lastKey = ''
      let setsRead = 0
      const frame = () => {
        if (cancelled) return
        raf = requestAnimationFrame(frame)
        const video = videoRef.current
        const recorder = recorderRef.current
        if (!recorder || !tracker) return
        if (!simulate) {
          if (!video || video.readyState < 2 || video.currentTime === lastVideoTime) return
          lastVideoTime = video.currentTime
        }
        const now = performance.now()
        const videoAspect = !simulate && video?.videoWidth ? video.videoWidth / video.videoHeight : 16 / 9
        const landmarks = tracker.detect(video!, now)
        const reading = readJoint(landmarks, config.exercise, config.side, videoAspect)
        const next = recorder.feed({ tracked: reading.tracked, metricDeg: reading.metricDeg, tMs: performance.timeOrigin + now })
        if (canvasRef.current) draw(canvasRef.current, videoAspect, landmarks, reading)
        // Re-render only when something on screen changes.
        const key = `${next.phase}|${next.setNumber}|${next.repsInSet}|${next.totalReps}|${Math.round(next.metricDeg ?? -1)}|${Math.ceil(next.restLeftMs / 1000)}|${next.tracked}|${Math.round(next.bestDeg ?? -1)}`
        viewRef.current = next
        if (key !== lastKey) {
          lastKey = key
          setView(next)
        }
        // A set just ended and the rest began: Arc reads it back (Gemini words, ElevenLabs voice).
        const finished = recorder.completedSets
        if (finished.length > setsRead) {
          setsRead = finished.length
          const set = finished.at(-1)!
          if (next.phase === 'rest') {
            api.coach
              .setFeedback({ profileId, exercise: config.exercise, side: config.side, plan: config.plan, setNumber: set.setNumber, reps: set.reps })
              .then((m) => !cancelled && say({ id: m.id, text: m.text }))
              .catch(() => {})
          }
        }
        if (next.phase === 'done') {
          cancelAnimationFrame(raf)
          void save()
        }
      }
      raf = requestAnimationFrame(frame)
    }
    void run()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      tracker?.close()
    }
    // A new attempt (Try again) restarts everything.
  }, [config, simulate, save, attempt, profileId, say])

  // Listen while live, when hands-free is on.
  useEffect(() => {
    if (status.kind === 'live' && handsFree) listenerRef.current?.start()
    else listenerRef.current?.stop()
  }, [status.kind, handsFree])

  const toggleHandsFree = () => {
    setHandsFree((on) => {
      try {
        localStorage.setItem(HANDS_FREE_KEY, on ? 'off' : 'on')
      } catch {
        /* per-viewer convenience only */
      }
      return !on
    })
  }

  const finish = () => {
    runCommand('stop')
    void save()
  }

  const live = status.kind === 'live'
  const phase = view?.phase ?? 'waiting'
  const restSeconds = Math.ceil((view?.restLeftMs ?? 0) / 1000)
  const statusLine =
    status.kind === 'camera'
      ? 'Starting the camera…'
      : status.kind === 'model'
        ? 'Loading the pose model…'
        : status.kind === 'saving'
          ? 'Saving the session…'
          : view?.paused
            ? 'Paused · say "resume"'
            : phase === 'waiting'
            ? `Looking for your ${JOINT_NAMES[config.exercise]}`
            : phase === 'rest'
              ? `Rest · set ${(view?.setNumber ?? 1) + 1} starts by itself`
              : phase === 'done'
                ? 'All sets done'
                : view?.tracked
                  ? 'Counting'
                  : `Lost your ${JOINT_NAMES[config.exercise]}`

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
      <div className="min-w-0">
        <div className="relative w-full overflow-hidden bg-navy" style={{ aspectRatio: aspect }}>
          {/* Mirrored, like a mirror: the overlay is drawn in video coordinates and mirrored with it. */}
          <video ref={videoRef} className="absolute inset-0 h-full w-full -scale-x-100 object-contain" playsInline muted aria-label={`Your camera, tracking ${JOINT_NAMES[config.exercise]}`} />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100" aria-hidden="true" />

          <span className="callout z-10 top-3 left-3">
            {cfg.name} · {config.side}
          </span>
          <span className="callout z-10 top-3 right-3 flex items-center gap-2">
            <Lamp tone={live && view?.tracked ? 'good' : 'default'} blink={!live || phase === 'waiting'} /> {statusLine}
          </span>

          {live && phase === 'waiting' && (
            <div className="absolute inset-x-3 bottom-3 border border-white/30 bg-navy/85 p-4 text-white sm:inset-x-auto sm:left-3 sm:max-w-[420px]">
              <div className="t-label text-white">Get into view</div>
              <p className="mt-1 text-[14px] leading-[1.5] text-white/85">{cfg.cue}</p>
              <p className="mt-2 font-mono text-[12px] text-white/70">Counting starts by itself once your {JOINT_NAMES[config.exercise]} are in the picture.</p>
            </div>
          )}

          {live && phase === 'rest' && (
            <div className="absolute inset-0 grid place-items-center bg-navy/60 text-center text-white">
              <div>
                <div className="t-label text-white">Rest</div>
                <div className="font-display text-[72px] leading-none font-semibold tabular-nums">{restSeconds}s</div>
                <div className="mt-2 font-mono text-[12px] text-white/80">
                  Set {(view?.setNumber ?? 1) + 1} of {view?.setsPlanned} starts by itself
                </div>
              </div>
            </div>
          )}

          {(status.kind === 'camera' || status.kind === 'model') && <div className="hatch absolute inset-8 opacity-30" aria-hidden="true" />}
        </div>
        <p className="t-meta mt-3">The video stays on this device. Only the angle of each rep is saved.</p>
      </div>

      <aside className="min-w-0" aria-label="Live readings">
        <div className="panel p-4 sm:p-5">
          <div className="t-label flex items-center gap-2">
            <Lamp tone={live && view?.tracked ? 'good' : 'default'} /> {cfg.metricLabel}, live
          </div>
          <div className="t-readout mt-2 tabular-nums" aria-live="off">
            {view?.metricDeg != null && view.tracked ? deg(view.metricDeg) : '–'}
          </div>
          <div className="mt-4">
            <StatTile label="Set" value={`${view?.setNumber ?? 1} / ${config.plan.sets}`} tone={phase === 'active' ? 'primary' : 'default'} />
            <StatTile label="Rep" value={`${view?.repsInSet ?? 0} / ${config.plan.reps}`} hint={`${view?.totalReps ?? 0} counted in all`} tone={phase === 'active' ? 'primary' : 'default'} />
            <StatTile label="Best rep" value={view?.bestDeg != null ? deg(view.bestDeg) : '–'} hint={`goal ${config.plan.targetDeg}°`} tone={view?.bestDeg != null && view.bestDeg >= config.plan.targetDeg ? 'good' : 'default'} />
          </div>

          {status.kind === 'error' && (
            <div role="alert" className="t-mono mt-4 flex items-start gap-2 text-bad">
              <Lamp tone="bad" /> <span>{status.message}</span>
            </div>
          )}
          {status.kind === 'empty' && (
            <p role="status" className="t-mono mt-4 flex items-start gap-2 text-ink-2">
              <Lamp /> No rep was counted, so nothing was saved.
            </p>
          )}

          <div className="mt-5 border-t border-rule pt-4" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <div className="t-label flex items-center gap-2">
                <Lamp tone={listenState === 'listening' ? 'good' : listenState === 'blocked' ? 'bad' : 'default'} blink={arcSpeaking} />
                Arc · {listenState === 'listening' ? (arcSpeaking ? 'speaking' : 'listening') : listenState === 'blocked' ? 'microphone blocked' : listenState === 'unsupported' ? 'no voice control in this browser' : 'hands-free off'}
              </div>
              {listenState !== 'unsupported' && (
                <button type="button" className="btn btn-ghost t-label" onClick={toggleHandsFree} aria-pressed={handsFree}>
                  {handsFree ? 'Turn off' : 'Hands-free'}
                </button>
              )}
            </div>
            <p className="t-meta mt-2 normal-case">Say start, pause, resume, skip, rest, stop, how many, or repeat.</p>
            {heard && <p className="t-mono mt-2 text-navy">Heard: {COMMAND_LABEL[heard]}</p>}
            {arcLine && <p className="mt-2 text-[14px] leading-[1.5] text-ink-2">{arcLine.text}</p>}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {status.kind === 'error' || status.kind === 'empty' ? (
              <button type="button" className="btn btn-block" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-block" onClick={finish} disabled={!live || (view?.totalReps ?? 0) === 0}>
                  <Lamp tone="primary" blink={status.kind === 'saving'} /> Finish and save
                </button>
                <button type="button" className="btn" onClick={() => runCommand(view?.paused ? 'resume' : 'pause')} disabled={!live || phase === 'done'}>
                  {view?.paused ? 'Resume' : 'Pause'}
                </button>
                <button type="button" className="btn" onClick={() => runCommand('skip')} disabled={!live || phase === 'done' || phase === 'waiting'}>
                  {phase === 'rest' ? 'Skip rest' : 'Skip set'}
                </button>
              </>
            )}
            <Link to="/dashboard" className="btn">
              Cancel
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}
