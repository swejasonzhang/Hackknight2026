import { CHALLENGE_IDS, CHALLENGES, challengeProgress, type Challenge, type ChallengeId } from '@arc/dependencies'
import { useReducedMotion } from 'motion/react'
import { startTransition, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiRequestError } from '../api/client'
import { useBody } from '../body/useBody'
import { ChallengeCatalog } from '../challenges/ChallengeCatalog'
import { ChallengeDetail } from '../challenges/ChallengeDetail'
import { startQuestion } from '../challenges/facts'
import { useChallengeRun } from '../challenges/useChallengeRun'
import { YourChallenge } from '../challenges/YourChallenge'
import { Page } from '../components/motion'
import { ProfilePicker } from '../components/ProfilePicker'
import { Alert, PageHeader, Skeleton, Strip } from '../components/ui'
import { useStickyTop } from '../components/useStickyTop'
import { useProfiles } from '../hooks/useProfiles'

const isChallengeId = (v: string | null): v is ChallengeId => CHALLENGE_IDS.includes(v as ChallengeId)

/**
 * /challenges: fixed plans for a physique in a set time (challenges.ts). First the profile's own
 * challenge, when it has one: the week it is in, the training days done, the phases, the way out.
 * Then every challenge as a card, the one picked open beside them (under them on a phone): who it
 * is for, the body it builds by the finish from the member's own body today, its phases and first
 * week, and the way to start it, which makes its first phase the week. The pick lives in the URL
 * (`/challenges?challenge=v_taper`).
 */
