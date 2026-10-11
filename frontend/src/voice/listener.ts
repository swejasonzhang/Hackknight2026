/** The parts of the Web Speech API this uses (Chrome and Edge as webkitSpeechRecognition, Safari too). */
interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start(): void
  stop(): void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type ListenerState = 'off' | 'listening' | 'blocked' | 'unsupported'

export interface Listener {
  readonly supported: boolean
  start(): void
  stop(): void
  /** While Arc speaks, ignore what the microphone hears. */
  mute(muted: boolean): void
}

/**
 * Arc's ears: the browser's speech recognition, kept running (it restarts after the browser's
 * silence timeout) and handing over each finished phrase. Chrome sends the audio to Google's
 * speech service to transcribe it; the phrases are only matched against commands, never stored.
 */
export function createListener(onPhrase: (text: string) => void, onState?: (state: ListenerState) => void): Listener {
  const Ctor = recognitionCtor()
  let rec: Recognition | null = null
  let wanted = false
  let muted = false
  let unmuteAt: ReturnType<typeof setTimeout> | undefined
  /** Why listening stopped for good (no permission, no microphone), reported once it ends. */
  let fatal: ListenerState | null = null
  /** How long to wait before listening again after a network error, growing each time. */
  let retryMs = 250

  const boot = () => {
    if (!Ctor || !wanted) return
    rec = new Ctor()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!
        if (r.isFinal && !muted) onPhrase(r[0].transcript)
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        wanted = false
        fatal = 'blocked'
        onState?.('blocked')
      } else if (e.error === 'network') retryMs = Math.min(10_000, retryMs * 2)
    }
    rec.onend = () => {
      rec = null
      if (wanted) setTimeout(boot, retryMs)
      // The end that follows a refusal must not paper over it with "off".
      else onState?.(fatal ?? 'off')
    }
    try {
      rec.start()
      retryMs = 250
      onState?.('listening')
    } catch {
      /* already started */
    }
  }

  return {
    supported: Ctor != null,
    start() {
      if (!Ctor) {
        onState?.('unsupported')
        return
      }
      if (wanted) return
      wanted = true
      fatal = null
      boot()
    },
    stop() {
      wanted = false
      rec?.stop()
    },
    mute(value) {
      // Arc's own last words reach the recogniser a moment after its voice stops: stay deaf a
      // little longer, so "Rest." or "Back to it." is never heard as the member's command.
      clearTimeout(unmuteAt)
      if (value) muted = true
      else unmuteAt = setTimeout(() => (muted = false), 1200)
    },
  }
}
