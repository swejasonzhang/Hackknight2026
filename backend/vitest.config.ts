import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    // PGlite boots a WebAssembly Postgres per test file.
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
})
