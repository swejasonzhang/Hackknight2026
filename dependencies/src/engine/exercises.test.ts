import { describe, expect, it } from 'vitest'
import { BODY_AREAS, EXERCISE_LIST, EXERCISES, exercisesFor, exercisesIn, MUSCLES, sideLabel } from './exercises.ts'
import { EXERCISE_IDS, LM, MUSCLE_IDS } from './types.ts'

describe('the exercise catalog', () => {
  it("covers the camera app's fourteen movements and the seated knee extension, in four areas", () => {
    expect(EXERCISE_IDS).toHaveLength(15)
    expect(EXERCISE_LIST.map((e) => e.id)).toEqual([...EXERCISE_IDS])
    expect(BODY_AREAS.map((a) => a.name)).toEqual(['Upper body', 'Back', 'Legs', 'Core'])
    expect(exercisesIn('upper').map((e) => e.name)).toEqual(['Bicep curl', 'Tricep extension', 'Shoulder press', 'Lateral raise', 'Front raise', 'Chest press', 'Pec fly'])
    expect(exercisesIn('back').map((e) => e.name)).toEqual(['Lat pulldown', 'Bent-over row', 'Deadlift'])
    expect(exercisesIn('legs').map((e) => e.name)).toEqual(['Squat', 'Lunge', 'Seated knee extension'])
    expect(exercisesIn('core').map((e) => e.name)).toEqual(['Crunch', 'Ab twist'])
  })

  it('gives every movement a unique name and a short label that fits a tab', () => {
    expect(new Set(EXERCISE_LIST.map((e) => e.name)).size).toBe(15)
    expect(new Set(EXERCISE_LIST.map((e) => e.short)).size).toBe(15)
    for (const e of EXERCISE_LIST) expect(e.short.length, e.id).toBeLessThanOrEqual(8)
  })

  it('keeps every rep threshold between rest and the goal, so a rep can start, peak and finish', () => {
    for (const e of EXERCISE_LIST) {
      expect(e.restDeg, `${e.id} rest below exit`).toBeLessThan(e.exitDeg)
      expect(e.exitDeg, `${e.id} exit below enter`).toBeLessThan(e.enterDeg)
      expect(e.enterDeg, `${e.id} enter at or below the goal`).toBeLessThanOrEqual(e.targetDeg)
      expect(e.targetDeg, `${e.id} goal within what the figure shows`).toBeLessThanOrEqual(e.maxDeg)
    }
  })

  it('measures on the same landmarks as the camera app, per side', () => {
    expect(EXERCISES.elbow_flexion.joints.right).toEqual([LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST])
    expect(EXERCISES.front_raise.joints.left).toEqual([LM.LEFT_HIP, LM.LEFT_SHOULDER, LM.LEFT_WRIST])
    expect(EXERCISES.deadlift.joints.right).toEqual([LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE])
    expect(EXERCISES.squat.joints.left).toEqual([LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE])
    // Whole-body measures read the same landmarks whichever side is picked.
    expect(EXERCISES.pec_fly.joints.left).toEqual([LM.LEFT_WRIST, LM.LEFT_SHOULDER, LM.RIGHT_WRIST])
    expect(EXERCISES.pec_fly.joints.right).toEqual(EXERCISES.pec_fly.joints.left)
    expect(EXERCISES.ab_twist.measure).toBe('tilt')
  })

  it('turns the joint angle into a metric that rises into the rep', () => {
    // Bending movements count flexion (180 minus the inner angle); straightening ones count the angle itself.
    expect(EXERCISES.squat.metricFromInnerAngle(80)).toBe(100)
    expect(EXERCISES.tricep_extension.metricFromInnerAngle(170)).toBe(170)
    expect(EXERCISES.lat_pulldown.metricFromInnerAngle(60)).toBe(120)
    expect(EXERCISES.deadlift.metricFromInnerAngle(175)).toBe(175)
  })

  it('names what every movement works: at least one target muscle, never one muscle twice', () => {
    for (const e of EXERCISE_LIST) {
      expect(e.muscles.primary.length, e.id).toBeGreaterThan(0)
      const all = [...e.muscles.primary, ...e.muscles.secondary]
      expect(new Set(all).size, e.id).toBe(all.length)
      for (const m of all) expect(MUSCLE_IDS, e.id).toContain(m)
    }
    expect(Object.keys(MUSCLES)).toEqual([...MUSCLE_IDS])
  })

  it('splits the back into upper back, lats and lower back, each worked by a back exercise', () => {
    expect(exercisesFor('upper_back').primary.map((e) => e.id)).toEqual(['bent_over_row'])
    expect(exercisesFor('lats').primary.map((e) => e.id)).toEqual(['lat_pulldown', 'bent_over_row'])
    expect(exercisesFor('lower_back').primary.map((e) => e.id)).toEqual(['deadlift'])
    expect(exercisesFor('lower_back').secondary.map((e) => e.id)).toEqual(['bent_over_row', 'squat', 'ab_twist'])
    // The most focused movement first: the lateral raise works only the side shoulders.
    expect(exercisesFor('side_delts').primary.map((e) => e.id)).toEqual(['shoulder_abduction', 'shoulder_press'])
  })

  it('asks for a side only where one arm or leg does the work', () => {
    const sided = EXERCISE_LIST.filter((e) => e.sided).map((e) => e.id)
    expect(sided).toEqual(['elbow_flexion', 'tricep_extension', 'shoulder_abduction', 'front_raise', 'bent_over_row', 'lunge', 'seated_knee_extension'])
    expect(sideLabel('elbow_flexion', 'left')).toBe('left')
    expect(sideLabel('deadlift', 'right')).toBe('both sides')
    expect(sideLabel('ab_twist', 'left')).toBe('both sides')
  })
})
