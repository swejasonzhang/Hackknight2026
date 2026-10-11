import { EXERCISE_LIST, EXERCISES, FAULT_LINE, sideLabel, type ExerciseId, type RepPhase, type SessionPlan, type Side, type VoiceCommand } from '@arc/dependencies'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Lamp, StatTile } from '../components/ui'
import { deg } from '../format'
import { readJoint, type JointReading } from './angle'
import { guideFor } from './guide'
import type { PoseTracker } from './pose'
import { SessionSaver } from './saver'
import { SessionRecorder, type RecorderView } from './recorder'
import { COMMAND_LABEL, isForArc, parseCommand } from '../voice/commands'
import { createListener, type Listener, type ListenerState } from '../voice/listener'
import { createSpeaker, type Speaker, type SpokenLine } from '../voice/speaker'
import { elevenLabsVoice } from '../voice/status'
import { cueFor, shouldCue } from './cues'
import { FormGuide } from './FormGuide'
import { LoadField } from './LoadField'

export interface RecordConfig {
  exercise: ExerciseId
  side: Side
  plan: SessionPlan
  /** The weight held last time for this movement, the field's starting value. */
  loadKg?: number | null
}

type Status = { kind: 'camera' } | { kind: 'model' } | { kind: 'live' } | { kind: 'saving' } | { kind: 'empty' } | { kind: 'error'; message: string }

/** "shoulder, elbow and wrist": the joints a movement is measured at, in plain words. */
const LANDMARK_WORDS: Record<number, string> = { 11: 'shoulder', 12: 'shoulder', 13: 'elbow', 14: 'elbow', 15: 'wrist', 16: 'wrist', 23: 'hip', 24: 'hip', 25: 'knee', 26: 'knee', 27: 'ankle', 28: 'ankle' }
const JOINT_NAMES = Object.fromEntries(
  EXERCISE_LIST.map((e) => {
    const words = [...new Set(e.joints.right.map((i) => LANDMARK_WORDS[i]!))]
    const plural = words.length === 1 ? `${words[0]}s` : words.length === 2 ? `${words[0]}s and ${words[1]}s` : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
    return [e.id, plural]
  }),
) as Record<ExerciseId, string>

