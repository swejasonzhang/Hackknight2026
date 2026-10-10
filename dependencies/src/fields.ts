import { z } from 'zod'

/**
 * The rules for a person's name and an email address, shared by the API's validation and every
 * form (sign-up, log-in, profiles, deleting an account), so what a form says it needs is exactly
 * what the server enforces. Each rule has a requirement line to show under the field and a
 * specific reason when an entry breaks it.
 */
export const NAME_MAX = 80
export const NAME_REQUIREMENT = `Letters, spaces, apostrophes, hyphens or periods, up to ${NAME_MAX} characters.`
export const EMAIL_REQUIREMENT = 'An email address like name@example.com.'

/** Letters in any script (with their accents), spaces, apostrophes (straight or curly), hyphens and periods. */
const NAME_CHARS = /^[\p{L}\p{M}' .\-’]+$/u

/** Why a name is not acceptable, or null when it is. */
export function nameProblem(raw: string): string | null {
  const name = raw.trim()
  if (!name) return 'Enter a name.'
  if (name.length > NAME_MAX) return `Use ${NAME_MAX} characters or fewer.`
  if (!/\p{L}/u.test(name)) return 'Include at least one letter.'
  if (!NAME_CHARS.test(name)) return 'Use only letters, spaces, apostrophes, hyphens or periods.'
  return null
}

export const NameSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const problem = nameProblem(value)
    if (problem) ctx.addIssue({ code: 'custom', message: problem })
  })

const EMAIL_INVALID = 'Enter a valid email address, like name@example.com.'
export const EmailSchema = z.email({ message: EMAIL_INVALID }).max(254, { message: 'Use 254 characters or fewer.' })

/** Why an email address is not acceptable, or null when it is. */
export function emailProblem(raw: string): string | null {
  const email = raw.trim()
  if (!email) return 'Enter an email address.'
  const parsed = EmailSchema.safeParse(email)
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? EMAIL_INVALID)
}
