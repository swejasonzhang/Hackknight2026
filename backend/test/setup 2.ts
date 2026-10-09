/**
 * Every test file gets its own in-memory MongoDB (mongodb-memory-server) and a clean
 * database before each test. No test ever touches a real database.
 */
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll } from 'vitest'

process.env.JWT_SECRET = 'test-secret-not-for-production'
process.env.CV_API_KEY = 'test-cv-key'

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri('arc-test'))
})

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections()
  await Promise.all(collections.map((c) => c.deleteMany({})))
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})
