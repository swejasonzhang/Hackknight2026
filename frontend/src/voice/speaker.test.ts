import { beforeEach, describe, expect, it, vi } from 'vitest'

const audio = vi.fn()
const speak = vi.fn()
vi.mock('../api/client', () => ({ api: { coach: { audio: (id: string) => audio(id), speak: (text: string) => speak(text) } } }))
const { createSpeaker } = await import('./speaker')

// The browser's audio element and speech: record what was played and finish at once.
const played: string[] = []
const spoken: string[] = []
class FakeAudio {
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  src: string
  constructor(src: string) {
    this.src = src
  }
  play() {
    played.push(this.src)
    setTimeout(() => this.onended?.(), 0)
    return Promise.resolve()
  }
  pause() {}
}
class FakeUtterance {
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  text: string
  constructor(text: string) {
    this.text = text
  }
}

describe("Arc's voice in the browser", () => {
  beforeEach(() => {
    played.length = 0
    spoken.length = 0
    audio.mockReset().mockResolvedValue(new Blob(['mp3']))
    speak.mockReset().mockResolvedValue(new Blob(['mp3']))
    vi.stubGlobal('Audio', FakeAudio)
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:arc', revokeObjectURL: () => {} })
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: (u: FakeUtterance) => (spoken.push(u.text), setTimeout(() => u.onend?.(), 0)), cancel: () => {}, getVoices: () => [] },
    })
  })

  it('waits to learn which voice it has, so even the first line is ElevenLabs', async () => {
    let ready!: (voice: boolean) => void
    const voice = new Promise<boolean>((r) => (ready = r))
    const speaker = createSpeaker({ voice })
    const saying = speaker.say({ id: 'm1', text: 'Hi, I am Arc.' })
    ready(true)
    await saying
    expect(audio).toHaveBeenCalledWith('m1')
    expect(spoken).toEqual([])
  })

  it('speaks short lines with no stored message through ElevenLabs too', async () => {
    const speaker = createSpeaker({ voice: Promise.resolve(true) })
    await speaker.say({ text: 'Paused.' })
    expect(speak).toHaveBeenCalledWith('Paused.')
    expect(played).toEqual(['blob:arc'])
  })

  it("uses the browser's voice without ElevenLabs, or when it fails", async () => {
    await createSpeaker({ voice: Promise.resolve(false) }).say({ id: 'm1', text: 'Set one done.' })
    expect(audio).not.toHaveBeenCalled()
    speak.mockRejectedValueOnce(new Error('502'))
    await createSpeaker({ voice: Promise.resolve(true) }).say({ text: 'Go a little deeper.' })
    expect(spoken).toEqual(['Set one done.', 'Go a little deeper.'])
  })
})
