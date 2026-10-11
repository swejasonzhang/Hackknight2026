import { EXERCISES, muscleGroupsOf, MUSCLES, sideLabel, type ExerciseId } from '@arc/dependencies'
import { Link } from 'react-router-dom'
import { Lamp } from '../components/ui'
import { nextEntry, type ChecklistEntry } from './checklist'

interface Props {
  list: ChecklistEntry[]
  /** The movement being recorded right now, marked instead of offered. */
  current?: ExerciseId
  /** Today: each movement not done yet can be recorded, and the next one is offered. */
  canRecord: boolean
  /** Where a session opened from here goes back to. */
  back?: { from: string; label: string }
  label?: string
}

/**
 * A training day as a checklist, gathered under the muscle group each movement works: a movement
 * done is crossed out (with its session a tap away), the next one is ringed, and on the day itself
 * each can be recorded, with the next one offered as the way on.
 */
export function TodayList({ list, current, canRecord, back, label = "The day's workout" }: Props) {
  const next = nextEntry(list)
  const groups = muscleGroupsOf(list.map((e) => e.item))
  const doneCount = list.filter((e) => e.done).length
  return (
    <div aria-label={label} role="group">
      <div className="t-meta" aria-live="polite">
        {doneCount} of {list.length} done
      </div>
      {groups.map((g) => (
        <section key={g.muscle} className="mt-3" aria-label={MUSCLES[g.muscle].name}>
          <div className="t-label text-navy">{MUSCLES[g.muscle].name}</div>
          <ol className="mt-1">
            {g.items.map(({ index }) => {
              const e = list[index]!
              const cfg = EXERCISES[e.item.exercise]
              const isNext = e === next
              const isCurrent = !e.done && current === e.item.exercise
              return (
                <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule py-2 last:border-b-0">
                  <Lamp tone={e.done ? 'good' : isNext ? 'primary' : 'default'} />
                  <span className={`min-w-0 flex-1 text-[15px] ${e.done ? 'text-muted line-through' : 'text-ink'}`}>
                    {cfg.name}
                    {e.done && <span className="sr-only"> (done)</span>}
                    <span className={`t-meta ml-2 normal-case ${e.done ? 'line-through' : ''}`}>
                      {sideLabel(e.item.exercise, e.item.side)} · {e.item.sets} × {e.item.reps} · goal {e.item.targetDeg}°
                    </span>
                  </span>
                  {e.done && e.session ? (
                    <Link to={`/sessions/${e.session.id}`} state={back} className="t-label text-cobalt">
                      Open →
                    </Link>
                  ) : isCurrent ? (
                    <span className="t-label text-cobalt">Now</span>
                  ) : canRecord ? (
                    <Link to={`/record?exercise=${e.item.exercise}`} className="t-label text-cobalt" aria-label={`Record ${cfg.name.toLowerCase()}`}>
                      Record
                    </Link>
                  ) : (
                    <span className="t-meta">Not recorded</span>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ))}
      {canRecord && next && next.item.exercise !== current && (
        <Link to={`/record?exercise=${next.item.exercise}`} className="btn btn-block mt-4">
          <Lamp tone="primary" /> Next: {EXERCISES[next.item.exercise].name}
        </Link>
      )}
      {!next && list.length > 0 && (
        <p className="t-mono mt-4 flex items-center gap-2 text-ok">
          <Lamp tone="good" /> Every movement done
        </p>
      )}
    </div>
  )
}
