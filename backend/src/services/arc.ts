import {
  BODY_AREAS,
  catalogByArea,
  clampToRanges,
  CoachIntakeSchema,
  isDiverseWeek,
  estimateFatigue,
  EXERCISE_LIST,
  EXERCISES,
  ONBOARDING_TOPICS,
  parseHeightCm,
  parseTrainingGoal,
  parseWeekdays,
  parseWeightKg,
  programFromIntake,
  ProgramInputSchema,
  spreadDays,
  TRAINING_GOALS,
  TRAINING_RANGES,
  weekdayList,
  type ChatTurn,
  type CoachIntake,
  type ExerciseId,
  type OnboardingTopic,
  type PlanInput,
  type ProgramDay,
  type ProgramInput,
  type ProgramSource,
  type RepRecord,
  type SessionDto,
  type SessionPlan,
  type Side,
} from '@arc/dependencies'
import { generate, geminiConfigured } from './gemini.ts'

/**
 * Arc, the coach: what Arc says during onboarding, between sets and after a session. Gemini writes
 * the words when it is configured; otherwise (or when Gemini fails) Arc follows a script and
 * templates built from the same numbers, so every flow works without a key. Arc only reasons over
 * numbers it is given and never invents a measurement. Adapted from the ai-coach module's prompt.
 */
const PERSONA = `Your name is Arc. You are a gym coach with a physical therapist's eye, speaking through voice inside the Arc app, which measures range of motion in degrees through the member's webcam. Always call yourself Arc. Speak to the member directly, warmly and briefly: short spoken sentences, no markdown, no bullet points, no headers, no emoji. Use only the numbers you are given and never invent a measurement. This is a personal fitness tool, not medical care: never diagnose, and if the member mentions sharp or worsening pain, suggest they check with a professional.`

const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there'
/** "upper body, back, legs and core". */
const listOf = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const lower = (exercise: ExerciseId) => EXERCISES[exercise].name.toLowerCase()
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// ---------------------------------------------------------------------------------------------
// Onboarding

/** Arc's questions when Gemini is off, one per topic in ONBOARDING_TOPICS order; the answers fill the intake. */
export const ONBOARDING_QUESTIONS: Record<OnboardingTopic, (name: string) => string> = {
  goals: (name) => `Hi ${firstName(name)}, I'm Arc, your coach. What would you like to do with your body? Get stronger, move more freely, come back from an injury, something else?`,
  trainingGoal: () => 'Love that. Would you rather get stronger, build muscle, or build stamina?',
  focus: () => `Where should we start? Every exercise I can track is on your screen, across ${listOf(BODY_AREAS.map((a) => a.name.toLowerCase()))}. Tap one, name it, or just tell me the area.`,
  side: () => 'Left side or right side?',
  limitations: () => 'Any injuries, pain or limits I should know about?',
  experience: () => 'How much have you trained before: new to it, some, or regularly?',
  days: () => 'Which days of the week can you train? Name them, like Monday, Wednesday and Friday, or just tell me how many.',
  height: () => 'Nearly done. How tall are you? Centimetres or feet and inches both work, or say skip.',
  weight: () => 'And your weight, in kilograms or pounds? Or say skip.',
}
/** Gemini gets this many answers to finish; after that Arc wraps up with what it has. */
const MAX_ANSWERS = 12

/**
 * Words for a place to start, most specific first: a named exercise, then a joint, then an area.
 * "Back" counts only as the body's back, never "come back from an injury".
 */
