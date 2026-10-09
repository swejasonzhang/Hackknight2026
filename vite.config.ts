import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The Claude API key lives only in server/index.ts. The browser talks to /api/*,
    // which Vite forwards to the Express server started by `npm run dev:api`.
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
