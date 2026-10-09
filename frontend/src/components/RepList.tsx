import type { RepRecord, SessionPlan, SetRecord } from '@ptg/dependencies'
import { deg, pct } from '../format'

interface Props {
  metricLabel: string
  plan: SessionPlan
  currentSet: number
  currentReps: RepRecord[]
  completedSets: SetRecord[]
}

export function RepList({ metricLabel, plan, currentSet, currentReps, completedSets }: Props) {
  return (
    <div className="card">
      <h3>
        Set {Math.min(currentSet, plan.sets)} of {plan.sets}
        <span className="muted">
          {' '}
          · {currentReps.length} / {plan.reps} reps
        </span>
      </h3>
      <div className="chips">
        {Array.from({ length: plan.reps }, (_, i) => {
          const rep = currentReps[i]
          return (
            <span key={i} className={rep ? 'chip done' : 'chip'} title={rep ? `${rep.durationMs} ms` : 'not yet'}>
              {rep ? deg(rep.peakDeg) : '·'}
            </span>
          )
        })}
      </div>
      <p className="muted small">
        Peak {metricLabel.toLowerCase()} per rep. Goal {deg(plan.targetDeg)}.
      </p>
      {completedSets.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Set</th>
              <th>Reps</th>
              <th>Best</th>
              <th>ROM drop</th>
              <th>Tempo drift</th>
              <th>Ended</th>
            </tr>
          </thead>
          <tbody>
            {completedSets.map((s) => (
              <tr key={s.setNumber}>
                <td>{s.setNumber}</td>
                <td>{s.reps.length}</td>
                <td>{deg(Math.max(...s.reps.map((r) => r.peakDeg)))}</td>
                <td>{s.fatigue.sampleReps >= 4 ? deg(s.fatigue.romDropDeg) : '–'}</td>
                <td>{s.fatigue.sampleReps >= 4 ? pct(s.fatigue.tempoDrift) : '–'}</td>
                <td>{s.endedEarly ? 'early' : 'planned'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
