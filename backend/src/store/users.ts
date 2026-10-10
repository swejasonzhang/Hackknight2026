import type { UserDto } from '@arc/dependencies'
import type { Queryable } from '../db.ts'
import { ms } from '../sql.ts'

export interface UserRow {
  id: string
  name: string
  email: string
  password_hash: string
  created_at: number
}

const COLS = `id, name, email, password_hash, ${ms('created_at')} as created_at`

export async function createUser(q: Queryable, input: { name: string; email: string; passwordHash: string }): Promise<UserRow> {
  const [row] = await q.query<UserRow>(`insert into users (name, email, password_hash) values ($1, $2, $3) returning ${COLS}`, [input.name, input.email, input.passwordHash])
  return row!
}

export async function findUserByEmail(q: Queryable, email: string): Promise<UserRow | null> {
  const [row] = await q.query<UserRow>(`select ${COLS} from users where email = $1`, [email])
  return row ?? null
}

export async function findUserById(q: Queryable, id: string): Promise<UserRow | null> {
  const [row] = await q.query<UserRow>(`select ${COLS} from users where id = $1`, [id])
  return row ?? null
}

/** Never includes the password hash. */
export function toUserDto(u: UserRow): UserDto {
  return { id: u.id, name: u.name, email: u.email, createdAt: Math.round(u.created_at) }
}
