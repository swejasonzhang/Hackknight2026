/**
 * ElevenLabs text to speech: Arc's voice. Same model and output as the ai-coach module
 * (eleven_turbo_v2_5, MP3 44.1 kHz 128 kbps). The key travels in the xi-api-key header and never
 * leaves the server; without it, the browser speaks Arc's lines with its own voice instead.
 */
export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

export function voiceConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY)
}

/**
 * Arc's short lines repeat ("Paused.", "Go a little deeper."), so their audio is kept in memory,
 * newest last, up to this many; a repeat costs no ElevenLabs call.
 */
const CACHE_SIZE = 200
const cache = new Map<string, ArrayBuffer>()

/** Forget the cached audio (tests). */
export function resetSpeechCache(): void {
  cache.clear()
}

/** `speak`, with repeats of the same line in the same voice served from memory. */
export async function speakCached(text: string): Promise<ArrayBuffer> {
  const key = `${process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID}\u0000${text}`
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const audio = await speak(text)
  cache.set(key, audio)
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
  return audio
}

export async function speak(text: string): Promise<ArrayBuffer> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set')
  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'audio/mpeg', 'xi-api-key': key },
    body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5' }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`ElevenLabs answered ${res.status}`)
  return res.arrayBuffer()
}
