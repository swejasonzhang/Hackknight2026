import { EXERCISES, type ChatTurn, type CoachStatus, type OnboardingReply } from '@arc/dependencies'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Page } from '../components/motion'
import { Alert, Lamp, PageHeader } from '../components/ui'
import { useProfiles } from '../hooks/useProfiles'
import { createListener, type ListenerState } from '../voice/listener'
import { createSpeaker } from '../voice/speaker'

/** What Arc is finding out, in the order it asks. */
const LEARNING = ['Your goals', 'The area to work on', 'Left or right', 'Injuries or limits', 'Your experience', 'Days a week']

/**
 * /welcome, right after sign-up: a short chat with Arc (Gemini, or Arc's own questions without
 * it). Arc asks what the member wants from their body, the area, the side, limits, experience and
 * days a week; when it has enough it saves the profile and a first plan, and the page shows that
 * plan with the way to the dashboard and to recording. Arc speaks each line (ElevenLabs, or the
 * browser's voice), and the microphone button lets the member answer by voice. ?profile=<id>
 * runs the same chat for an existing profile.
 */
export function WelcomePage() {
  const { reload, setSelectedId } = useProfiles()
  const [params] = useSearchParams()
  const profileId = params.get('profile') ?? undefined
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<OnboardingReply | null>(null)
  const [voiceOn, setVoiceOn] = useState(true)
  const [mic, setMic] = useState<ListenerState>('off')
  const status = useRef<CoachStatus | null>(null)
  const listEnd = useRef<HTMLDivElement>(null)
  const voiceOnRef = useRef(voiceOn)
  voiceOnRef.current = voiceOn

  const speaker = useMemo(() => createSpeaker({ elevenLabs: () => status.current?.voice ?? false, onSpeaking: (s) => listener.mute(s) }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const sendRef = useRef<(text: string) => void>(() => {})
  const listener = useMemo(() => createListener((text) => sendRef.current(text), setMic), [])

  const turn = async (next: ChatTurn[]) => {
    setThinking(true)
    setError(null)
    try {
      const reply = await api.coach.onboarding(profileId ? { messages: next, profileId } : { messages: next })
      const withArc: ChatTurn[] = [...next, { role: 'arc', text: reply.reply }]
      setMessages(withArc)
      if (voiceOnRef.current) void speaker.say({ id: reply.messageId, text: reply.reply })
      if (reply.done) {
        setDone(reply)
        listener.stop()
        await reload()
        if (reply.profileId) setSelectedId(reply.profileId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Arc could not answer just now.')
    } finally {
      setThinking(false)
    }
  }

  const send = (text: string) => {
    const answer = text.trim()
    if (!answer || thinking || done) return
    const next: ChatTurn[] = [...messages, { role: 'user', text: answer }]
    setMessages(next)
    setDraft('')
    void turn(next)
  }
  sendRef.current = send

  useEffect(() => {
    api.coach
      .status()
      .then((s) => (status.current = s))
      .catch(() => {})
    void turn([])
    return () => {
      speaker.stop()
      listener.stop()
    }
    // Start the chat once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    listEnd.current?.scrollIntoView?.({ block: 'nearest' })
  }, [messages, thinking])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(draft)
  }

  const answered = messages.filter((m) => m.role === 'user').length
  const plan = done?.plan

  return (
    <Page>
      <PageHeader
        eyebrow="Welcome · Arc"
        title="Meet Arc"
        subtitle="Your coach. A few questions about what you want from your body, and Arc builds your first plan."
        actions={
          <button type="button" className="btn btn-ghost t-label" onClick={() => (voiceOn ? (setVoiceOn(false), speaker.stop()) : setVoiceOn(true))} aria-pressed={voiceOn}>
            {voiceOn ? "Arc's voice on" : "Arc's voice off"}
          </button>
        }
      />
      <div className="rule-strong" />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <section className="panel flex min-w-0 flex-col p-4 sm:p-5" aria-label="Chat with Arc">
          <ol className="flex flex-col gap-4" aria-live="polite">
            {messages.map((m, i) => (
              <li key={i} className={m.role === 'arc' ? 'flex gap-3' : 'flex justify-end'}>
                {m.role === 'arc' ? (
                  <>
                    <span aria-hidden="true" className="inline-flex h-8 w-8 flex-none items-center justify-center bg-navy font-display text-[11px] font-bold text-white">
                      ARC
                    </span>
                    <p className="max-w-[60ch] text-[15.5px] leading-[1.55] text-ink">
                      <span className="sr-only">Arc: </span>
                      {m.text}
                    </p>
                  </>
                ) : (
                  <p className="max-w-[48ch] border border-rule bg-vellum px-3 py-2 text-[15px] leading-[1.5] text-ink shadow-[inset_3px_0_0_var(--cobalt)]">
                    <span className="sr-only">You: </span>
                    {m.text}
                  </p>
                )}
              </li>
            ))}
            {thinking && (
              <li className="t-meta flex items-center gap-2">
                <Lamp tone="primary" blink /> Arc is thinking…
              </li>
            )}
          </ol>
          <div ref={listEnd} />

          {error && (
            <div className="mt-4">
              <Alert tone="bad">{error}</Alert>
            </div>
          )}

          {!done && (
            <form onSubmit={onSubmit} className="mt-5 flex flex-wrap items-stretch gap-2 border-t border-rule pt-4">
              <label htmlFor="arc-answer" className="sr-only">
                Your answer
              </label>
              <input id="arc-answer" className="input min-w-0 flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your answer…" autoComplete="off" disabled={thinking} />
              <button type="submit" className="btn btn-block" disabled={thinking || !draft.trim()}>
                Send
              </button>
              {listener.supported && (
                <button
                  type="button"
                  className="btn"
                  aria-pressed={mic === 'listening'}
                  onClick={() => (mic === 'listening' ? listener.stop() : listener.start())}
                  title="Answer by voice"
                >
                  <Lamp tone={mic === 'listening' ? 'good' : mic === 'blocked' ? 'bad' : 'default'} blink={mic === 'listening'} />
                  {mic === 'listening' ? 'Listening' : mic === 'blocked' ? 'Mic blocked' : 'Speak'}
                </button>
              )}
            </form>
          )}
        </section>

        <aside className="min-w-0" aria-label="What Arc is learning">
          {plan && done ? (
            <div className="panel p-4 sm:p-5">
              <div className="t-label flex items-center gap-2">
                <Lamp tone="good" /> Your plan is ready
              </div>
              <p className="mt-3 text-[15px] leading-[1.5] text-ink">{done.intake?.goals}</p>
              <p className="t-meta mt-3 normal-case text-navy">
                {EXERCISES[plan.exercise].name} · {plan.side} · {plan.sets} × {plan.reps} · {plan.restSeconds} s rest · goal {plan.targetDeg}°
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/record" className="btn btn-block">
                  <Lamp tone="primary" /> Start recording
                </Link>
                <Link to="/dashboard" className="btn">
                  Go to the dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div className="panel p-4 sm:p-5">
              <div className="t-label">What Arc is learning</div>
              <ol className="mt-3">
                {LEARNING.map((item, i) => (
                  <li key={item} className="flex items-center gap-3 border-b border-rule py-2.5 last:border-b-0">
                    <Lamp tone={i < answered ? 'good' : i === answered ? 'primary' : 'default'} blink={i === answered && thinking} />
                    <span className={`text-[14px] ${i < answered ? 'text-ink' : 'text-muted'}`}>{item}</span>
                  </li>
                ))}
              </ol>
              <Link to="/dashboard" className="t-label mt-4 inline-block text-cobalt">
                Skip for now →
              </Link>
            </div>
          )}
        </aside>
      </div>
    </Page>
  )
}
