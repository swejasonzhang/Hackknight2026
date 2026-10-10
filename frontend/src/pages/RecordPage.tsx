import { EXERCISE_IDS, prescriptionFor, type ExerciseId, type PlanDto, type ProgramDto, type SessionDto } from '@arc/dependencies'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Page } from '../components/motion'
import { ProfilePicker } from '../components/ProfilePicker'
import { EmptyState, Lamp, PageHeader, Skeleton } from '../components/ui'
import { useProfiles } from '../hooks/useProfiles'
import { nextEntry, plannedDay } from '../plan/checklist'
import { dayKey } from '../plan/days'
import { TodayList } from '../plan/TodayList'
import { LiveRecorder, type RecordConfig } from '../record/LiveRecorder'

const isExercise = (v: string | null): v is ExerciseId => EXERCISE_IDS.includes(v as ExerciseId)

/**
 * /record: a session recorded in the browser for the selected profile. The movement is the one
 * named in ?exercise= (the dashboard's pick, the log's Record), else today's next movement not
 * done yet, else the plan's; its sets, reps, rest and goal come from `prescriptionFor`: today's
 * prescription in the week, else the plan, else the week, else the member's goal ranges. On a
 * training day, today's workout sits under the camera, crossed out as it gets done, with the way
 * to the next movement. In development, ?simulate replaces the camera with a pretend person.
 */
export function RecordPage() {
  const { selected, selectedId, profiles, loading } = useProfiles()
  const [params] = useSearchParams()
  const [data, setData] = useState<{ plan: PlanDto | null; program: ProgramDto | null; sessions: SessionDto[] } | undefined>(undefined)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setData(undefined)
    Promise.all([api.plan.get(selectedId).catch(() => null), api.plan.program(selectedId).catch(() => null), api.sessions.list(selectedId).catch(() => [])]).then(([plan, program, sessions]) => {
      if (!cancelled) setData({ plan, program, sessions })
    })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const requested = params.get('exercise')
  const intake = selected?.intake
  const today = useMemo(() => (data ? plannedDay(data.program, data.sessions, dayKey(Date.now())) : null), [data])
  const config = useMemo<RecordConfig | null>(() => {
    if (data === undefined) return null
    const exercise: ExerciseId = isExercise(requested) ? requested : (nextEntry(today?.list ?? [])?.item.exercise ?? data.plan?.exercise ?? 'elbow_flexion')
    const p = prescriptionFor(exercise, { plan: data.plan, program: data.program, intake })
    // The weight held last time for this movement starts the weight field.
    const last = data.sessions.filter((s) => s.exercise === exercise && s.loadKg != null).sort((a, b) => b.startedAt - a.startedAt)[0]
    return { exercise, side: p.side, plan: { sets: p.sets, reps: p.reps, restSeconds: p.restSeconds, targetDeg: p.targetDeg }, loadKg: last?.loadKg ?? null }
  }, [data, requested, intake, today])
  const simulate = import.meta.env.DEV && params.has('simulate')
  const noProfiles = !loading && profiles.length === 0

  return (
    <Page>
      <PageHeader eyebrow="Record · live" title={selected?.name ?? 'Record'} subtitle="Arc counts every rep through the webcam. Sets and rests run by themselves; each set is saved as it finishes." actions={<ProfilePicker />} />
      <div className="rule-strong" />
      <div className="mt-6">
        {noProfiles ? (
          <EmptyState
            title="No profiles yet"
            description="A session belongs to a person. Add a profile first."
            action={
              <Link className="btn btn-block" to="/profiles">
                Go to profiles
              </Link>
            }
          />
        ) : config && selectedId ? (
          <LiveRecorder
            key={`${selectedId}-${config.exercise}-${config.side}`}
            profileId={selectedId}
            config={config}
            simulate={simulate}
            below={
              today && (
                <section className="panel mt-4 p-4 sm:p-5" aria-label="Today's workout">
                  <div className="t-label flex items-center gap-2">
                    <Lamp tone="primary" /> Today · {today.day.title}
                  </div>
                  <TodayList list={today.list} current={config.exercise} canRecord label="Today's workout" />
                </section>
              )
            }
          />
        ) : (
          <Skeleton height={420} />
        )}
      </div>
    </Page>
  )
}
