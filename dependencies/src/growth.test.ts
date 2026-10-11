import { describe, expect, it } from 'vitest'
import { generateDemoSessions } from './engine/demo.ts'
import { EXERCISE_IDS, MUSCLE_IDS, type ExerciseId, type MuscleId, type SetRecord } from './engine/types.ts'
import { bodyGrowth, GROWTH, MUSCLE_SIZE, type GrowthSession } from './growth.ts'

const DAY = 86_400_000
const WEEK = 7 * DAY
const NOW = Date.UTC(2026, 9, 10, 21) // Saturday 10 Oct 2026, 21:00 UTC: the end of a demo week
const MONDAY = Date.UTC(2026, 9, 5) // Monday 5 Oct 2026, 00:00 UTC: the start of NOW's week, the last window

/** A set of `reps` counted reps. */
function set(reps: number): SetRecord {
  return {
    setNumber: 1,
    reps: Array.from({ length: reps }, (_, i) => ({ index: i + 1, peakDeg: 120, startedAt: i * 3000, endedAt: i * 3000 + 2000, durationMs: 2000 })),
    fatigue: { index: 0, romDecay: 0, tempoDrift: 0, romDropDeg: 0, sampleReps: reps },
    startedAt: 0,
    endedAt: reps * 3000,
    endedEarly: false,
  }
}

/** A session `daysAgo` before NOW: three sets of eight unless told otherwise, with a weight when given. */
function session(exercise: ExerciseId, daysAgo: number, { sets = 3, reps = 8, loadKg }: { sets?: number; reps?: number; loadKg?: number } = {}): GrowthSession {
  return { exercise, startedAt: NOW - daysAgo * DAY, sets: Array.from({ length: sets }, () => set(reps)), ...(loadKg != null ? { loadKg } : {}) }
}

/**
 * Each movement three times a week, on the Monday, Wednesday and Friday evenings (5, 3 and 1 days
 * before a Saturday like NOW), for `weeks` weeks, the last of them `weeksAgo` weeks before NOW's.
 */
function training(exercises: ExerciseId[], weeks: number, { weeksAgo = 0, loadKg }: { weeksAgo?: number; loadKg?: number } = {}): GrowthSession[] {
  return Array.from({ length: weeks }, (_, w) => exercises.flatMap((e) => [1, 3, 5].map((d) => session(e, (weeksAgo + w) * 7 + d, { loadKg })))).flat()
}

const levels = (sessions: GrowthSession[], now = NOW) => Object.fromEntries(MUSCLE_IDS.map((m) => [m, bodyGrowth(sessions, { now }).muscles[m].level])) as Record<MuscleId, number>

