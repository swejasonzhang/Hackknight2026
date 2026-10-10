import { EXERCISE_IDS, EXERCISES, type ExerciseId, type PlanDto } from '@arc/dependencies'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Page } from '../components/motion'
import { ProfilePicker } from '../components/ProfilePicker'
import { EmptyState, PageHeader, Skeleton } from '../components/ui'
import { useProfiles } from '../hooks/useProfiles'
import { LiveRecorder, type RecordConfig } from '../record/LiveRecorder'

/**
 * /record: a session recorded in the browser for the selected profile, straight into its plan
 * (or, with no plan saved, the movement named in ?exercise= at 3 × 8 with 45 s rest). In
 * development, ?simulate replaces the camera with a pretend person doing reps.
 */
export function RecordPage() {
  const { selected, selectedId, profiles, loading } = useProfiles()
  const [params] = useSearchParams()
  const [plan, setPlan] = useState<PlanDto | null | undefined>(undefined)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setPlan(undefined)
    api.plan
      .get(selectedId)
      .then((p) => !cancelled && setPlan(p))
      .catch(() => !cancelled && setPlan(null))
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const requested = params.get('exercise')
  const fallback: ExerciseId = EXERCISE_IDS.includes(requested as ExerciseId) ? (requested as ExerciseId) : 'elbow_flexion'
  const config = useMemo<RecordConfig | null>(() => {
    if (plan === undefined) return null
    if (plan) return { exercise: plan.exercise, side: plan.side, plan: { sets: plan.sets, reps: plan.reps, restSeconds: plan.restSeconds, targetDeg: plan.targetDeg } }
    return { exercise: fallback, side: 'right', plan: { sets: 3, reps: 8, restSeconds: 45, targetDeg: EXERCISES[fallback].targetDeg } }
  }, [plan, fallback])
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
