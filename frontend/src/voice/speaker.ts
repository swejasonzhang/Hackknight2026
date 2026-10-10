import { api } from '../api/client'

export interface SpokenLine {
  /** A stored coach message: spoken with ElevenLabs when the server has it. */
  id?: string
  text: string
}

export interface Speaker {
  say(line: SpokenLine): Promise<void>
  stop(): void
  readonly speaking: boolean
}

/**
 * Arc's voice. Every line is spoken with ElevenLabs through the API when the server has it (the
 * key never reaches the browser): a stored coach message by its id, a short line (an
 * acknowledgement, a cue during a set) by its text. Without ElevenLabs, or when a call fails, the
 * browser's own speech says it. `voice` resolves once the page knows which it has, and the first
 * line waits for it. `onSpeaking` lets the listener mute itself so Arc never hears its own words.
 */
export function createSpeaker({ voice, onSpeaking }: { voice: Promise<boolean>; onSpeaking?: (speaking: boolean) => void }): Speaker {
  let audio: HTMLAudioElement | null = null
  let url: string | null = null
  let speaking = false
  let token = 0

  const set = (value: boolean) => {
    speaking = value
    onSpeaking?.(value)
  }
  const cleanup = () => {
    audio?.pause()
    audio = null
    if (url) URL.revokeObjectURL(url)
    url = null
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  const browserSay = (text: string, mine: number) =>
    new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.02
      const english = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('en') && /natural|samantha|google|daniel|karen/i.test(v.name))
      if (english) utterance.voice = english
      utterance.onend = utterance.onerror = () => {
        if (mine === token) set(false)
        resolve()
      }
      window.speechSynthesis.speak(utterance)
    })

  return {
    get speaking() {
      return speaking
    },
    stop() {
      token++
      cleanup()
      if (speaking) set(false)
    },
    async say(line) {
      const mine = ++token
      cleanup()
      set(true)
      const elevenLabs = await voice.catch(() => false)
      if (mine !== token) return
      if (elevenLabs) {
        try {
          const blob = line.id ? await api.coach.audio(line.id) : await api.coach.speak(line.text)
          if (mine !== token) return
          url = URL.createObjectURL(blob)
          audio = new Audio(url)
          await new Promise<void>((resolve, reject) => {
            audio!.onended = () => resolve()
            audio!.onerror = () => reject(new Error('audio failed'))
            audio!.play().catch(reject)
          })
          if (mine === token) set(false)
          return
        } catch {
          if (mine !== token) return
          // Fall through to the browser's voice.
        }
      }
      await browserSay(line.text, mine)
    },
  }
}
