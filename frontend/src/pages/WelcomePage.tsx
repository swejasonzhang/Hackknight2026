import { catalogByArea, EXERCISES, ONBOARDING_TOPICS, WEEKDAY_NAMES, type CatalogGroup, type ChatTurn, type CoachStatus, type OnboardingReply, type OnboardingTopic, type ProgramDto } from '@arc/dependencies'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { IconMic, IconSend, IconVolume, IconVolumeOff, Logo } from '../components/icons'
import { Alert, Lamp } from '../components/ui'
import { useProfiles } from '../hooks/useProfiles'
import { createListener, type ListenerState } from '../voice/listener'
import { createSpeaker } from '../voice/speaker'

/** What Arc is finding out, in the order it asks. */
export const TOPIC_LABELS: Record<OnboardingTopic, string> = {
  goals: 'What you want',
  trainingGoal: 'Strength, muscle or stamina',
  focus: 'Where to start',
  side: 'Left or right',
  limitations: 'Injuries or limits',
  experience: 'Experience',
  days: 'Training days',
  height: 'Height',
  weight: 'Weight',
}

/** One tap answers the common cases; anything else is typed or spoken. */
export const QUICK_REPLIES: Record<OnboardingTopic, string[]> = {
  goals: ['Get stronger', 'Move more freely', 'Come back from an injury'],
  trainingGoal: ['Get stronger', 'Build muscle', 'Build stamina'],
  // Where to start shows the whole catalog Arc sends with the question, by area (see `choices`).
  focus: [],
  side: ['Left', 'Right'],
  limitations: ['None', 'A bit stiff', 'Recovering from surgery'],
  experience: ['New to it', 'Some', 'Regularly'],
  days: ['Monday, Wednesday and Friday', 'Tuesday and Thursday', 'Weekdays', 'Every day'],
  height: ['Skip'],
  weight: ['Skip'],
}

const WEEK = [1, 2, 3, 4, 5, 6, 0]

/**
 * /welcome, its own full page between sign-up and the dashboard (ADR-0020): a chat with Arc
 * (Gemini, or Arc's own questions without it) about what the member wants from their body, their
 * goal (strength, muscle or stamina), where to start, the side, limits, experience, training days,
 * height and weight. Quick replies answer common cases in a tap; Arc speaks each line and the
 * microphone takes spoken answers. When Arc has enough it saves the profile and builds the week,
 * shown here before the dashboard's calendar. Skip leaves at any point; ?profile=<id> runs the
 * same chat for an existing profile.
 */
