import type { CoachStatus, SessionDto } from '@arc/dependencies'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { createSpeaker } from '../voice/speaker'
import { Lamp, Strip } from './ui'

interface Read {
  id: string
  text: string
  offline: boolean
}

/**
 * Arc's plain-English read of a session (Gemini, or Arc's template without it), spoken with
 * ElevenLabs when the server has a key and the browser's voice otherwise. Right after a recording
 * (`autoSpeak`) it asks for the read and speaks it; later it plays on request, or asks Arc for a
 * read the session never had.
 */
export function ArcRead({ session, autoSpeak }: { session: SessionDto; autoSpeak: boolean }) {
  const stored = session.coachSummary
  const [read, setRead] = useState<Read | null>(stored ? { id: stored.messageId, text: stored.text, offline: stored.offline } : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const status = useRef<CoachStatus | null>(null)
  const spoken = useRef(false)
  const speaker = useMemo(() => createSpeaker({ elevenLabs: () => status.current?.voice ?? false, onSpeaking: setSpeaking }), [])

  useEffect(() => {
    api.coach
      .status()
      .then((s) => (status.current = s))
      .catch(() => {})
    return () => speaker.stop()
  }, [speaker])

  const ask = async () => {
    setBusy(true)
    setError(null)
    try {
      const m = await api.coach.summary(session.id)
      setRead({ id: m.id, text: m.text, offline: m.offline })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Arc could not read this session.')
    } finally {
      setBusy(false)
    }
  }

  // Just recorded: get the read (if it is not there yet) and say it once.
  useEffect(() => {
    if (autoSpeak && !read && !busy) void ask()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpeak])
  useEffect(() => {
    if (!autoSpeak || !read || spoken.current) return
    spoken.current = true
    void speaker.say({ id: read.id, text: read.text })
  }, [autoSpeak, read, speaker])

  return (
    <Strip index="00" title="Arc's read" aside={read ? (read.offline ? "From Arc's template · Gemini off" : 'Gemini · in plain English') : 'Your coach, on this session'}>
      {read ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6">
          <p className="max-w-[68ch] text-[16px] leading-[1.6] text-ink">{read.text}</p>
          <button type="button" className="btn justify-self-start" onClick={() => (speaking ? speaker.stop() : void speaker.say({ id: read.id, text: read.text }))}>
            <Lamp tone="primary" blink={speaking} /> {speaking ? 'Stop' : 'Play'}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <p className="t-desc">{busy ? 'Arc is reading this session…' : 'Arc has not read this session yet.'}</p>
          {!busy && (
            <button type="button" className="btn btn-block" onClick={() => void ask()}>
              Ask Arc
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="t-mono mt-3 text-bad">
          {error}
        </p>
      )}
    </Strip>
  )
}