const FOCUS_WORDS: [RegExp, ExerciseId][] = [
  // A movement named as the catalog names it, from the quick replies or typed out.
  ...EXERCISE_LIST.map((e): [RegExp, ExerciseId] => [new RegExp(`\\b${e.name.toLowerCase().replace(/[-\s]+/g, '[-\\s]?')}`), e.id]),
  [/dead ?lifts?|hinge|hamstrings?/, 'deadlift'],
  [/squats?/, 'squat'],
  [/lunges?/, 'lunge'],
  [/\bknees?\b/, 'seated_knee_extension'],
  [/\b(legs?|quads?|thighs?|glutes?)\b/, 'squat'],
  [/crunch|\babs\b|stomach|sit ?ups?/, 'crunch'],
  [/twist|obliques?|rotat/, 'ab_twist'],
  [/\bcore\b/, 'crunch'],
  [/pull ?downs?|pull ?ups?|\blats?\b/, 'lat_pulldown'],
  [/\brows?\b|rowing/, 'bent_over_row'],
  [/^\s*back\s*$|\b(my|upper|lower|the) back\b|\bback (muscles?|area|day)\b/, 'lat_pulldown'],
  [/\bfl(y|ys|ies|yes)\b|\bpecs?\b/, 'pec_fly'],
  [/chest|bench|push ?ups?|press ?ups?/, 'chest_press'],
  [/triceps?/, 'tricep_extension'],
  [/front raises?/, 'front_raise'],
  [/overhead|shoulder press|\bpress(es)?\b/, 'shoulder_press'],
  [/lateral|side raises?|shoulders?|delts?|raises?/, 'shoulder_abduction'],
  [/elbows?|biceps?|curls?|\barms?\b|forearms?/, 'elbow_flexion'],
]

/** An answer that passes on the question. */
const SKIPPED = /^\s*(skip|skipped|pass|next|no idea|not sure|rather not say)\b/i

/**
 * The answers in topic order, each read for the question it followed: the topic Arc's line
 * carried, or for lines without one (older pages, the scripted order), the next topic in turn.
 */
export function answersByTopic(messages: ChatTurn[]): string[] {
  const answers: string[] = []
  let asked: OnboardingTopic | undefined
  let next = 0
  for (const m of messages) {
    if (m.role === 'arc') asked = m.topic
    else {
      const topic = asked ?? ONBOARDING_TOPICS[next]
      if (topic) answers[ONBOARDING_TOPICS.indexOf(topic)] = m.text
      next++
      asked = undefined
    }
  }
  return answers
}

