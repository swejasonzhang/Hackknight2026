/**
 * ElevenLabs text to speech: Arc's voice. Same model and output as the ai-coach module
 * (eleven_turbo_v2_5, MP3 44.1 kHz 128 kbps). The key travels in the xi-api-key header and never
 * leaves the server; without it, the browser speaks Arc's lines with its own voice instead.
 */
export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

export function voiceConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY)
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