describe('bodyGrowth: the calibration', () => {
  it('uses the numbers the docs quote', () => {
    expect(GROWTH).toEqual({ primary: 1, secondary: 0.5, fullSetReps: 6, loadBonusKg: 30, loadBonus: 0.5, rate: 0.12, halfSets: 8, idleWeeks: 2, lossPerWeek: 0.03 })
    expect(MUSCLE_SIZE).toEqual({
      quads: 0.14, glutes: 0.1, hamstrings: 0.08, lats: 0.08, chest: 0.08, upper_back: 0.06, traps: 0.05, lower_back: 0.05, calves: 0.05,
      triceps: 0.05, abs: 0.05, biceps: 0.04, forearms: 0.04, obliques: 0.04, front_delts: 0.03, side_delts: 0.03, rear_delts: 0.02,
    })
  })

  it('starts every group at the skinny start, with no history, when there is no training', () => {
    const body = bodyGrowth([], { now: NOW })
    expect(body).toMatchObject({ asOf: NOW, overall: 0, weeks: [] })
    for (const m of MUSCLE_IDS) expect(body.muscles[m], m).toEqual({ level: 0, recentSets: 0, totalSets: 0, change: 0 })
  })

  it('grows every group the demo works to between a quarter and three fifths in six weeks: clearly grown, far from the top', () => {
    for (const seed of [1, 7, 42, 2026]) {
      const body = bodyGrowth(generateDemoSessions('p1', NOW, seed), { now: NOW })
      expect(body.weeks).toHaveLength(6)
      for (const m of MUSCLE_IDS) {
        expect(body.muscles[m].level, `${m} seed ${seed}`).toBeGreaterThan(0.25)
        expect(body.muscles[m].level, `${m} seed ${seed}`).toBeLessThan(0.6)
      }
      expect(body.overall).toBeGreaterThan(0.25)
      expect(body.overall).toBeLessThan(0.6)
    }
  })

  it('raises the biceps by at least 0.05 with a week of curls (three sessions of 3 x 8), the forearms less, the quads not at all', () => {
    const after = levels([session('elbow_flexion', 1), session('elbow_flexion', 3), session('elbow_flexion', 5)])
    expect(after.biceps).toBeGreaterThanOrEqual(0.05)
    // Nine full sets in the week: 0.12 x 9 / (9 + 8) of what was left to gain.
    expect(after.biceps).toBeCloseTo((0.12 * 9) / (9 + 8), 12)
    expect(after.forearms).toBeGreaterThan(0)
    expect(after.forearms).toBeLessThan(after.biceps)
    expect(after.quads).toBe(0)
  })

  it('builds the arms with eight weeks of arm training and leaves the legs at the start', () => {
    const after = levels(training(['elbow_flexion', 'tricep_extension'], 8))
    expect(after.biceps).toBeGreaterThan(0.3)
    expect(after.triceps).toBeGreaterThan(0.3)
    for (const legs of ['quads', 'glutes', 'hamstrings', 'calves'] as const) expect(after[legs], legs).toBe(0)
  })

  it('approaches the top with a year of steady training but stays below it', () => {
    const body = bodyGrowth(training([...EXERCISE_IDS], 52), { now: NOW })
    expect(body.weeks).toHaveLength(52)
    for (const m of MUSCLE_IDS) {
      expect(body.muscles[m].level, m).toBeGreaterThan(0.95)
      expect(body.muscles[m].level, m).toBeLessThan(1)
    }
    expect(body.overall).toBeLessThan(1)
  })

  it('gives some back after three idle weeks, but not after one or two', () => {
    const sessions = training(['elbow_flexion'], 4)
    const trained = levels(sessions).biceps
    // Each week later adds an idle week.
    expect(levels(sessions, NOW + WEEK).biceps).toBe(trained)
    expect(levels(sessions, NOW + 2 * WEEK).biceps).toBe(trained)
    expect(levels(sessions, NOW + 3 * WEEK).biceps).toBeCloseTo(trained * (1 - GROWTH.lossPerWeek), 12)
    expect(levels(sessions, NOW + 4 * WEEK).biceps).toBeCloseTo(trained * (1 - GROWTH.lossPerWeek) ** 2, 12)
  })

  it('holds a level day by day while idle, and gives some back only once the third idle week begins', () => {
    // Curls on Monday and Friday of NOW's week, then nothing: a day at a time for three weeks.
    const sessions = [session('elbow_flexion', 1), session('elbow_flexion', 5)]
    const trained = levels(sessions).biceps
    const daily = Array.from({ length: 22 }, (_, d) => levels(sessions, NOW + d * DAY).biceps)
    for (let d = 1; d < daily.length; d++) expect(daily[d], `day ${d}`).toBeLessThanOrEqual(daily[d - 1]!)
    // Day 16 is Monday 26 October, the first day of the third week without curls.
    expect(daily.slice(0, 16)).toEqual(Array(16).fill(trained))
    expect(daily[16]).toBeCloseTo(trained * (1 - GROWTH.lossPerWeek), 12)
    expect(daily.slice(16)).toEqual(Array(6).fill(daily[16]))
  })

  it('counts idle weeks in a row: work in between starts the count again, a session without any does not', () => {
    // Curls, two idle weeks, curls, two idle weeks: never more than two in a row, so nothing is given back.
    const gappy = bodyGrowth([...training(['elbow_flexion'], 1, { weeksAgo: 5 }), ...training(['elbow_flexion'], 1, { weeksAgo: 2 })], { now: NOW })
    const biceps = gappy.weeks.map((w) => w.levels.biceps)
    expect(biceps).toHaveLength(6)
    expect(biceps[3]).toBeGreaterThan(biceps[0]!)
    expect(biceps[2]).toBe(biceps[0])
    expect(biceps[5]).toBe(biceps[3])
    // Four weeks of curls, then three idle ones, the last with a session of no counted reps: no work,
    // so it neither grows the biceps nor starts the count again, and the third idle week still costs.
    const lapsed = training(['elbow_flexion'], 4, { weeksAgo: 3 })
    const trained = bodyGrowth(lapsed, { now: NOW }).weeks.at(-4)!.levels.biceps
    expect(levels(lapsed).biceps).toBeCloseTo(trained * (1 - GROWTH.lossPerWeek), 12)
    expect(levels([...lapsed, session('elbow_flexion', 1, { reps: 0 })]).biceps).toBe(levels(lapsed).biceps)
  })

  it('shrinks a group left alone while other groups train', () => {
    // Four weeks of curls, then three weeks of squats only: the biceps sat out three weeks in a row.
    const body = bodyGrowth([...training(['elbow_flexion'], 4, { weeksAgo: 3 }), ...training(['squat'], 3)], { now: NOW })
    expect(body.weeks).toHaveLength(7)
    expect(body.muscles.quads.level).toBeGreaterThan(0)
    expect(body.muscles.biceps.level).toBeCloseTo(body.weeks.at(-4)!.levels.biceps * (1 - GROWTH.lossPerWeek), 12)
  })
})