/** The intake from the answers, one per topic, read with plain keyword rules; skipped or missing answers take a sensible default. */
export function extractIntake(answers: string[]): CoachIntake {
  const at = (topic: OnboardingTopic) => {
    const answer = answers[ONBOARDING_TOPICS.indexOf(topic)] ?? ''
    return SKIPPED.test(answer) ? '' : answer
  }
  const all = answers.filter((a) => a && !SKIPPED.test(a)).join(' ').toLowerCase()
  const focusOf = (text: string): ExerciseId | null => FOCUS_WORDS.find(([re]) => re.test(text))?.[1] ?? null
  const sideOf = (text: string): Side | null => (/\bleft\b/.test(text) ? 'left' : /\bright\b/.test(text) ? 'right' : null)
  const limits = at('limitations').trim()
  const exp = at('experience').toLowerCase()
  const days = parseWeekdays(at('days'))
  const trainingDays = days.length ? days : spreadDays(3)
  const intake: CoachIntake = {
    goals: at('goals').trim().slice(0, 500) || 'Move better',
    focus: focusOf(at('focus').toLowerCase()) ?? focusOf(all) ?? 'elbow_flexion',
    side: sideOf(at('side').toLowerCase()) ?? sideOf(all) ?? 'right',
    limitations: !limits || /^(no|none|nope|nothing|nah)\b/i.test(limits) ? 'none' : limits.slice(0, 500),
    experience: /\b(new|never|beginner|first time|not really|no experience|haven't)\b/.test(exp)
      ? 'new'
      : /\b(regular|regularly|every|often|years|always|lots|a lot|daily|athlete)\b/.test(exp)
        ? 'regular'
        : 'some',
    daysPerWeek: trainingDays.length,
    trainingGoal: parseTrainingGoal(at('trainingGoal')) ?? parseTrainingGoal(at('goals')) ?? 'hypertrophy',
    trainingDays,
  }
  const heightCm = parseHeightCm(at('height'))
  const weightKg = parseWeightKg(at('weight'))
  if (heightCm != null) intake.heightCm = heightCm
  if (weightKg != null) intake.weightKg = weightKg
  return intake
}

/** The active plan Arc saves with the week: the first day's first movement, so Record starts there. */
export function planFromProgram(program: ProgramInput): PlanInput {
  return program.days[0]!.items[0]!
}

function closing(name: string, program: ProgramInput): string {
  return `Thanks, ${firstName(name)}. Your week is ready: ${program.summary} It's on the calendar on your dashboard, and you can press Start recording whenever you're ready.`
}

export interface OnboardingResult {
  reply: string
  done: boolean
  offline: boolean
  /** What the reply asks about, while Arc is still asking. */
  topic?: OnboardingTopic
  intake?: CoachIntake
  program?: ProgramInput
  programSource?: ProgramSource
}

function scriptedTurn(messages: ChatTurn[], name: string, finish = false): OnboardingResult {
  const answered = messages.filter((m) => m.role === 'user').length
  const topic = ONBOARDING_TOPICS[answered]
  if (topic && !finish) return { reply: ONBOARDING_QUESTIONS[topic](name), done: false, offline: true, topic }
  const intake = extractIntake(answersByTopic(messages))
  const program = programFromIntake(intake)
  return { reply: closing(name, program), done: true, offline: true, intake, program, programSource: 'arc' }
}

/** Skip the rest: the week from what has been said (each answer read for its question), Gemini writing the week when it can. */
async function finishNow(messages: ChatTurn[], name: string): Promise<OnboardingResult> {
  const intake = extractIntake(answersByTopic(messages))
  const { program, source } = await buildProgram(intake, name)
  return { reply: closing(name, program), done: true, offline: !geminiConfigured(), intake, program, programSource: source }
}

const EXERCISE_ENUM = EXERCISE_LIST.map((e) => e.id)

const ONBOARDING_SYSTEM = `${PERSONA}

You are welcoming a new member who just signed up, in a short chat. One question at a time, in this order, learn: goals, what they want to do with their body and physique; trainingGoal, whether they would rather get stronger (strength), build muscle (hypertrophy) or build stamina (endurance), asked in plain words; focus, where to start, mapped to exactly one exercise id from the catalog below; when you ask it, name the four areas (${listOf(BODY_AREAS.map((a) => a.name.toLowerCase()))}) and tell them every exercise is listed on their screen to tap, and never offer only a few; side, left or right; limitations, any injuries, pain or limits; experience, new, some or regular; days, which days of the week they can train (weekday numbers, 0 is Sunday; if they give only a count, spread the days through the week with rest days between); height and weight, which they may skip (then null; convert feet and inches to centimetres and pounds to kilograms). Briefly react to what they said before asking the next thing. The member can skip any question by answering Skip: acknowledge it in a word or two, take a sensible default for that topic, ask the next one, and never ask a skipped question again. Keep each reply to one or two short spoken sentences and ask exactly one question; set topic to what that question asks about. Start, if the conversation is empty, by introducing yourself as Arc. When you know everything, set done to true, thank them by first name, tell them their week is ready on the dashboard's calendar, and fill intake with daysPerWeek equal to the number of trainingDays. Until then set done to false and intake to null. Reply only with the JSON object.

The catalog, every exercise Arc can track, by area:
${catalogByArea()
  .map((g) => `${g.area}: ${g.exercises.map((e) => `${e.id} (${e.name.toLowerCase()})`).join(', ')}`)
  .join('\n')}`

const ONBOARDING_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    done: { type: 'BOOLEAN' },
    topic: { type: 'STRING', enum: [...ONBOARDING_TOPICS], nullable: true },
    intake: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        goals: { type: 'STRING' },
        trainingGoal: { type: 'STRING', enum: [...TRAINING_GOALS] },
        focus: { type: 'STRING', enum: EXERCISE_ENUM },
        side: { type: 'STRING', enum: ['left', 'right'] },
        limitations: { type: 'STRING' },
        experience: { type: 'STRING', enum: ['new', 'some', 'regular'] },
        trainingDays: { type: 'ARRAY', items: { type: 'INTEGER' } },
        daysPerWeek: { type: 'INTEGER' },
        heightCm: { type: 'NUMBER', nullable: true },
        weightKg: { type: 'NUMBER', nullable: true },
      },
      required: ['goals', 'trainingGoal', 'focus', 'side', 'limitations', 'experience', 'trainingDays', 'daysPerWeek'],
    },
  },
  required: ['reply', 'done'],
}

