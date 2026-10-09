import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Loads a .env file into process.env without overriding values already set.
 * Looks at the repo root first, then backend/.env.
 */
export function loadEnv(): void {
  const candidates = [new URL('../../.env', import.meta.url), new URL('../.env', import.meta.url)]
  for (const url of candidates) {
    const path = fileURLToPath(url)
    if (existsSync(path)) {
      process.loadEnvFile(path)
      return
    }
  }
}
