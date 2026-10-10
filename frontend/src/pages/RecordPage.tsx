import { EXERCISE_IDS, prescriptionFor, type ExerciseId, type PlanDto, type ProgramDto } from '@arc/dependencies'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Page } from '../components/motion'
import { ProfilePicker } from '../components/ProfilePicker'
import { EmptyState, PageHeader, Skeleton } from '../components/ui'
import { useProfiles } from '../hooks/useProfiles'
import { LiveRecorder, type RecordConfig } from '../record/LiveRecorder'

const isExercise = (v: string | null): v is ExerciseId => EXERCISE_IDS.includes(v as ExerciseId)

/**
 * /record: a session recorded in the browser for the selected profile. The movement is the one
 * named in ?exercise= (the dashboard's pick), else the plan's; its sets, reps, rest and goal come
 * from `prescriptionFor`: the plan when it is for that movement, else the week Arc built, else the
 * member's goal ranges. In development, ?simulate replaces the camera with a pretend person.
 */
export function RecordPage() {
  const { selected, selectedId, profiles, loading } = useProfiles()
  const [params] = useSearchParams()
  const [data, setData] = useState<{ plan: PlanDto | null; program: ProgramDto | null } | undefined>(undefined)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setData(undefined)
    Promise.all([api.plan.get(selectedId).catch(() => null), api.plan.program(selectedId).catch(() => null)]).then(([plan, program]) => {
      if (!cancelled) setData({ plan, program })
    })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const requested = params.get('exercise')
  const intake = selected?.intake
  const config = useMemo<RecordConfig | null>(() => {
    if (data === undefined) return null
    const exercise: ExerciseId = isExercise(requested) ? requested : (data.plan?.exercise ?? 'elbow_flexion')
    const p = prescriptionFor(exercise, { plan: data.plan, program: data.program, intake })
    return { exercise, side: p.side, plan: { sets: p.sets, reps: p.reps, restSeconds: p.restSeconds, targetDeg: p.targetDeg } }
  }, [data, requested, intake])
  const simulate = import.meta.env.DEV && params.has('simulate')
  const noProfiles = !loading && profiles.length === 0

  return (
    <Page>
      <PageHeader eyebrow="Record · live" title={selected?.name ?? 'Record'} subtitle="Arc counts every rep through the webcam. Sets and rests run by themselves; the session saves when the last set ends." actions={<ProfilePicker />} />
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
          <LiveRecorder key={`${selectedId}-${config.exercise}-${config.side}`} profileId={selectedId} config={config} simulate={simulate} />
        ) : (
          <Skeleton height={420} />
        )}
      </div>
    </Page>
  )
}
