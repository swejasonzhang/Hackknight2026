import { BODY_AREAS, EXERCISES, exercisesIn, type BodyArea, type ExerciseId } from '@arc/dependencies'
import { useId } from 'react'
import { Segmented } from './ui'

const SHORT_AREA: Record<BodyArea, string> = { upper: 'Upper', back: 'Back', legs: 'Legs', core: 'Core' }
const AREA_OPTIONS = BODY_AREAS.map((a) => ({ value: a.id, label: a.name, short: a.id === 'upper' ? SHORT_AREA[a.id] : undefined }))

/**
 * The dashboard's choice of movement: four body-area tabs (Upper body, Back, Legs, Core) over the
 * area's movements from the camera app's catalog. Switching area picks its first movement; the
 * picked movement drives everything on the dashboard.
 */
export function ExercisePicker({ value, onChange }: { value: ExerciseId; onChange: (exercise: ExerciseId) => void }) {
  const area = EXERCISES[value].area
  const groupId = useId()
  const areaName = BODY_AREAS.find((a) => a.id === area)!.name
  return (
    <div>
      <Segmented label="Body area" options={AREA_OPTIONS} value={area} onChange={(a) => onChange(exercisesIn(a)[0]!.id)} />
      <div id={groupId} role="group" aria-label={`${areaName} exercises`} className="mt-3 flex flex-wrap gap-2">
        {exercisesIn(area).map((e) => (
          <button key={e.id} type="button" className="chip" aria-pressed={e.id === value} onClick={() => onChange(e.id)}>
            {e.name}
          </button>
        ))}
      </div>
    </div>
  )
}