export function ChallengesPage() {
  const { profiles, selected, selectedId, loading: profilesLoading } = useProfiles()
  const [params, setParams] = useSearchParams()
  const { run, setRun, starts, error: loadError } = useChallengeRun(selectedId)
  const { body, error: bodyError } = useBody(selectedId)
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null)
  // What takes the focus once the page has redrawn, after the button that had it went away.
  const [focusOn, setFocusOn] = useState<'run' | 'message' | null>(null)
  const [detailRef, detailTop] = useStickyTop<HTMLElement>(32)
  const catalogRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  // The profile on the page now: a start or a leave that comes back after a switch to another
  // profile was for the one before, and must not land on this one.
  const current = useRef(selectedId)
  const reduce = useReducedMotion()
  const detailId = useId()
  const titleId = useId()

  const noProfiles = !profilesLoading && profiles.length === 0
  const mine = run ? CHALLENGES[run.challengeId] : undefined
  const progress = useMemo(() => (run && mine ? challengeProgress(run, mine, starts ?? [], Date.now(), new Date().getTimezoneOffset()) : null), [run, mine, starts])
  const running = run?.status === 'active' && mine ? mine : null
  // The card picked is in the URL; without one, the challenge under way, else the first. Until the
  // profile's challenge is known there is none, so the detail waits rather than jumps (unless it
  // could not load: then the first opens, with nothing to start).
  const param = params.get('challenge')
  const waiting = profilesLoading || (Boolean(selectedId) && run === undefined && !loadError)
  const pickedId = isChallengeId(param) ? param : waiting ? null : (running?.id ?? CHALLENGE_IDS[0])
  const picked = pickedId ? CHALLENGES[pickedId] : null
  const bodyNow = body && body.profileId === selectedId ? body : null

  // Another profile: the one a start or a leave still out must now be for, and its own messages.
  useEffect(() => {
    current.current = selectedId
    setMessage(null)
    setStartError(null)
  }, [selectedId])

  // A challenge just started is announced: its name scrolls into view and takes focus. After a
  // leave the strip with its button is gone, so the message where it stood takes the focus.
  useEffect(() => {
    if (!focusOn) return
    setFocusOn(null)
    if (focusOn === 'message') {
      messagesRef.current?.focus()
    } else if (titleRef.current) {
      titleRef.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
      titleRef.current.focus({ preventScroll: true })
    }
  }, [focusOn, reduce])

  const setPicked = (id: ChallengeId) =>
    setParams(
      (p) => {
        p.set('challenge', id)
        return p
      },
      { replace: true },
    )

  const pick = (id: ChallengeId) => {
    setPicked(id)
    setStartError(null)
    // The detail's top comes into view when it is out of sight: under the cards on a phone, or
    // scrolled past beside them on a wide screen, where it is the taller column.
    const top = detailRef.current?.getBoundingClientRect().top ?? 0
    if (top < 0 || top > window.innerHeight * 0.6) detailRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  // On to the cards, the focus on the one open beside them.
  const pickNext = () => {
    catalogRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    catalogRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true })
  }

  const start = async (challenge: Challenge) => {
    if (!selected) return
    const who = selected
    setBusy(true)
    setStartError(null)
    setMessage(null)
    try {
      // Starting replaces the week in force, so ask first when there is one (a 404: none yet).
      const hasWeek = await api.plan.program(who.id).then(
        () => true,
        (err: unknown) => !(err instanceof ApiRequestError && err.status === 404),
      )
      if (current.current !== who.id) return
      const question = startQuestion(challenge, who.name, running, hasWeek)
      if (question && !window.confirm(question)) return
      const next = await api.challenge.start(who.id, { challengeId: challenge.id, tzOffsetMinutes: new Date().getTimezoneOffset() })
      if (current.current !== who.id) return
      setRun(next)
      setMessage({ tone: 'good', text: `${who.name} started ${challenge.name}. The week is now phase 1: ${challenge.phases[0]!.name}.` })
      setFocusOn('run')
    } catch (err) {
      if (current.current === who.id) setStartError(err instanceof Error ? err.message : 'Could not start the challenge')
    } finally {
      setBusy(false)
    }
  }

  const leave = async () => {
    if (!selected || !running) return
    const who = selected
    if (!window.confirm(`Leave ${running.name}? ${who.name}'s week stays as it is, to keep or to change on the plan page.`)) return
    setBusy(true)
    setMessage(null)
    try {
      await api.challenge.leave(who.id)
      if (current.current !== who.id) return
      // The challenge just left stays open, rather than the detail jumping to another. The router
      // moves to the new URL in a transition, so the rest goes in it too: drawn apart, the detail
      // would flash to the first challenge in between.
      startTransition(() => {
        if (!isChallengeId(param)) setPicked(running.id)
        setRun(null)
        setMessage({ tone: 'good', text: `${who.name} left ${running.name}. The week stays as it was.` })
        setFocusOn('message')
      })
    } catch (err) {
      if (current.current === who.id) setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not leave the challenge' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Challenges / fixed plans"
        title="Challenges"
        subtitle="A fixed plan with a finish line. Pick the body you are after and how long you give it: Arc sets your week to it, steps it up phase by phase and shows where it takes you."
        actions={profiles.length > 1 ? <ProfilePicker /> : undefined}
      />
      <div className="rule-strong" />

      {(loadError || message) && (
        <div ref={messagesRef} tabIndex={-1} className="flex flex-col gap-2 pt-4">
          {loadError && (
            <Alert tone="bad">
              Could not check for {selected ? `${selected.name}'s` : 'a'} challenge ({loadError}), so none can start until it loads. Reload the page to try again.
            </Alert>
          )}
          {message && <Alert tone={message.tone}>{message.text}</Alert>}
        </div>
      )}

      {run && mine && progress && (
        <div className="mt-6">
          <YourChallenge run={run} challenge={mine} progress={progress} counted={starts !== null} index="01" busy={busy} onLeave={() => void leave()} onPickNext={pickNext} titleRef={titleRef} />
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-12">
        <div ref={catalogRef} className="min-w-0 lg:col-span-7">
          <Strip index={run && mine ? '02' : '01'} title="Pick a challenge" aside="Eight fixed plans">
            {noProfiles && (
              <p className="t-desc mb-4">
                A challenge sets one person's week: <Link to="/profiles">add a profile</Link> to start one. Every plan is here to look through.
              </p>
            )}
            <ChallengeCatalog value={pickedId} onChange={pick} run={run} controls={detailId} />
          </Strip>
        </div>

        {/* The offset only means something where the detail is sticky (lg); elsewhere it is in the flow. */}
        <section
          ref={detailRef}
          id={detailId}
          aria-labelledby={picked ? titleId : undefined}
          aria-busy={picked ? undefined : true}
          className="panel min-w-0 self-start p-4 sm:p-5 lg:sticky lg:top-(--sticky-top) lg:col-span-5"
          style={{ '--sticky-top': `${detailTop}px` } as CSSProperties}
        >
          {picked ? (
            <ChallengeDetail
              challenge={picked}
              titleId={titleId}
              profile={selected}
              noProfiles={noProfiles}
              ready={run !== undefined}
              body={bodyNow}
              bodyLoading={Boolean(selected) && !bodyNow && !bodyError}
              bodyFailed={Boolean(selected) && !bodyNow && Boolean(bodyError)}
              running={running?.id === picked.id && progress ? { week: progress.week, phase: progress.phase } : null}
              busy={busy}
              error={startError}
              onStart={() => void start(picked)}
            />
          ) : (
            <Skeleton height={520} />
          )}
        </section>
      </div>
    </Page>
  )
}
