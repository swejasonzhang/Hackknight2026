import type { VoiceCommand } from '@arc/dependencies'

/**
 * Gym words, in priority order: when a phrase holds more than one, the first match wins (so
 * "stop and rest" stops, and "keep going" resumes rather than starts).
 */
const RULES: [VoiceCommand, RegExp][] = [
  ['stop', /\b(stop|finish|finished|done|end( the)?( session| workout)?|that's it|that is it|save( it)?|i'm done|we're done)\b/],
  ['pause', /\b(pause|hold on|hold it|hold|wait|one sec(ond)?)\b/],
  ['resume', /\b(resume|continue|keep going|unpause|carry on|back to it)\b/],
  ['skip', /\b(skip|next( set)?|move on|skip (the )?rest)\b/],
  ['rest', /\b(rest|break|take a break|breather)\b/],
  ['status', /\b(how many|count|status|how am i doing|where am i|reps so far)\b/],
  ['repeat', /\b(repeat|say that again|what did you say|again)\b/],
  ['start', /\b(start|begin|go|let's go|lets go|ready|start counting)\b/],
]
const NEGATION = /\b(don't|dont|do not|not|never|no need to)\s+(\w+\s+)?$/
/** Short phrases count as commands; longer talk only when it is addressed to Arc. */
const MAX_PLAIN_WORDS = 4

/**
 * The command in something the member said while recording, or null. Hands-free control: a short
 * phrase ("pause", "next set", "how many") or anything addressed to Arc ("Arc, can we pause").
 * A negation right before the word ("don't stop") cancels it.
 */
export function parseCommand(transcript: string): VoiceCommand | null {
  const text = transcript.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return null
  const addressed = /\barc\b/.test(text)
  if (!addressed && text.split(' ').length > MAX_PLAIN_WORDS) return null
  for (const [command, rule] of RULES) {
    const match = rule.exec(text)
    if (!match) continue
    if (NEGATION.test(text.slice(0, match.index))) continue
    return command
  }
  return null
}

/** What Arc says it heard, shown on screen and spoken. */
export const COMMAND_LABEL: Record<VoiceCommand, string> = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  skip: 'Skip',
  rest: 'Rest',
  stop: 'Finish and save',
  status: 'How am I doing',
  repeat: 'Repeat',
}

const QUESTION = /^(how|what|whats|what's|is|am|are|can|could|should|why|does|do|did|will|would|when|where|which)\b/
const FEELING = /\b(hurts?|hurting|pain|sore|ache|aching|sharp|tired|heavy|hard|easy|light|tough|dizzy|form|technique|depth|deeper|faster|slower)\b/

/**
 * Whether a phrase that is not a command is meant for Arc: a question, anything addressed to Arc
 * by name, or how the member feels (pain, effort, form). Other talk in the room goes by.
 */
export function isForArc(transcript: string): boolean {
  const text = transcript.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim()
  if (text.split(' ').filter(Boolean).length < 2) return false
  return /\barc\b/.test(text) || QUESTION.test(text) || FEELING.test(text)
}
