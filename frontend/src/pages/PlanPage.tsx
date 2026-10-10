import type { PlanDto, SessionDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Page } from '../components/motion'
import { PlanEditor } from '../components/PlanEditor'
import { ProfilePicker } from '../components/ProfilePicker'
import { Alert, EmptyState, PageHeader, Skeleton, Strip } from '../components/ui'
import { useStickyTop } from '../components/useStickyTop'
import { useProfiles } from '../hooks/useProfiles'
import { DayLog } from '../plan/DayLog'
import { dayKey, defaultDay, parseDayKey, type DayKey } from '../plan/days'

/**
 * The plan and the log side by side, 30 to 70: on the left the plan (what recording its
 * movement uses; other movements follow the week; sticky on desktop), on the right the log, one
 * day at a time. The day lives in the
 * URL (`/plan?day=2026-10-09`), so a session opened from the log comes back to the same day.
 */
export function PlanPage() {
  const { profiles, selected, selectedId, loading: profilesLoading } = useProfiles()
  const [params, setParams] = useSearchParams()
  const [plan, setPlan] = useState<PlanDto | null>(null)
  const [sessions, setSessions] = useState<SessionDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [planRef, planTop] = useStickyTop<HTMLDivElement>(32)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setSessions(null)
    setError(null)
    Promise.all([api.plan.get(selectedId).catch(() => null), api.sessions.list(selectedId)])
      .then(([p, s]) => {
        if (cancelled) return
        setPlan(p)
        setSessions(s)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the log')
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const today = dayKey(Date.now())
  const requested = parseDayKey(params.get('day'))
  const day: DayKey = requested && requested <= today ? requested : defaultDay(sessions ?? [])
  const setDay = (next: DayKey) => setParams({ day: next }, { replace: true })
  const noProfiles = !profilesLoading && profiles.length === 0

  return (
    <Page>
      <PageHeader
        eyebrow="Plan · log"
        title={noProfiles ? 'Plan' : (selected?.name ?? 'Plan')}
        subtitle="Set your own numbers for a movement, then step through the days to see each workout and how it moved."
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
            description="A plan belongs to a person. Add a profile first, or load the demo profile to see a log of six weeks."
            action={
              <Link className="btn btn-block" to="/profiles">
                Go to profiles
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)] lg:gap-10">
          <div ref={planRef} className="min-w-0 lg:sticky lg:self-start" style={{ top: planTop }}>
            <Strip index="01" title="Plan" aside="Used when you record its movement">
              {selectedId && sessions ? <PlanEditor profileId={selectedId} plan={plan} onSaved={setPlan} compact /> : <Skeleton height={360} />}
            </Strip>
          </div>
          <div className="min-w-0">
            <Strip index="02" title="Log" aside="One day at a time">
              {sessions ? <DayLog sessions={sessions} day={day} today={today} onDayChange={setDay} /> : <Skeleton height={420} />}
            </Strip>
          </div>
        </div>
      )}
    </Page>
  )
}