/** Gemini's intake, tidied: nulls dropped, days de-duplicated and counted, then checked against the contract. */
function intakeFromGemini(raw: unknown): CoachIntake | null {
  if (!raw || typeof raw !== 'object') return null
  const clean = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== null)) as Record<string, unknown>
  if (Array.isArray(clean.trainingDays)) {
    const days = [...new Set(clean.trainingDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))]
    if (days.length) {
      clean.trainingDays = days.sort((a, b) => a - b)
      clean.daysPerWeek = days.length
    } else delete clean.trainingDays
  }
  for (const key of ['heightCm', 'weightKg'] as const) if (typeof clean[key] === 'number') clean[key] = Math.round(clean[key] as number)
  const parsed = CoachIntakeSchema.safeParse(clean)
  return parsed.success ? parsed.data : null
}

export async function onboardingTurn(messages: ChatTurn[], name: string, finish = false): Promise<OnboardingResult> {
  if (finish) return finishNow(messages, name)
  if (!geminiConfigured()) return scriptedTurn(messages, name)
  const answers = messages.filter((m) => m.role === 'user').map((m) => m.text)
  let parsed: { reply?: unknown; done?: unknown; intake?: unknown; topic?: unknown }
  try {
    const raw = await generate({
      system: ONBOARDING_SYSTEM,
      responseSchema: ONBOARDING_SCHEMA,
      maxOutputTokens: 600,
      turns: [{ role: 'user', text: `(${name} just signed up and opened the chat with Arc.)` }, ...messages.map((m) => ({ role: m.role === 'arc' ? ('model' as const) : ('user' as const), text: m.text }))],
    })
    parsed = JSON.parse(raw) as typeof parsed
  } catch {
    return scriptedTurn(messages, name)
  }
  const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim().slice(0, 1200) : null
  if (!reply) return scriptedTurn(messages, name)
  const intake = parsed.done === true ? intakeFromGemini(parsed.intake) : null
  if (intake) {
    const { program, source } = await buildProgram(intake, name)
    return { reply, done: true, offline: false, intake, program, programSource: source }
  }
  if (answers.length >= MAX_ANSWERS) {
    // Gemini kept asking: wrap up with what the answers say.
    const fallback = extractIntake(answersByTopic(messages))
    const program = programFromIntake(fallback)
    return { reply: closing(name, program), done: true, offline: false, intake: fallback, program, programSource: 'arc' }
  }
  const topic = ONBOARDING_TOPICS.find((t) => t === parsed.topic)
  return { reply, done: false, offline: false, ...(topic ? { topic } : {}) }
}

// ---------------------------------------------------------------------------------------------
// The week

const PROGRAM_SYSTEM = `${PERSONA}

Build the member's training week as JSON. Use exactly the training days you are given (weekday numbers, 0 is Sunday). Give each training day one body area (upper body, back, legs or core) with one to three movements from that area of the catalog, and never the same area on two training days in a row; with three or more training days, use at least three areas. The first training day opens with their focus movement on their side; the rest of the week works the other areas, so no muscle group is trained every day. Keep sets, reps and rest inside the ranges for their goal: lower in the range for someone new, higher for someone who trains regularly. Give someone new one movement a day; add variety for everyone else. Respect their limits: leave out a movement that would load an injured area. Give each day a short title of at most five words. Write summary as two or three short spoken sentences to the member about their week.`

