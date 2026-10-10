import { getToken } from '../auth/token'

export interface SseEvent {
  event: string
  data: string
}

/**
 * Incremental parser for `text/event-stream`. Feed it text as it arrives; it calls `onEvent`
 * once per complete event (blank-line terminated), joining multi-line `data:` fields with
 * newlines, defaulting the event name to "message" and ignoring comment lines.
 */
export function createSseParser(onEvent: (event: SseEvent) => void): { feed(chunk: string): void } {
  let buffer = ''
  return {
    feed(chunk) {
      buffer += chunk.replace(/\r\n?/g, '\n')
      let end = buffer.indexOf('\n\n')
      while (end !== -1) {
        const block = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        let event = 'message'
        const data: string[] = []
        for (const line of block.split('\n')) {
          if (!line || line.startsWith(':')) continue
          const colon = line.indexOf(':')
          const field = colon === -1 ? line : line.slice(0, colon)
          let value = colon === -1 ? '' : line.slice(colon + 1)
          if (value.startsWith(' ')) value = value.slice(1)
          if (field === 'event') event = value
          else if (field === 'data') data.push(value)
        }
        if (data.length) onEvent({ event, data: data.join('\n') })
        end = buffer.indexOf('\n\n')
      }
    },
  }
}

export type StreamStatus = 'connecting' | 'open' | 'closed'

export interface StreamHandlers {
  onEvent(event: string, data: unknown): void
  onStatus?(status: StreamStatus): void
}

const MAX_BACKOFF_MS = 30_000

/**
 * Subscribes to a Server-Sent Events endpoint with the login token in the Authorization header.
 * (EventSource cannot set headers, and the token must never travel in a URL.) Reconnects with
 * exponential backoff after a drop; stops for good on 401, 403 or 404. Returns the unsubscribe function.
 */
export function subscribe(path: string, handlers: StreamHandlers): () => void {
  const controller = new AbortController()
  let stopped = false
  let attempt = 0

  const run = async () => {
    while (!stopped) {
      handlers.onStatus?.('connecting')
      try {
        const token = getToken()
        const res = await fetch(path, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: controller.signal })
        if (res.status === 401 || res.status === 403 || res.status === 404) stopped = true
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
        attempt = 0
        handlers.onStatus?.('open')
        const parser = createSseParser((e) => {
          let data: unknown = e.data
          try {
            data = JSON.parse(e.data)
          } catch {
            /* keep the raw text */
          }
          handlers.onEvent(e.event, data)
        })
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          parser.feed(decoder.decode(value, { stream: true }))
        }
      } catch {
        /* dropped or aborted: fall through to reconnect or stop */
      }
      handlers.onStatus?.('closed')
      if (stopped) break
      await new Promise((resolve) => setTimeout(resolve, Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt++)))
    }
  }
  void run()
  return () => {
    stopped = true
    controller.abort()
  }
}
