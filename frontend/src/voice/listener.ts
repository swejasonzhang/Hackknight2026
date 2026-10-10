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
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wanted = false
        onState?.('blocked')
      }
    }
    rec.onend = () => {
      rec = null
      if (wanted) setTimeout(boot, 250)
      else onState?.('off')
    }
    try {
      rec.start()
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
      boot()
    },
    stop() {
      wanted = false
      rec?.stop()
    },
    mute(value) {
      muted = value
    },
  }
}
