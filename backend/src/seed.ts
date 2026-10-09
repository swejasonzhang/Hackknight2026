/** CLI: `npm run seed` loads demo data into the database named by MONGODB_URI. */
import { connectDb } from './db.ts'
import { loadEnv } from './env.ts'
import { seedDemoData } from './services/seed.ts'

loadEnv()
const db = await connectDb(process.env.MONGODB_URI)
const result = await seedDemoData()
console.log(
  result.created
    ? `Seeded ${result.sessions} demo sessions for profile ${result.profileId} into ${db.label}`
    : `Demo data already present in ${db.label} (${result.sessions} sessions, profile ${result.profileId})`,
)
await db.stop()