const PROGRAM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    days: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          weekday: { type: 'INTEGER' },
          title: { type: 'STRING' },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                exercise: { type: 'STRING', enum: EXERCISE_ENUM },
                side: { type: 'STRING', enum: ['left', 'right'] },
                sets: { type: 'INTEGER' },
                reps: { type: 'INTEGER' },
                restSeconds: { type: 'INTEGER' },
              },
              required: ['exercise', 'side', 'sets', 'reps', 'restSeconds'],
            },
          },
        },
        required: ['weekday', 'title', 'items'],
      },
    },
  },
  required: ['summary', 'days'],
}

type RawItem = { exercise?: unknown; side?: unknown; sets?: unknown; reps?: unknown; restSeconds?: unknown }
type RawDay = { weekday?: unknown; title?: unknown; items?: unknown }

/**
 * Gemini's week held to the rules: only the member's days (a day Gemini dropped is filled from
 * Arc's own week), only catalog movements, numbers clamped into the goal's ranges, goal angles
 * from the catalog, never from the model, and a different body area from one training day to the
 * next. Null when nothing usable came back.
 */
export function programFromGemini(raw: unknown, intake: CoachIntake): ProgramInput | null {
  if (!raw || typeof raw !== 'object') return null
  const { summary, days } = raw as { summary?: unknown; days?: unknown }
  if (!Array.isArray(days)) return null
  const goal = intake.trainingGoal ?? 'hypertrophy'
  const fallback = programFromIntake(intake)
  const byWeekday = new Map<number, ProgramDay>()
  for (const day of days as RawDay[]) {
    if (typeof day?.weekday !== 'number' || byWeekday.has(day.weekday) || !Array.isArray(day.items)) continue
    const items = (day.items as RawItem[])
      .filter((i) => typeof i?.exercise === 'string' && i.exercise in EXERCISES)
      .slice(0, 3)
      .map((i): PlanInput => {
        const exercise = i.exercise as ExerciseId
        const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
        return {
          exercise,
          side: i.side === 'left' || i.side === 'right' ? i.side : intake.side,
          ...clampToRanges({ sets: n(i.sets, 3), reps: n(i.reps, 10), restSeconds: n(i.restSeconds, 90) }, goal),
          targetDeg: EXERCISES[exercise].targetDeg,
        }
      })
    if (!items.length) continue
    const title = typeof day.title === 'string' && day.title.trim() ? day.title.trim().slice(0, 60) : items.map((x) => EXERCISES[x.exercise].name).join(' + ').slice(0, 60)
    byWeekday.set(day.weekday, { weekday: day.weekday, title, items })
  }
  const fromGemini = fallback.days.filter((d) => byWeekday.has(d.weekday)).length
  if (!fromGemini) return null
  const program = {
    summary: typeof summary === 'string' && summary.trim() ? summary.trim().slice(0, 800) : fallback.summary,
    days: fallback.days.map((d) => byWeekday.get(d.weekday) ?? d),
  }
  const checked = ProgramInputSchema.safeParse(program)
  // A week that keeps to one area (or repeats one two days running) is thrown out for Arc's own.
  return checked.success && isDiverseWeek(checked.data.days) ? checked.data : null
}

/** The week from Gemini when it is configured and sends something usable, else Arc's own. */
export async function buildProgram(intake: CoachIntake, name: string): Promise<{ program: ProgramInput; source: ProgramSource }> {
  const own = { program: programFromIntake(intake), source: 'arc' as const }
  if (!geminiConfigured()) return own
  const goal = intake.trainingGoal ?? 'hypertrophy'
  const range = TRAINING_RANGES[goal]
  const days = intake.trainingDays?.length ? intake.trainingDays : spreadDays(intake.daysPerWeek)
  const context = [
    `Member: ${firstName(name)}; goals: ${intake.goals}; limits: ${intake.limitations || 'none'}; experience: ${intake.experience}${intake.heightCm ? `; height ${intake.heightCm} cm` : ''}${intake.weightKg ? `; weight ${intake.weightKg} kg` : ''}`,
    `Goal: ${range.label} (${goal}): ${range.sets[0]} to ${range.sets[1]} sets, ${range.reps[0]} to ${range.reps[1]} reps, ${range.restSeconds[0]} to ${range.restSeconds[1]} seconds of rest. ${range.guidance}`,
    `Focus: ${EXERCISES[intake.focus].name} (${intake.focus}), ${intake.side} side`,
    `Training days: ${days.join(', ')} (${weekdayList(days)})`,
    `Catalog:\n${EXERCISE_LIST.map((e) => `  ${e.id}: ${e.name}. ${e.cue}`).join('\n')}`,
  ].join('\n')
  try {
    const raw = await generate({ system: PROGRAM_SYSTEM, responseSchema: PROGRAM_SCHEMA, maxOutputTokens: 1500, turns: [{ role: 'user', text: context }] })
    const program = programFromGemini(JSON.parse(raw), intake)
    return program ? { program, source: 'gemini' } : own
  } catch {
    return own
  }
}

