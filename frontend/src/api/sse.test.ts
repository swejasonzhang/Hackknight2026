import { describe, expect, it, vi } from 'vitest'
import { createSseParser } from './sse'

describe('createSseParser', () => {
  it('emits one event per blank-line block with the event name and data', () => {
    const onEvent = vi.fn()
    const p = createSseParser(onEvent)
    p.feed('event: ready\ndata: {"profileId":"p1"}\n\n')
    expect(onEvent).toHaveBeenCalledWith({ event: 'ready', data: '{"profileId":"p1"}' })
  })

  it('reassembles events split across chunks and handles several per chunk', () => {
    const onEvent = vi.fn()
    const p = createSseParser(onEvent)
    p.feed('event: session\ndata: {"id"')
    expect(onEvent).not.toHaveBeenCalled()
    p.feed(':"s1"}\n\nevent: session\ndata: {"id":"s2"}\n\n')
    expect(onEvent).toHaveBeenCalledTimes(2)
    expect(onEvent).toHaveBeenNthCalledWith(1, { event: 'session', data: '{"id":"s1"}' })
    expect(onEvent).toHaveBeenNthCalledWith(2, { event: 'session', data: '{"id":"s2"}' })
  })

  it('ignores comment heartbeats, defaults the event name and joins multi-line data', () => {
    const onEvent = vi.fn()
    const p = createSseParser(onEvent)
    p.feed(': ping\n\n')
    expect(onEvent).not.toHaveBeenCalled()
    p.feed('data: a\ndata: b\n\n')
    expect(onEvent).toHaveBeenCalledWith({ event: 'message', data: 'a\nb' })
  })

  it('accepts CRLF line endings', () => {
    const onEvent = vi.fn()
    createSseParser(onEvent).feed('event: ready\r\ndata: 1\r\n\r\n')
    expect(onEvent).toHaveBeenCalledWith({ event: 'ready', data: '1' })
  })
})
