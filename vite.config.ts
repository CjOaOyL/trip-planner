import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/trip-planner/',
  server: {
    // Static-only deployment (GitHub Pages). The auto-fill feature needs a
    // server endpoint — set VITE_API_BASE in .env.local if you host one.
    port: 5173,
  },
})
