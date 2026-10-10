import type { ProgramDto, SessionDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiRequestError } from '../api/client'
import { Page } from '../components/motion'
import { ProfilePicker } from '../components/ProfilePicker'
import { Alert, EmptyState, PageHeader, Skeleton, Strip } from '../components/ui'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useProfiles } from '../hooks/useProfiles'
import { nextEntry, plannedDay } from '../plan/checklist'
import { DayLog } from '../plan/DayLog'
import { dayKey, defaultDay, parseDayKey, type DayKey } from '../plan/days'
import { WeekEditor } from '../plan/WeekEditor'

/**
 * The week beside the log, 40 to 60: on the left the week in force, to arrange by hand (any days,
 * several movements a day for the muscle groups picked, every number; earlier weeks to start
 * from); on the right the log, one day at a time, a training day showing what was planned and
 * crossing it out as it gets done. The day lives in the URL (`/plan?day=2026-10-09`), so a
 * session opened from the log comes back to the same day.
 */
export function PlanPage() {
  const { profiles, selected, selectedId, loading: profilesLoading } = useProfiles()
  const [params, setParams] = useSearchParams()
  const [program, setProgram] = useState<ProgramDto | null>(null)
  const [sessions, setSessions] = useState<SessionDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setSessions(null)
    setError(null)
    Promise.all([
      api.plan.program(selectedId).catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.status === 404) return null
        throw err
      }),
      api.sessions.list(selectedId),
    ])
      .then(([p, s]) => {
        if (cancelled) return
        setProgram(p)
        setSessions(s)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the week')
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const today = dayKey(Date.now())
  const requested = parseDayKey(params.get('day'))
  // Today when it is a training day, so the day's workout is the first thing on the page.
  const day: DayKey = requested && requested <= today ? requested : sessions && plannedDay(program, sessions, today) ? today : defaultDay(sessions ?? [])
  const setDay = (next: DayKey) => setParams({ day: next }, { replace: true })
  const todayNext = sessions ? (nextEntry(plannedDay(program, sessions, today)?.list ?? [])?.item.exercise ?? null) : null
  const noProfiles = !profilesLoading && profiles.length === 0
  // Side by side on a wide screen (the week first); stacked on a phone (the log first).
  const wide = useMediaQuery('(min-width: 1024px)')

  return (
    <Page>
      <PageHeader
        eyebrow="Plan · log"
        title={noProfiles ? 'Plan' : (selected?.name ?? 'Plan')}
        subtitle="Arrange your week: any days, several movements a day for the muscles you pick. Then step through the days: what was planned, and what got done."
        actions={<ProfilePicker />}
      />
      <div className="rule-strong" />

      {error && (
        <div className="mt-6">
          <Alert tone="bad">{error}</Alert>
        </div>
      )}

      {noProfiles ? (
        <div className="mt-6">
          <EmptyState
            title="No profiles yet"
            description="A week belongs to a person. Add a profile first, or load the demo profile to see a log of six weeks."
            action={
              <Link className="btn btn-block" to="/profiles">
                Go to profiles
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:gap-10">
          {/* On a phone the day's log comes first: it is what the page is opened for mid-week. */}
          <div className="order-2 min-w-0 lg:order-1">
            <Strip index={wide ? '01' : '02'} title="Week" aside={program ? 'Yours to change' : 'Build one by hand, or with Arc'}>
              {selectedId && sessions ? (
                <WeekEditor profileId={selectedId} program={program} onSaved={setProgram} history side={selected?.intake?.side} todayNext={todayNext} />
              ) : (
                <Skeleton height={420} />
              )}
            </Strip>
          </div>
          <div className="order-1 min-w-0 lg:order-2">
            <Strip index={wide ? '02' : '01'} title="Log" aside="One day at a time">
              {sessions ? <DayLog sessions={sessions} day={day} today={today} onDayChange={setDay} program={program} /> : <Skeleton height={420} />}
            </Strip>
          </div>
        </div>
      )}
    </Page>
  )
}
