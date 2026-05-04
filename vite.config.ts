import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/trip-planner/',
  server: {
    // For local dev, run `netlify dev` (port 8888) — it proxies the Vite
    // dev server (5173) and serves /api/* via the netlify functions runtime.
    // If you'd rather just `npm run dev` and hit a deployed function, set
    // VITE_API_BASE in a .env.local file and point it at your Netlify URL.
    port: 5173,
  },
})
