import { expect, it } from 'vitest'
import { EXERCISE_LIST } from './exercises.ts'

/**
 * The Python camera app counts reps from Arc's catalog, not thresholds of its own: this writes
 * the numbers it needs to computer-vision/arc_catalog.json and fails when the file and
 * exercises.ts disagree. After changing the catalog, `npm run catalog -w dependencies` rewrites it.
 */
it('the camera app reads the same thresholds, goals and limits as the browser', async () => {
  const exercises = Object.fromEntries(
    EXERCISE_LIST.map((e) => [
      e.id,
      {
        name: e.name,
        sided: e.sided,
        measure: e.measure ?? 'angle',
        // "bend" counts 180 minus the joint's inner angle, "inner" the angle itself.
        metric: e.metricFromInnerAngle(0) === 180 ? 'bend' : 'inner',
        restDeg: e.restDeg,
        exitDeg: e.exitDeg,
        enterDeg: e.enterDeg,
        targetDeg: e.targetDeg,
        maxDeg: e.maxDeg,
        minRepMs: e.minRepMs,
      },
    ]),
  )
  const file = { source: 'dependencies/src/engine/exercises.ts', note: 'Written by `npm run catalog -w dependencies`; change exercises.ts, never this file.', exercises }
  await expect(`${JSON.stringify(file, null, 2)}\n`).toMatchFileSnapshot('../../../computer-vision/arc_catalog.json')
})