// ---------------------------------------------------------------------------------------------
// Between sets

export interface SetFeedbackContext {
  name: string
  exercise: ExerciseId
  side: Side
  plan: SessionPlan
  setNumber: number
  reps: RepRecord[]
  intake?: CoachIntake | null
}

function setFeedbackTemplate(c: SetFeedbackContext): string {
  const best = Math.round(Math.max(...c.reps.map((r) => r.peakDeg)))
  const fatigue = estimateFatigue(c.reps)
  const first = c.reps[0] ? Math.round(c.reps[0].peakDeg) : best
  const last = c.reps.at(-1) ? Math.round(c.reps.at(-1)!.peakDeg) : best
  const range =
    fatigue.index >= 0.25
      ? `Your range dropped from ${first} to ${last} degrees by the end, so take the full rest.`
      : fatigue.index >= 0.12
        ? 'Your range slipped a little late in the set; keep the last reps slow.'
        : 'Your range held steady.'
  const next = c.setNumber < c.plan.sets ? `Rest ${c.plan.restSeconds} seconds; set ${c.setNumber + 1} starts by itself.` : 'That was the last set.'
  return `Set ${c.setNumber} done: ${plural(c.reps.length, 'rep')}, best ${best} degrees. ${range} ${next}`
}

export async function setFeedback(c: SetFeedbackContext): Promise<{ text: string; offline: boolean }> {
  const template = setFeedbackTemplate(c)
  if (!geminiConfigured() || c.reps.length === 0) return { text: template, offline: true }
  const fatigue = estimateFatigue(c.reps)
  const context = [
    `Member: ${firstName(c.name)}${c.intake ? `; goals: ${c.intake.goals}; limits: ${c.intake.limitations}` : ''}`,
    `Exercise: ${EXERCISES[c.exercise].name}, ${c.side} side; goal ${c.plan.targetDeg} degrees`,
    `Set ${c.setNumber} of ${c.plan.sets} just ended: ${c.reps.length} of ${c.plan.reps} reps; peaks in order: ${c.reps.map((r) => Math.round(r.peakDeg)).join(', ')} degrees; fatigue score ${Math.round(fatigue.index * 100)} out of 100`,
    c.setNumber < c.plan.sets ? `Next: ${c.plan.restSeconds} seconds of rest, then set ${c.setNumber + 1} starts by itself.` : 'This was the last set.',
  ].join('\n')
  try {
    const text = await generate({
      system: `${PERSONA}\n\nThe member just finished a set and is resting. In one or two short spoken sentences: say the set number, the reps and the best angle, how the range held, and one cue for the next set (or, after the last set, that the session is done). If the fatigue score is above 40, suggest taking the whole rest.`,
      turns: [{ role: 'user', text: context }],
      maxOutputTokens: 160,
    })
    return { text: text.slice(0, 600), offline: false }
  } catch {
    return { text: template, offline: true }
  }
}

// ---------------------------------------------------------------------------------------------
// After a session

export interface SessionSummaryContext {
  name: string
  session: SessionDto
  /** Earlier sessions of the same movement, oldest first. */
  history: SessionDto[]
  intake?: CoachIntake | null
}