describe('bodyGrowth: counting sets', () => {
  it('counts a set fully for the muscles a movement targets and half for the ones that help', () => {
    const { muscles } = bodyGrowth([session('elbow_flexion', 1)], { now: NOW })
    expect(muscles.biceps).toMatchObject({ recentSets: 3, totalSets: 3 })
    expect(muscles.forearms).toMatchObject({ recentSets: 1.5, totalSets: 1.5 })
    expect(muscles.biceps.level).toBeCloseTo((GROWTH.rate * 3) / (3 + GROWTH.halfSets), 12)
    expect(muscles.forearms.level).toBeCloseTo((GROWTH.rate * 1.5) / (1.5 + GROWTH.halfSets), 12)
    expect(muscles.lats).toEqual({ level: 0, recentSets: 0, totalSets: 0, change: 0 })
    // The biceps help in a pulldown: half a set each.
    expect(bodyGrowth([session('lat_pulldown', 1)], { now: NOW }).muscles.biceps.totalSets).toBe(1.5)
  })

  it('counts a short set pro rata and a long one as one set', () => {
    const sets = (s: GrowthSession) => bodyGrowth([s], { now: NOW }).muscles.biceps.totalSets
    expect(sets(session('elbow_flexion', 1, { sets: 1, reps: 3 }))).toBe(0.5)
    expect(sets(session('elbow_flexion', 1, { sets: 1, reps: 6 }))).toBe(1)
    expect(sets(session('elbow_flexion', 1, { sets: 1, reps: 20 }))).toBe(1)
    expect(sets(session('elbow_flexion', 1, { sets: 1, reps: 0 }))).toBe(0)
    expect(sets({ ...session('elbow_flexion', 1), sets: [set(8), set(4)] })).toBeCloseTo(1 + 4 / 6, 12)
  })

  it('adds up to half again for a weight held, in full from 30 kg, without changing the sets counted', () => {
    const at = (loadKg?: number) => bodyGrowth([session('elbow_flexion', 1, { loadKg })], { now: NOW }).muscles.biceps
    const grow = (stimulus: number) => (GROWTH.rate * stimulus) / (stimulus + GROWTH.halfSets)
    expect(at().level).toBeCloseTo(grow(3), 12)
    expect(at(0).level).toBe(at().level)
    expect(at(15).level).toBeCloseTo(grow(3 * 1.25), 12)
    expect(at(30).level).toBeCloseTo(grow(3 * 1.5), 12)
    expect(at(60).level).toBe(at(30).level)
    expect(at(60).totalSets).toBe(3)
  })

  it('grows a group by its role, the share of a full set and the weight bonus together', () => {
    const grow = (stimulus: number) => (GROWTH.rate * stimulus) / (stimulus + GROWTH.halfSets)
    // One set of three reps holding 15 kg: half a set, with a quarter more for the weight.
    const { muscles } = bodyGrowth([session('elbow_flexion', 1, { sets: 1, reps: 3, loadKg: 15 })], { now: NOW })
    expect(muscles.biceps.level).toBeCloseTo(grow(1 * 0.5 * 1.25), 12)
    expect(muscles.forearms.level).toBeCloseTo(grow(0.5 * 0.5 * 1.25), 12)
  })

  it('counts nothing for a session without sets, though its week still shows, as an idle one', () => {
    const empty = bodyGrowth([{ ...session('elbow_flexion', 15), sets: [] }], { now: NOW })
    expect(empty.weeks).toHaveLength(3)
    expect(empty.overall).toBe(0)
    expect(empty.muscles.biceps).toEqual({ level: 0, recentSets: 0, totalSets: 0, change: 0 })
  })

  it('counts the last 28 days in recentSets and everything in totalSets', () => {
    const { muscles } = bodyGrowth([session('elbow_flexion', 2), session('elbow_flexion', 27), session('elbow_flexion', 29), session('elbow_flexion', 300)], { now: NOW })
    expect(muscles.biceps).toMatchObject({ recentSets: 6, totalSets: 12 })
    // Exactly 28 days back is out, a moment later in.
    expect(bodyGrowth([session('elbow_flexion', 28)], { now: NOW }).muscles.biceps).toMatchObject({ recentSets: 0, totalSets: 3 })
    expect(bodyGrowth([{ ...session('elbow_flexion', 28), startedAt: NOW - 28 * DAY + 1 }], { now: NOW }).muscles.biceps).toMatchObject({ recentSets: 3, totalSets: 3 })
  })
})

