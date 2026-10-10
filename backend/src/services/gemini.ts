/**
 * Gemini over its REST API (no SDK): Arc's words. The key travels in the x-goog-api-key header,
 * never in the URL, and never leaves the server. Transient failures (429, 5xx) are retried twice
 * with backoff, like the ai-coach module; anything else throws, and callers fall back to Arc's
 * script or templates, so the app keeps working without Gemini.
 */
export interface GeminiTurn {
  role: 'user' | 'model'
  text: string
}

export interface GeminiRequest {
  system: string
  turns: GeminiTurn[]
  /** Ask for JSON matching this schema (Gemini's OpenAPI subset). */
  responseSchema?: Record<string, unknown>
  maxOutputTokens?: number
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-3.8-flash'
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function generate(req: GeminiRequest, attempts = 3): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`
  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: req.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: req.maxOutputTokens ?? 400,
      ...(req.responseSchema ? { responseMimeType: 'application/json', responseSchema: req.responseSchema } : {}),
    },
  }
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) })
      if (res.ok) {
        const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
        if (!text) throw new Error('Gemini returned no text')
        return text
      }
      lastError = new Error(`Gemini answered ${res.status}`)
      if (res.status !== 429 && res.status < 500) break
    } catch (err) {
      lastError = err
    }
    if (attempt < attempts) await sleep(process.env.NODE_ENV === 'test' || process.env.VITEST ? 1 : 2 ** attempt * 500)
  }
  throw lastError instanceof Error ? lastError : new Error('Gemini failed')
}
