import { describe, expect, it } from 'vitest'
import { emailProblem, EmailSchema, nameProblem, NameSchema, NAME_MAX } from './fields.ts'

describe('names', () => {
  it.each(['Ada Lovelace', "O'Brien", 'Jean-Luc Picard', 'José Álvarez', '李小龙', 'Dr. Smith', 'Mary-Jane O’Neil', 'A'])('accepts %s', (name) => {
    expect(nameProblem(name)).toBeNull()
    expect(NameSchema.safeParse(name).success).toBe(true)
  })

  it.each([
    ['', 'Enter a name.'],
    ['   ', 'Enter a name.'],
    ['x'.repeat(NAME_MAX + 1), `Use ${NAME_MAX} characters or fewer.`],
    ['1234', 'Include at least one letter.'],
    ['Ada99', 'Use only letters, spaces, apostrophes, hyphens or periods.'],
    ['<script>', 'Use only letters, spaces, apostrophes, hyphens or periods.'],
  ])('refuses %j with a reason', (name, reason) => {
    expect(nameProblem(name)).toBe(reason)
    const parsed = NameSchema.safeParse(name)
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe(reason)
  })

  it('trims what it keeps', () => {
    expect(NameSchema.parse('  Ada  ')).toBe('Ada')
  })
})

describe('emails', () => {
  it.each(['ada@example.com', 'a.b+c@sub.example.co'])('accepts %s', (email) => {
    expect(emailProblem(email)).toBeNull()
    expect(EmailSchema.safeParse(email).success).toBe(true)
  })

  it.each([
    ['', 'Enter an email address.'],
    ['ada', 'Enter a valid email address, like name@example.com.'],
    ['ada@', 'Enter a valid email address, like name@example.com.'],
    ['@example.com', 'Enter a valid email address, like name@example.com.'],
    ['a b@example.com', 'Enter a valid email address, like name@example.com.'],
  ])('refuses %j with a reason', (email, reason) => {
    expect(emailProblem(email)).toBe(reason)
  })
})
