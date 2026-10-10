/** CLI: `npm run seed -- you@example.com` loads demo data for that account into DATABASE_URL. */
import { connectDb, db } from './db.ts'
import { loadEnv } from './env.ts'
import { seedDemoData } from './services/seed.ts'
import { findUserByEmail } from './store/users.ts'

loadEnv()
const email = process.argv[2]?.toLowerCase()
if (!email) {
  console.error('Usage: npm run seed -- <email of an existing account>')
  process.exit(1)
}
const handle = await connectDb(process.env.DATABASE_URL)
const user = await findUserByEmail(db(), email)
if (!user) {
  console.error(`No account with email ${email}. Sign up in the app first.`)
  await handle.stop()
  process.exit(1)
}
const result = await seedDemoData(user.id)
console.log(
  result.created
    ? `Seeded ${result.sessions} demo sessions for ${email} (profile ${result.profileId}) into ${handle.label}`
    : `Demo data already present for ${email} (${result.sessions} sessions, profile ${result.profileId})`,
)
await handle.stop()
