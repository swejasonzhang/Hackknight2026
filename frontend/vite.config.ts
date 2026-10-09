import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on every network interface so teammates and phones on the same Wi-Fi can open
    // http://<this-machine's-IP>:5173. The browser only ever talks to /api; Vite forwards
    // it to the Express API on this machine.
    host: true,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  preview: {
    host: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
