/** CLI: `npm run seed -- you@example.com` loads demo data for that account into MONGODB_URI. */
import { connectDb } from './db.ts'
import { loadEnv } from './env.ts'
import { User } from './models/User.ts'
import { seedDemoData } from './services/seed.ts'

loadEnv()
const email = process.argv[2]?.toLowerCase()
if (!email) {
  console.error('Usage: npm run seed -- <email of an existing account>')
  process.exit(1)
}
const db = await connectDb(process.env.MONGODB_URI)
const user = await User.findOne({ email }).lean()
if (!user) {
  console.error(`No account with email ${email}. Sign up in the app first.`)
  await db.stop()
  process.exit(1)
}
const result = await seedDemoData(user._id)
console.log(
  result.created
    ? `Seeded ${result.sessions} demo sessions for ${email} (profile ${result.profileId}) into ${db.label}`
    : `Demo data already present for ${email} (${result.sessions} sessions, profile ${result.profileId})`,
)
await db.stop()