function sessionSummaryTemplate({ name, session, history }: SessionSummaryContext): string {
  const best = Math.round(session.summary.bestPeakDeg)
  const sets = session.sets.length
  const parts = [`Nice work, ${firstName(name)}. You did ${plural(sets, 'set')} of ${lower(session.exercise)}, ${plural(session.summary.totalReps, 'rep')}, and your best rep reached ${best} degrees.`]
  const prev = history.at(-1)
  const first = history[0]
  if (prev) {
    const delta = best - Math.round(prev.summary.bestPeakDeg)
    const vsPrev = delta > 0 ? `That's ${delta} more than last time` : delta < 0 ? `That's ${-delta} less than last time, which happens on a tired day` : "That's the same as last time"
    const vsFirst = first && history.length >= 2 ? `, and ${best - Math.round(first.summary.bestPeakDeg)} more than your first session` : ''
    parts.push(`${vsPrev}${vsFirst}.`)
  } else {
    parts.push('This is your first one, so it sets the baseline.')
  }
  const target = session.plan.targetDeg
  parts.push(best >= target ? `You've reached your ${target} degree goal.` : `You're ${target - best} degrees from your ${target} degree goal.`)
  const fatigue = session.summary.fatigueIndex
  parts.push(
    fatigue >= 0.25
      ? 'Your range faded late in the sets, so next time take a longer rest or one rep fewer per set.'
      : fatigue >= 0.12
        ? 'Range slipped a little toward the end of your sets; slow the last reps down next time.'
        : 'Your range held steady across every set, so next time try one more rep per set.',
  )
  return parts.join(' ')
}

export async function sessionSummary(c: SessionSummaryContext): Promise<{ text: string; offline: boolean }> {
  const template = sessionSummaryTemplate(c)
  if (!geminiConfigured()) return { text: template, offline: true }
  const s = c.session
  const fmt = (x: SessionDto) => `${new Date(x.startedAt).toISOString().slice(0, 10)}: best ${Math.round(x.summary.bestPeakDeg)}°, mean ${Math.round(x.summary.meanPeakDeg)}°, ${x.summary.totalReps} reps, fatigue ${Math.round(x.summary.fatigueIndex * 100)}/100`
  const context = [
    `Member: ${firstName(c.name)}${c.intake ? `; goals: ${c.intake.goals}; limits: ${c.intake.limitations}; experience: ${c.intake.experience}` : ''}`,
    `Exercise: ${EXERCISES[s.exercise].name}, ${s.side} side; goal ${s.plan.targetDeg} degrees; plan ${s.plan.sets} x ${s.plan.reps}, ${s.plan.restSeconds} s rest`,
    `This session: ${fmt(s)}`,
    ...s.sets.map((set) => `  Set ${set.setNumber}: ${set.reps.length} reps, peaks ${set.reps.map((r) => Math.round(r.peakDeg)).join(', ')}°, range drop ${Math.round(set.fatigue.romDropDeg)}°, tempo drift ${Math.round(set.fatigue.tempoDrift * 100)}%, fatigue ${Math.round(set.fatigue.index * 100)}/100${set.endedEarly ? ', ended early' : ''}`),
    c.history.length ? `Earlier sessions of this movement (oldest first):\n${c.history.slice(-6).map((h) => `  ${fmt(h)}`).join('\n')}${c.history.length > 6 ? `\n  (first ever: ${fmt(c.history[0]!)})` : ''}` : 'No earlier sessions of this movement.',
  ].join('\n')
  try {
    const text = await generate({
      system: `${PERSONA}\n\nThe member just finished a session. In three to five short spoken sentences, say what went well with a number, compare with their last session and their first one when you have them, name what needs work, and end with one concrete next step. If the latest set's fatigue is above 40, suggest backing off (fewer reps, longer rest); if fatigue stayed below 15 in every set with steady range, tell them they handled it easily and suggest one more rep per set or a higher goal.`,
      turns: [{ role: 'user', text: context }],
      maxOutputTokens: 320,
    })
    return { text: text.slice(0, 1500), offline: false }
  } catch {
    return { text: template, offline: true }
  }
}
