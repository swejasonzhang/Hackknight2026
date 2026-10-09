import type { SessionPhase } from '@ptg/dependencies'

export interface SessionControlsProps {
  phase: SessionPhase
  paused: boolean
  restSecondsLeft: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onEndSet: () => void
  onSkipRest: () => void
  onReset: () => void
}

export function SessionControls(p: SessionControlsProps) {
  if (p.phase === 'idle') {
    return (
      <div className="controls">
        <button className="primary" onClick={p.onStart}>
          Start session
        </button>
      </div>
    )
  }
  if (p.phase === 'complete') {
    return (
      <div className="controls">
        <button className="primary" onClick={p.onReset}>
          New session
        </button>
      </div>
    )
  }
  const pauseResume = p.paused ? <button onClick={p.onResume}>Resume</button> : <button onClick={p.onPause}>Pause</button>
  if (p.phase === 'rest') {
    return (
      <div className="controls">
        <span className="rest-timer" aria-live="polite">
          Rest: {p.restSecondsLeft} s
        </span>
        {pauseResume}
        <button onClick={p.onSkipRest}>Skip rest</button>
        <button className="danger" onClick={p.onReset}>
          Abandon
        </button>
      </div>
    )
  }
  return (
    <div className="controls">
      {pauseResume}
      {p.phase === 'active' && <button onClick={p.onEndSet}>End set</button>}
      <button className="danger" onClick={p.onReset}>
        Abandon
      </button>
    </div>
  )
}