/** How far the pretend person reaches: a little short of the goal, always clearly past the rep threshold. */
export function simulatedPeak(config: Pick<RecordConfig, 'exercise' | 'plan'>): number {
  const cfg = EXERCISES[config.exercise]
  const short = (config.plan.targetDeg - cfg.restDeg) * 0.06
  return Math.min(cfg.maxDeg, Math.max(cfg.enterDeg + (cfg.enterDeg - cfg.exitDeg) * 0.15, config.plan.targetDeg - short))
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

/**
 * The camera view's one overlay: a movement indicator at the working joint, with no skeleton. An arc
 * from the moving limb to where it should go now (the goal on the way up, the start on the way
 * down) ends in an arrow; the goal is a tick on it, and the arc turns green once the rep reaches it.
 * A label says what to do and the angle now. The canvas is mirrored with the video, so the label's
 * text is mirrored back to read the right way round.
 */
function draw(canvas: HTMLCanvasElement, aspect: number, reading: JointReading, motion: { exercise: ExerciseId; repPhase: RepPhase; metricDeg: number | null; goalDeg: number; live: boolean }) {
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
  if (!reading.tracked || !reading.points || motion.metricDeg == null) return
  const box = fit(cw, ch, aspect)
  const pts = reading.points.map(([x, y]) => [box.x + x * box.w, box.y + y * box.h] as const) as unknown as [readonly [number, number], readonly [number, number], readonly [number, number]]
  const g = guideFor(motion.exercise, motion.repPhase, motion.metricDeg, motion.goalDeg, pts)
  const colour = g.atGoal ? '#1f9d55' : '#0b3dff'
  const [cx, cy] = g.arc?.centre ?? [(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2]
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(11,27,58,0.45)'
  ctx.shadowBlur = 4
  if (g.arc && motion.live) {
    const { radius: r, from, to, goalAt } = g.arc
    // The way to go, ending in an arrowhead.
    ctx.strokeStyle = colour
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(cx, cy, r, from, to, to < from)
    ctx.stroke()
    const dir = to < from ? -1 : 1
    const tip: [number, number] = [cx + r * Math.cos(to), cy + r * Math.sin(to)]
    const tangent = to + (dir * Math.PI) / 2
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.moveTo(tip[0] + 14 * Math.cos(tangent), tip[1] + 14 * Math.sin(tangent))
    ctx.lineTo(tip[0] + 9 * Math.cos(tangent + 2.4), tip[1] + 9 * Math.sin(tangent + 2.4))
    ctx.lineTo(tip[0] + 9 * Math.cos(tangent - 2.4), tip[1] + 9 * Math.sin(tangent - 2.4))
    ctx.closePath()
    ctx.fill()
    // The goal: a tick across the arc.
    ctx.strokeStyle = '#f0b323'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(cx + (r - 12) * Math.cos(goalAt), cy + (r - 12) * Math.sin(goalAt))
    ctx.lineTo(cx + (r + 12) * Math.cos(goalAt), cy + (r + 12) * Math.sin(goalAt))
    ctx.stroke()
  }
  // The working joint.
  ctx.shadowBlur = 0
  ctx.fillStyle = colour
  ctx.beginPath()
  ctx.arc(cx, cy, 7, 0, 2 * Math.PI)
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  // What to do and the angle now, readable through the mirror.
  const text = `${motion.live ? `${g.label.toUpperCase()} · ` : ''}${Math.round(motion.metricDeg)}°`
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(-1, 1)
  ctx.font = '600 13px "IBM Plex Mono", ui-monospace, monospace'
  const w = ctx.measureText(text).width + 16
  ctx.fillStyle = 'rgba(11,27,58,0.88)'
  ctx.fillRect(14, -32, w, 24)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, 22, -15)
  ctx.restore()
}

/**
 * Recording in the browser, with nothing to press: the camera starts as soon as this opens, the
 * pose model loads, and counting begins once the movement's joints are in view. The plan's sets
 * and rests run by themselves. Each set is saved to MongoDB as it finishes, into one session; the
 * last set (or "Finish and save") marks it complete and opens its report. Over the video, the
 * whole white skeleton and the measured joint. The video stays in the browser.
 */
export function LiveRecorder({ profileId, config, simulate = false, below }: { profileId: string; config: RecordConfig; simulate?: boolean; below?: ReactNode }) {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recorderRef = useRef<SessionRecorder | null>(null)
  const savingRef = useRef(false)
  // Every set goes to MongoDB as it finishes, into one session, so nothing is lost if the tab closes.
  const saverRef = useRef<SessionSaver | null>(null)
  const [savedSets, setSavedSets] = useState(0)
  const [status, setStatus] = useState<Status>({ kind: 'camera' })
  const [view, setView] = useState<RecorderView | null>(null)
  const [aspect, setAspect] = useState(16 / 9)
  const [attempt, setAttempt] = useState(0)
  const cfg = EXERCISES[config.exercise]

  // Arc: hands-free listening, and Arc's voice for set reads and quick replies.
  const speakerRef = useRef<Speaker | null>(null)
  const listenerRef = useRef<Listener | null>(null)
  const lastLineRef = useRef<SpokenLine | null>(null)
  const viewRef = useRef<RecorderView | null>(null)
  const [handsFree, setHandsFree] = useState(readHandsFree)
  const [listenState, setListenState] = useState<ListenerState>('off')
  const [heard, setHeard] = useState<VoiceCommand | null>(null)
  const [arcLine, setArcLine] = useState<SpokenLine | null>(null)
  const [arcSpeaking, setArcSpeaking] = useState(false)
  // Which voice Arc speaks with, shown so the member knows; and the last few words each way.
  const [voiceName, setVoiceName] = useState<'ElevenLabs' | 'browser' | null>(null)
  const [talk, setTalk] = useState<{ who: 'you' | 'arc'; text: string }[]>([])
  const askingRef = useRef(false)
  const lastCueAtRef = useRef(0)

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

  // Anything the member says to Arc that is not a command: Arc answers with the live numbers.
  const askArcRef = useRef<(text: string) => Promise<void>>(async () => {})
  askArcRef.current = async (text: string) => {
    const recorder = recorderRef.current
    const v = viewRef.current
    if (askingRef.current || !recorder || !v) return
    askingRef.current = true
    setTalk((t) => [...t, { who: 'you' as const, text }].slice(-4))
    const inSet = recorder.currentSetReps.length ? recorder.currentSetReps : (recorder.completedSets.at(-1)?.reps ?? [])
    try {
      const m = await api.coach.ask({
        profileId,
        exercise: config.exercise,
        side: config.side,
        text: text.slice(0, 500),
        live: {
          setNumber: v.setNumber,
          setsPlanned: v.setsPlanned,
          repsInSet: v.repsInSet,
          repsPlanned: v.repsPlanned,
          totalReps: v.totalReps,
          recentPeaks: inSet.slice(-8).map((r) => Math.round(r.peakDeg * 10) / 10),
          bestDeg: v.bestDeg,
          targetDeg: config.plan.targetDeg,
          phase: v.phase,
        },
      })
      setTalk((t) => [...t, { who: 'arc' as const, text: m.text }].slice(-4))
      say({ id: m.id, text: m.text })
    } catch {
      setTalk((t) => [...t, { who: 'arc' as const, text: "I couldn't answer just then. Ask me again." }].slice(-4))
    } finally {
      askingRef.current = false
    }
  }

  useEffect(() => {
    let cancelled = false
    const voice = elevenLabsVoice()
    void voice.then((v) => !cancelled && setVoiceName(v ? 'ElevenLabs' : 'browser'))
    speakerRef.current = createSpeaker({
      voice,
      onSpeaking: (speaking) => {
        setArcSpeaking(speaking)
        listenerRef.current?.mute(speaking)
      },
    })
    listenerRef.current = createListener((text) => {
      const command = parseCommand(text)
      if (command) runCommand(command)
      else if (isForArc(text)) void askArcRef.current(text)
    }, setListenState)
    return () => {
      cancelled = true
      listenerRef.current?.stop()
      speakerRef.current?.stop()
    }
  }, [runCommand])

  // The weight held goes out with every save of the session.
  const loadRef = useRef<number | null>(config.loadKg ?? null)
  const withLoad = useCallback(<T extends object>(input: T | null): (T & { loadKg?: number }) | null => (input && loadRef.current != null ? { ...input, loadKg: loadRef.current } : input), [])

  const save = useCallback(async () => {
    if (savingRef.current) return
    savingRef.current = true
    const input = withLoad(recorderRef.current?.toSessionInput(profileId, true) ?? null)
    if (!input || !saverRef.current) {
      setStatus({ kind: 'empty' })
      return
    }
    setStatus({ kind: 'saving' })
    try {
      const id = await saverRef.current.save(input)
      listenerRef.current?.stop()
      navigate(`/sessions/${id}`, { state: { from: '/dashboard', label: 'Dashboard', arcRead: true } })
    } catch (err) {
      savingRef.current = false
      setStatus({ kind: 'error', message: err instanceof Error ? `The session could not be saved: ${err.message}` : 'The session could not be saved.' })
    }
  }, [navigate, profileId, withLoad])

  useEffect(() => {
    let cancelled = false
    let raf = 0
    let stream: MediaStream | null = null
    let tracker: PoseTracker | null = null
    savingRef.current = false
    recorderRef.current = new SessionRecorder(config)
    saverRef.current = new SessionSaver({ create: api.sessions.create, update: api.sessions.update })
    setSavedSets(0)
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
          ? (await import('./simulated')).createSimulatedTracker(config.exercise, config.side, simulatedPeak(config))
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
        const next = recorder.feed({ tracked: reading.tracked, metricDeg: reading.metricDeg, tMs: performance.timeOrigin + now, pose: landmarks, aspect: videoAspect })
        if (canvasRef.current) draw(canvasRef.current, videoAspect, reading, { exercise: config.exercise, repPhase: next.repPhase, metricDeg: next.metricDeg, goalDeg: config.plan.targetDeg, live: next.phase === 'active' && !next.paused })
        // Re-render only when something on screen changes.
        const key = `${next.phase}|${next.setNumber}|${next.repsInSet}|${next.totalReps}|${Math.round(next.metricDeg ?? -1)}|${Math.ceil(next.restLeftMs / 1000)}|${next.tracked}|${Math.round(next.bestDeg ?? -1)}`
        const previousRep = viewRef.current?.lastRep
        const previousRejected = viewRef.current?.lastRejected
        viewRef.current = next
        if (key !== lastKey) {
          lastKey = key
          setView(next)
        }
        // A rep just ended: Arc may coach it (deeper, slower, fading), a few seconds apart at most.
        if (next.phase === 'active' && next.lastRep && next.lastRep !== previousRep) {
          const cue = cueFor(recorder.currentSetReps, EXERCISES[config.exercise], config.plan.targetDeg)
          const at = performance.now()
          if (cue && shouldCue({ now: at, lastCueAt: lastCueAtRef.current, arcSpeaking: speakerRef.current?.speaking ?? false })) {
            lastCueAtRef.current = at
            say({ text: cue })
          }
        }
        // A rep that broke the form did not count: Arc says so at once, and what to change.
        if (next.lastRejected && next.lastRejected !== previousRejected) {
          lastCueAtRef.current = performance.now()
          if (!(speakerRef.current?.speaking ?? false)) say({ text: FAULT_LINE[next.lastRejected.fault] })
        }
        // A set just ended and the rest began: Arc reads it back (Gemini words, ElevenLabs voice).
        const finished = recorder.completedSets
        if (finished.length > setsRead) {
          setsRead = finished.length
          const set = finished.at(-1)!
          // Into MongoDB now, not only at the end.
          const soFar = withLoad(recorder.toSessionInput(profileId, false))
          const count = finished.length
          if (soFar && next.phase !== 'done')
            saverRef.current
              ?.save(soFar)
              .then(() => !cancelled && setSavedSets(count))
              .catch(() => {})
          if (next.phase === 'rest') {
            api.coach
              .setFeedback({ profileId, exercise: config.exercise, side: config.side, plan: config.plan, setNumber: set.setNumber, reps: set.reps, ...(set.rejected ? { rejected: set.rejected } : {}) })
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
  }, [config, simulate, save, attempt, profileId, say, withLoad])

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
            {cfg.name} · {sideLabel(config.exercise, config.side)}
          </span>
          <span className="callout z-10 top-3 right-3 flex items-center gap-2">
            <Lamp tone={live && view?.tracked ? 'good' : 'default'} blink={!live || phase === 'waiting'} /> {statusLine}
          </span>

          {/* On a phone the readings sit below the fold: the count rides on the camera instead. */}
          {live && (phase === 'active' || phase === 'rest') && (
            <div className="callout bottom-3 left-3 z-10 flex items-center gap-3 lg:hidden" aria-hidden="true">
              <span>Set {view?.setNumber ?? 1}/{config.plan.sets}</span>
              <span>Rep {view?.repsInSet ?? 0}/{config.plan.reps}</span>
              {view?.metricDeg != null && view.tracked && <span className="text-cobalt">{deg(view.metricDeg)}</span>}
            </div>
          )}

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
        <p className="t-meta mt-3" aria-live="polite">
          The video stays on this device. Each set's angles are saved to your account as the set finishes
          {savedSets > 0 ? ` · saved through set ${savedSets}` : ''}.
        </p>
        {below}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
      <FormGuide exercise={config.exercise} side={config.side} targetDeg={config.plan.targetDeg} />
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
            <StatTile
              label="Rep"
              value={`${view?.repsInSet ?? 0} / ${config.plan.reps}`}
              hint={view?.rejectedInSet ? `${view.totalReps} counted in all · ${view.rejectedInSet} not counted this set` : `${view?.totalReps ?? 0} counted in all, good form only`}
              tone={phase === 'active' ? 'primary' : 'default'}
            />
            {view?.lastRejected && phase === 'active' && (
              <p className="t-mono flex items-start gap-2 border-b border-rule py-2 text-[12.5px] text-bad" role="status">
                <Lamp tone="bad" /> {FAULT_LINE[view.lastRejected.fault]}
              </p>
            )}
            <StatTile label="Best rep" value={view?.bestDeg != null ? deg(view.bestDeg) : '–'} hint={`goal ${config.plan.targetDeg}°`} tone={view?.bestDeg != null && view.bestDeg >= config.plan.targetDeg ? 'good' : 'default'} />
          </div>
          <LoadField initialKg={config.loadKg} onChange={(kg) => (loadRef.current = kg)} />

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
            <p className="t-meta mt-2 normal-case">
              Say start, pause, resume, skip, rest, stop, how many or repeat, or just talk to Arc: ask how you're doing, about your form, or say how it feels.
            </p>
            {voiceName && (
              <p className="t-meta mt-1 normal-case">
                Arc's voice: {voiceName === 'ElevenLabs' ? 'ElevenLabs' : "your browser's (ElevenLabs is not set up on the server)"}
              </p>
            )}
            {heard && <p className="t-mono mt-2 text-navy">Heard: {COMMAND_LABEL[heard]}</p>}
            {talk.length > 0 ? (
              <ol className="mt-2 flex flex-col gap-1.5" aria-label="Talking with Arc">
                {talk.map((line, i) => (
                  <li key={i} className={`text-[14px] leading-[1.5] ${line.who === 'arc' ? 'text-ink' : 'text-ink-2'}`}>
                    <span className="t-mono mr-2 text-[11px] text-muted">{line.who === 'arc' ? 'ARC' : 'YOU'}</span>
                    {line.text}
                  </li>
                ))}
              </ol>
            ) : (
              arcLine && <p className="mt-2 text-[14px] leading-[1.5] text-ink-2">{arcLine.text}</p>
            )}
            {talk.length > 0 && arcLine && arcLine.text !== talk.at(-1)?.text && <p className="mt-2 text-[14px] leading-[1.5] text-ink-2">{arcLine.text}</p>}
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
    </div>
  )
}
