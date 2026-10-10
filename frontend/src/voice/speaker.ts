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
 * Arc's voice. A stored coach message is spoken with ElevenLabs through the API (the key never
 * reaches the browser); anything else, or when ElevenLabs is off or fails, with the browser's own
 * speech. `onSpeaking` lets the listener mute itself so Arc never hears its own words as commands.
 */
export function createSpeaker({ elevenLabs, onSpeaking }: { elevenLabs: () => boolean; onSpeaking?: (speaking: boolean) => void }): Speaker {
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
      if (line.id && elevenLabs()) {
        try {
          const blob = await api.coach.audio(line.id)
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