describe('bodyGrowth: time', () => {
  it('ignores sessions after now and counts one at now', () => {
    expect(bodyGrowth([session('elbow_flexion', -1)], { now: NOW })).toEqual(bodyGrowth([], { now: NOW }))
    const atNow = bodyGrowth([session('elbow_flexion', 0)], { now: NOW })
    expect(atNow.weeks).toHaveLength(1)
    expect(atNow.muscles.biceps.level).toBeGreaterThan(0)
    expect(bodyGrowth([session('elbow_flexion', 1), session('squat', -2)], { now: NOW })).toEqual(bodyGrowth([session('elbow_flexion', 1)], { now: NOW }))
  })

  it('gives the same numbers, to the last bit, whatever order the sessions come in', () => {
    const demo = generateDemoSessions('p1', NOW, 42).sort((a, b) => a.startedAt - b.startedAt)
    const body = bodyGrowth(demo, { now: NOW })
    expect(bodyGrowth([...demo].reverse(), { now: NOW })).toEqual(body)
    expect(bodyGrowth([...demo.filter((_, i) => i % 2), ...demo.filter((_, i) => i % 2 === 0)], { now: NOW })).toEqual(body)
    expect(bodyGrowth(demo, { now: NOW })).toEqual(body)
  })

  it("has one window a week, Monday to Monday (UTC), oldest first, from the first session's week to this one", () => {
    // Curls on Friday this week and on Friday two weeks before.
    const body = bodyGrowth([session('elbow_flexion', 1), session('elbow_flexion', 15)], { now: NOW })
    expect(body.weeks.map((w) => w.from)).toEqual([MONDAY - 2 * WEEK, MONDAY - WEEK, MONDAY])
    // The week between had no curls: the level held.
    const biceps = body.weeks.map((w) => w.levels.biceps)
    expect(biceps[0]).toBeGreaterThan(0)
    expect(biceps[1]).toBe(biceps[0])
    expect(biceps[2]).toBeGreaterThan(biceps[1]!)
    expect(biceps[2]).toBe(body.muscles.biceps.level)
    // A week starts at its Monday's first instant: a session then is in it, one a moment before in the week before.
    const froms = (startedAt: number, now = NOW) => bodyGrowth([{ ...session('elbow_flexion', 0), startedAt }], { now }).weeks.map((w) => w.from)
    expect(froms(MONDAY)).toEqual([MONDAY])
    expect(froms(MONDAY - 1)).toEqual([MONDAY - WEEK, MONDAY])
    // So is `now` then: the new week has begun, holding just the session started at that instant.
    expect(froms(MONDAY, MONDAY)).toEqual([MONDAY])
    expect(froms(MONDAY - 1, MONDAY)).toEqual([MONDAY - WEEK, MONDAY])
  })

  it('lists at most 104 windows, while older training still counts in the levels', () => {
    const body = bodyGrowth([session('elbow_flexion', 3 * 364 + 1)], { now: NOW })
    expect(body.weeks).toHaveLength(104)
    expect(body.weeks[0]!.from).toBe(MONDAY - 103 * WEEK)
    expect(body.weeks.at(-1)!.from).toBe(MONDAY)
    // Three years of idle weeks have taken most of it back, but not all.
    expect(body.muscles.biceps.level).toBeGreaterThan(0)
    expect(body.muscles.biceps.level).toBeLessThan((GROWTH.rate * 3) / (3 + GROWTH.halfSets) / 10)
  })

  it('reports the change over the last four weeks, from the start for training that recent', () => {
    const steady = bodyGrowth(training(['elbow_flexion'], 6), { now: NOW })
    expect(steady.weeks).toHaveLength(6)
    expect(steady.muscles.biceps.change).toBeGreaterThan(0)
    expect(steady.muscles.biceps.change).toBe(steady.muscles.biceps.level - steady.weeks.at(-5)!.levels.biceps)
    expect(steady.muscles.quads.change).toBe(0)

    // Five weeks: the first is the fourth week back, which the change starts from.
    const five = bodyGrowth(training(['elbow_flexion'], 5), { now: NOW })
    expect(five.weeks).toHaveLength(5)
    expect(five.muscles.biceps.change).toBeGreaterThan(0)
    expect(five.muscles.biceps.change).toBe(five.muscles.biceps.level - five.weeks[0]!.levels.biceps)

    // Four weeks: four weeks ago every group was still at the start, so the change is the whole level.
    const recent = bodyGrowth(training(['elbow_flexion'], 4), { now: NOW })
    expect(recent.weeks).toHaveLength(4)
    expect(recent.muscles.biceps.change).toBeGreaterThan(0)
    for (const m of MUSCLE_IDS) expect(recent.muscles[m].change, m).toBe(recent.muscles[m].level)

    // Trained five to seven weeks ago, idle since: three of the last four weeks shrank it.
    const lapsed = bodyGrowth(training(['elbow_flexion'], 3, { weeksAgo: 5 }), { now: NOW })
    const monthAgo = lapsed.weeks.at(-5)!.levels.biceps
    expect(lapsed.muscles.biceps.change).toBeLessThan(0)
    expect(lapsed.muscles.biceps.change).toBeCloseTo(monthAgo * ((1 - GROWTH.lossPerWeek) ** 3 - 1), 12)
  })
})

describe('bodyGrowth: the whole body', () => {
  it('averages the groups by how much of the body each is', () => {
    const body = bodyGrowth([session('elbow_flexion', 1)], { now: NOW })
    const total = MUSCLE_IDS.reduce((n, m) => n + MUSCLE_SIZE[m], 0)
    expect(body.overall).toBeCloseTo((body.muscles.biceps.level * MUSCLE_SIZE.biceps + body.muscles.forearms.level * MUSCLE_SIZE.forearms) / total, 12)
    // The same work on a bigger group moves the whole body more.
    expect(bodyGrowth([session('seated_knee_extension', 1)], { now: NOW }).overall).toBeGreaterThan(bodyGrowth([session('elbow_flexion', 1)], { now: NOW }).overall)
  })

  it('sits between the least and the most grown groups', () => {
    const body = bodyGrowth(generateDemoSessions('p1', NOW, 7), { now: NOW })
    const all = MUSCLE_IDS.map((m) => body.muscles[m].level)
    expect(body.overall).toBeGreaterThan(Math.min(...all))
    expect(body.overall).toBeLessThan(Math.max(...all))
    expect(Object.keys(MUSCLE_SIZE).sort()).toEqual([...MUSCLE_IDS].sort())
  })
})
