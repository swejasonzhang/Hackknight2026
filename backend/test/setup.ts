/**
 * Every test file gets its own in-process Postgres (PGlite, Postgres compiled to WebAssembly)
 * with the real schema, and clean tables before each test. No test ever touches a real database.
 * PGlite has no TimescaleDB extension, so `reps` is a plain table here; the SQL is the same.
 */
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { db, setDb, type Db, type Queryable } from '../src/db.ts'
import { migrate } from '../src/schema.ts'

process.env.JWT_SECRET = 'test-secret-not-for-production'
process.env.CV_API_KEY = 'test-cv-key'

let pglite: PGlite

function queryable(target: { query: PGlite['query'] }): Queryable {
  return { query: async (text, params) => (await target.query(text, params as unknown[])).rows as never[] }
}

beforeAll(async () => {
  pglite = await PGlite.create()
  const database: Db = {
    ...queryable(pglite),
    transaction: (fn) => pglite.transaction((tx) => fn(queryable(tx))),
    close: () => pglite.close(),
  }
  await migrate(database)
  setDb(database)
})

afterEach(async () => {
  await db().query('truncate users cascade')
})

afterAll(async () => {
  setDb(null)
  await pglite.close()
})
