import { CoachIntakeSchema, EXERCISES, type ChatTurn, type CoachIntake, type PlanInput, type RepRecord, type SessionDto, type SessionPlan, type ExerciseId, type Side, estimateFatigue } from '@arc/dependencies'
import { generate, geminiConfigured } from './gemini.ts'

/**
 * Arc, the coach: what Arc says during onboarding, between sets and after a session. Gemini writes
 * the words when it is configured; otherwise (or when Gemini fails) Arc follows a script and
 * templates built from the same numbers, so every flow works without a key. Arc only reasons over
 * numbers it is given and never invents a measurement. Adapted from the ai-coach module's prompt.
 */
const PERSONA = `Your name is Arc. You are a gym coach with a physical therapist's eye, speaking through voice inside the Arc app, which measures range of motion in degrees through the member's webcam. Always call yourself Arc. Speak to the member directly, warmly and briefly: short spoken sentences, no markdown, no bullet points, no headers, no emoji. Use only the numbers you are given and never invent a measurement. This is a personal fitness tool, not medical care: never diagnose, and if the member mentions sharp or worsening pain, suggest they check with a professional.`

const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there'
const lower = (exercise: ExerciseId) => EXERCISES[exercise].name.toLowerCase()
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// ---------------------------------------------------------------------------------------------
// Onboarding

/** Arc's questions when Gemini is off, one per answer; the answers fill the intake in order. */
export const ONBOARDING_QUESTIONS = [
  (name: string) => `Hi ${firstName(name)}, I'm Arc, your coach. What would you like to do with your body? Get stronger, move more freely, come back from an injury, something else?`,
  () => 'Got it. Which part should we work on first: your elbow, your shoulder or your knee?',
  () => 'Left side or right side?',
  () => 'Any injuries, pain or limits I should know about?',
  () => 'How much have you trained before: new to it, some, or regularly?',
  () => 'Last one: how many days a week can you train?',
]
/** Gemini gets this many answers to finish; after that Arc wraps up with what it has. */
const MAX_ANSWERS = 8

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }

/** The intake from the scripted answers (goals, area, side, limits, experience, days), read with plain keyword rules. */
export function extractIntake(answers: string[]): CoachIntake {
  const all = answers.join(' ').toLowerCase()
  const area = (answers[1] ?? '').toLowerCase()
  const focusOf = (text: string): ExerciseId | null =>
    /\b(knee|knees|leg|legs|quad|quads|hamstring|thigh)\b/.test(text)
      ? 'seated_knee_extension'
      : /\b(shoulder|shoulders|overhead|raise|lateral|delt|delts)\b/.test(text)
        ? 'shoulder_abduction'
        : /\b(elbow|elbows|bicep|biceps|curl|curls|arm|arms|forearm)\b/.test(text)
          ? 'elbow_flexion'
          : null
  const sideOf = (text: string): Side | null => (/\bleft\b/.test(text) ? 'left' : /\bright\b/.test(text) ? 'right' : null)
  const limits = (answers[3] ?? '').trim()
  const exp = (answers[4] ?? '').toLowerCase()
  const daysText = (answers[5] ?? '').toLowerCase()
  const digit = daysText.match(/\b([1-7])\b/)
  const word = Object.keys(NUMBER_WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(daysText))
  const daysPerWeek = /every ?day|daily/.test(daysText) ? 7 : digit ? Number(digit[1]) : word ? NUMBER_WORDS[word]! : 3
  return {
    goals: (answers[0] ?? 'Move better').trim().slice(0, 500) || 'Move better',
    focus: focusOf(area) ?? focusOf(all) ?? 'elbow_flexion',
    side: sideOf((answers[2] ?? '').toLowerCase()) ?? sideOf(all) ?? 'right',
    limitations: /^(no|none|nope|nothing|nah)\b/i.test(limits) ? 'none' : limits.slice(0, 500),
    experience: /\b(new|never|beginner|first time|not really|no experience|haven't)\b/.test(exp)
      ? 'new'
      : /\b(regular|regularly|every|often|years|always|lots|a lot|daily|athlete)\b/.test(exp)
        ? 'regular'
        : 'some',
    daysPerWeek,
  }
}

/** A first plan from the intake: three sets, more reps and less rest with more experience. */
export function planFromIntake(intake: CoachIntake): PlanInput {
  const reps = { new: 8, some: 10, regular: 12 }[intake.experience]
  const restSeconds = { new: 60, some: 45, regular: 45 }[intake.experience]
  return { exercise: intake.focus, side: intake.side, sets: 3, reps, restSeconds, targetDeg: EXERCISES[intake.focus].targetDeg }
}

function closing(name: string, intake: CoachIntake): string {
  const plan = planFromIntake(intake)
  return `Thanks, ${firstName(name)}. Your plan is ready: ${lower(intake.focus)} on your ${intake.side} side, ${plan.sets} sets of ${plan.reps} with ${plan.restSeconds} seconds of rest, aiming for ${plan.targetDeg} degrees. Press Start recording on your dashboard whenever you're ready, and I'll count every rep with you.`
}

export interface OnboardingResult {
  reply: string
  done: boolean
  offline: boolean
  intake?: CoachIntake
}

function scriptedTurn(messages: ChatTurn[], name: string): OnboardingResult {
  const answers = messages.filter((m) => m.role === 'user').map((m) => m.text)
  if (answers.length < ONBOARDING_QUESTIONS.length) return { reply: ONBOARDING_QUESTIONS[answers.length]!(name), done: false, offline: true }
  const intake = extractIntake(answers)
  return { reply: closing(name, intake), done: true, offline: true, intake }
}

const ONBOARDING_SYSTEM = `${PERSONA}

You are welcoming a new member who just signed up, in a short chat. One question at a time, learn: what they want to do with their body and physique (their goals); which movement matters most to them, mapped to exactly one of elbow_flexion (elbow, biceps, bending the arm), shoulder_abduction (shoulder, raising the arm out to the side or overhead) or seated_knee_extension (knee, straightening the leg); which side, left or right; any injuries, pain or limits; their training experience (new, some or regular); and how many days a week they can train (1 to 7). Keep each reply to one or two short spoken sentences and ask exactly one question. Start, if the conversation is empty, by introducing yourself as Arc. When you know all six things, set done to true, thank them by first name, tell them their plan is ready and that they can press Start recording on the dashboard, and fill intake. Until then set done to false and intake to null. Reply only with the JSON object.`

const ONBOARDING_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    done: { type: 'BOOLEAN' },
    intake: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        goals: { type: 'STRING' },
        focus: { type: 'STRING', enum: ['elbow_flexion', 'shoulder_abduction', 'seated_knee_extension'] },
        side: { type: 'STRING', enum: ['left', 'right'] },
        limitations: { type: 'STRING' },
        experience: { type: 'STRING', enum: ['new', 'some', 'regular'] },
        daysPerWeek: { type: 'INTEGER' },
      },
      required: ['goals', 'focus', 'side', 'limitations', 'experience', 'daysPerWeek'],
    },
  },
  required: ['reply', 'done'],
}

export async function onboardingTurn(messages: ChatTurn[], name: string): Promise<OnboardingResult> {
  if (!geminiConfigured()) return scriptedTurn(messages, name)
  const answers = messages.filter((m) => m.role === 'user').map((m) => m.text)
  try {
    const raw = await generate({
      system: ONBOARDING_SYSTEM,
      responseSchema: ONBOARDING_SCHEMA,
      turns: [{ role: 'user', text: `(${name} just signed up and opened the chat with Arc.)` }, ...messages.map((m) => ({ role: m.role === 'arc' ? ('model' as const) : ('user' as const), text: m.text }))],
    })
    const parsed = JSON.parse(raw) as { reply?: unknown; done?: unknown; intake?: unknown }
    const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim().slice(0, 1200) : null
    if (!reply) throw new Error('Gemini sent no reply')
    const intake = parsed.done === true ? CoachIntakeSchema.safeParse(parsed.intake) : null
    if (intake?.success) return { reply, done: true, offline: false, intake: intake.data }
    if (answers.length >= MAX_ANSWERS) {
      // Gemini kept asking: wrap up with what the answers say.
      const fallback = extractIntake(answers)
      return { reply: closing(name, fallback), done: true, offline: false, intake: fallback }
    }
    return { reply, done: false, offline: false }
  } catch {
    return scriptedTurn(messages, name)
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