export function WelcomePage() {
  const { reload, setSelectedId } = useProfiles()
  const [params] = useSearchParams()
  const profileId = params.get('profile') ?? undefined
  const reduce = useReducedMotion()
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [topic, setTopic] = useState<OnboardingTopic | null>(null)
  const [choices, setChoices] = useState<CatalogGroup[] | null>(null)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<OnboardingReply | null>(null)
  const [voiceOn, setVoiceOn] = useState(true)
  const [mic, setMic] = useState<ListenerState>('off')
  const status = useRef<CoachStatus | null>(null)
  const listEnd = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
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
      setMessages([...next, { role: 'arc', text: reply.reply }])
      setTopic(reply.topic ?? null)
      setChoices(reply.topic === 'focus' ? (reply.choices ?? catalogByArea()) : null)
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
    listEnd.current?.scrollIntoView?.({ block: 'end', behavior: reduce ? 'auto' : 'smooth' })
  }, [messages, thinking, done, reduce])

  // Typing goes straight into the answer box once Arc has spoken.
  useEffect(() => {
    if (!thinking && !done) input.current?.focus({ preventScroll: true })
  }, [thinking, done])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(draft)
  }
  const toggleVoice = () => {
    if (voiceOn) speaker.stop()
    setVoiceOn(!voiceOn)
  }

  const step = done ? ONBOARDING_TOPICS.length : topic ? ONBOARDING_TOPICS.indexOf(topic) : 0
  const progress = Math.round((step / ONBOARDING_TOPICS.length) * 100)
  const program = done?.program

  return (
    <div className="flex min-h-[100dvh] flex-col bg-vellum text-ink">
      {/* ---- top bar: the mark, progress through the questions, Arc's voice, the way out ---- */}
      <header className="sticky top-0 z-20 bg-navy text-white">
        <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-3 px-4 sm:px-6">
          <Logo size={24} tone="paper" />
          <span className="font-display text-[15px] font-bold tracking-[-0.01em]">Arc</span>
          <span className="t-meta hidden text-rail-muted sm:inline">Getting to know you</span>
          <span className="flex-1" />
          <span className="t-meta text-rail-muted" aria-live="polite">
            {done ? 'All done' : `${Math.min(step + 1, ONBOARDING_TOPICS.length)} of ${ONBOARDING_TOPICS.length}`}
          </span>
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={voiceOn}
            aria-label="Arc's voice"
            title={voiceOn ? "Arc's voice is on" : "Arc's voice is off"}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center text-rail-muted transition-colors hover:text-white"
          >
            {voiceOn ? <IconVolume size={18} /> : <IconVolumeOff size={18} />}
          </button>
          <Link to="/dashboard" className="t-label whitespace-nowrap text-white hover:no-underline">
            {done ? 'Dashboard →' : 'Skip for now →'}
          </Link>
        </div>
        <div className="h-[3px] bg-white/10" aria-hidden="true">
          <motion.div className="h-full bg-cobalt" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: reduce ? 0 : 0.4, ease: [0.2, 0, 0, 1] }} />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1180px] flex-1 gap-8 px-4 pt-8 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10 lg:pt-12">
        <section aria-label="Chat with Arc" className="min-w-0">
          <div className="t-meta mb-3">Welcome · Arc, your coach</div>
          <h1 className="t-title">What do you want from your body?</h1>
          <p className="t-desc mt-3 max-w-[60ch] text-[15px]">Arc asks a few questions, one at a time, then builds your training week. Tap an answer, type, or speak. Skip whenever you like.</p>

          <ol className="mt-8 flex flex-col gap-5" aria-live="polite">
            {messages.map((m, i) => (
              <motion.li
                key={i}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
                className={m.role === 'arc' ? 'flex gap-3' : 'flex justify-end'}
              >
                {m.role === 'arc' ? (
                  <>
                    <span aria-hidden="true" className="inline-flex h-9 w-9 flex-none items-center justify-center bg-navy">
                      <Logo size={20} tone="paper" />
                    </span>
                    <p className="max-w-[60ch] pt-1.5 text-[16px] leading-[1.55] text-ink">
                      <span className="sr-only">Arc: </span>
                      {m.text}
                    </p>
                  </>
                ) : (
                  <p className="max-w-[48ch] border border-rule bg-paper px-3.5 py-2.5 text-[15.5px] leading-[1.5] text-ink shadow-[inset_3px_0_0_var(--cobalt)]">
                    <span className="sr-only">You: </span>
                    {m.text}
                  </p>
                )}
              </motion.li>
            ))}
            {topic === 'focus' && choices && !thinking && (
              <li className="sm:pl-12">
                <div className="panel p-3 sm:p-4" role="group" aria-label="Where to start: every exercise Arc can track">
                  <div className="t-label mb-3">Every exercise Arc can track</div>
                  <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-x-4">
                    {choices.map((g) => (
                      <div key={g.area} className="contents">
                        <span className="t-meta text-navy sm:pt-2.5">{g.area}</span>
                        <div className="flex flex-wrap gap-2">
                          {g.exercises.map((e) => (
                            <button key={e.id} type="button" className="chip" onClick={() => send(e.name)}>
                              {e.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            )}
            {thinking && (
              <li className="t-meta flex items-center gap-3 pl-12">
                <Lamp tone="primary" blink /> Arc is thinking…
              </li>
            )}
          </ol>

          {error && (
            <div className="mt-5">
              <Alert tone="bad">{error}</Alert>
            </div>
          )}

          {program && <WeekCard program={program} />}
          <div ref={listEnd} className="scroll-mb-40" />
        </section>

        <aside className="hidden min-w-0 lg:block" aria-label="What Arc is learning">
          <div className="panel sticky top-24 p-4">
            <div className="t-label">What Arc is learning</div>
            <ol className="mt-3">
              {ONBOARDING_TOPICS.map((t, i) => {
                const state = done || i < step ? 'done' : i === step ? 'now' : 'next'
                return (
                  <li key={t} className="flex items-center gap-3 border-b border-rule py-2.5 last:border-b-0">
                    <Lamp tone={state === 'done' ? 'good' : state === 'now' ? 'primary' : 'default'} blink={state === 'now' && thinking} />
                    <span className={`text-[14px] ${state === 'next' ? 'text-muted' : 'text-ink'}`}>
                      {TOPIC_LABELS[t]}
                      {state === 'done' && <span className="sr-only"> (answered)</span>}
                      {state === 'now' && <span className="sr-only"> (asking now)</span>}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </aside>
      </main>

      {/* ---- the composer, pinned to the bottom of the screen ---- */}
      {!done && (
        <footer className="sticky bottom-0 z-10 border-t border-rule-strong bg-paper pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto w-full max-w-[1180px] px-4 py-3 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
            <div className="min-w-0">
              {topic && !thinking && QUICK_REPLIES[topic].length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Quick answers">
                  {QUICK_REPLIES[topic].map((r) => (
                    <button key={r} type="button" className="chip" onClick={() => send(r)}>
                      {r}
                    </button>
                  ))}
                </div>
              ) : null}
              <form onSubmit={onSubmit} className="flex items-stretch gap-2">
                <label htmlFor="arc-answer" className="sr-only">
                  Your answer
                </label>
                <input
                  ref={input}
                  id="arc-answer"
                  className="input min-w-0 flex-1"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={mic === 'listening' ? 'Listening…' : 'Type your answer…'}
                  autoComplete="off"
                  disabled={thinking}
                />
                {listener.supported && (
                  <button
                    type="button"
                    className="btn btn-icon"
                    aria-pressed={mic === 'listening'}
                    aria-label={mic === 'listening' ? 'Stop listening' : mic === 'blocked' ? 'Microphone blocked' : 'Answer by voice'}
                    onClick={() => (mic === 'listening' ? listener.stop() : listener.start())}
                  >
                    {mic === 'listening' ? <Lamp tone="good" blink /> : <IconMic size={18} />}
                  </button>
                )}
                <button type="submit" className="btn btn-block" disabled={thinking || !draft.trim()}>
                  <IconSend size={16} aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Send</span>
                </button>
              </form>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}

/** The week Arc built, Monday to Sunday, with the way to the dashboard's calendar. */
function WeekCard({ program }: { program: ProgramDto }) {
  return (
    <section className="panel mt-8 p-4 sm:p-5" aria-label="Your week">
      <div className="t-label flex items-center gap-2">
        <Lamp tone="good" /> Your week is ready
      </div>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.55] text-ink">{program.summary}</p>
      <ol className="mt-4 border-t border-rule-strong">
        {WEEK.map((d) => {
          const day = program.days.find((x) => x.weekday === d)
          return (
            <li key={d} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 border-b border-rule py-2.5 sm:grid-cols-[64px_minmax(0,1fr)]">
              <span className={`t-meta pt-0.5 ${day ? 'text-navy' : ''}`}>{WEEKDAY_NAMES[d]!.slice(0, 3)}</span>
              {day ? (
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{day.title}</span>
                  {day.items.map((item, i) => (
                    <span key={i} className="block font-mono text-[12.5px] leading-[1.6] text-ink-2">
                      {EXERCISES[item.exercise].name} · {item.side} · {item.sets} × {item.reps} · {item.restSeconds} s rest
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-[14px] text-muted">Rest</span>
              )}
            </li>
          )
        })}
      </ol>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/dashboard" className="btn btn-block">
          <Lamp tone="primary" /> See it on your dashboard
        </Link>
        <Link to="/record" className="btn">
          Start recording
        </Link>
      </div>
    </section>
  )
}
