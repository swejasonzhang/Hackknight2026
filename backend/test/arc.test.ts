import { BODY_AREAS, EXERCISE_LIST, ONBOARDING_TOPICS } from '@arc/dependencies'
import { describe, expect, it } from 'vitest'
import { extractIntake, ONBOARDING_QUESTIONS } from '../src/services/arc.ts'

/** The nine scripted answers with the focus answer swapped in. */
const answersWith = (focus: string) => ['Get stronger', 'Build muscle', focus, 'Right', 'None', 'Some', 'Monday and Thursday', 'skip', 'skip']

describe("Arc's own questions (Gemini off)", () => {
  it('asks where to start across the whole catalog, every area named', () => {
    const question = ONBOARDING_QUESTIONS.focus('Ada')
    for (const area of BODY_AREAS) expect(question.toLowerCase()).toContain(area.name.toLowerCase())
    expect(question).toMatch(/every exercise/i)
    expect(Object.keys(ONBOARDING_QUESTIONS)).toEqual([...ONBOARDING_TOPICS])
  })

  it('reads every exercise in the catalog by its own name', () => {
    for (const e of EXERCISE_LIST) expect(extractIntake(answersWith(e.name)).focus, e.name).toBe(e.id)
  })

  it('reads the area or the exercise named into a movement to start with', () => {
    const cases: [string, string][] = [
      ['Arms', 'elbow_flexion'],
      ['My biceps', 'elbow_flexion'],
      ['Triceps', 'tricep_extension'],
      ['Shoulders', 'shoulder_abduction'],
      ['Overhead press', 'shoulder_press'],
      ['Front raises', 'front_raise'],
      ['Chest', 'chest_press'],
      ['Pec flys', 'pec_fly'],
      ['Back', 'lat_pulldown'],
      ['My upper back', 'lat_pulldown'],
      ['Rows', 'bent_over_row'],
      ['Deadlifts', 'deadlift'],
      ['Legs', 'squat'],
      ['Squats', 'squat'],
      ['Lunges', 'lunge'],
      ['My knee', 'seated_knee_extension'],
      ['Core', 'crunch'],
      ['Abs', 'crunch'],
      ['Obliques, twisting', 'ab_twist'],
    ]
    for (const [answer, focus] of cases) expect(extractIntake(answersWith(answer)).focus, answer).toBe(focus)
  })

  it('does not read "come back from an injury" as the back', () => {
    const answers = answersWith('not sure')
    answers[0] = 'Come back from an injury'
    expect(extractIntake(answers).focus).toBe('elbow_flexion')
  })
})
