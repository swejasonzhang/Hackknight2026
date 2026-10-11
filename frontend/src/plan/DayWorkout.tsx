import type { ProgramDto, SessionDto } from '@arc/dependencies'
import { useEffect, useState } from 'react'
import { api, ApiRequestError } from '../api/client'
import { Lamp } from '../components/ui'
import { plannedDay } from './checklist'
import { dayKey, type DayKey } from './days'
import { TodayList } from './TodayList'

/**
 * A day's workout from the week in force, fetched for a profile: what was planned under each
 * muscle group, crossed out as it got done, and on the day itself the way to the next movement.
 * Nothing when the week has no training that day.
 */
export function DayWorkout({ profileId, day }: { profileId: string; day: DayKey }) {
  const [data, setData] = useState<{ program: ProgramDto | null; sessions: SessionDto[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.plan.program(profileId).catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.status === 404) return null
        throw err
      }),
      api.sessions.list(profileId),
    ])
      .then(([program, sessions]) => !cancelled && setData({ program, sessions }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [profileId, day])

  const planned = data ? plannedDay(data.program, data.sessions, day) : null
  if (!planned) return null
  const today = day === dayKey(Date.now())
  return (
    <section className="panel p-4 sm:p-5" aria-label={today ? "Today's workout" : 'That day\'s workout'}>
      <div className="t-label flex items-center gap-2">
        <Lamp tone={planned.list.every((e) => e.done) ? 'good' : 'primary'} /> {today ? 'Today' : 'That day'} · {planned.day.title}
      </div>
      <TodayList list={planned.list} canRecord={today} back={{ from: `/plan?day=${day}`, label: 'Plan' }} label={today ? "Today's workout" : "That day's workout"} />
    </section>
  )
}
