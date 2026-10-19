import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // VITE_UI_PORT / VITE_API_PORT let test instances run aside a live dev
    // session (e.g. VITE_UI_PORT=5175 VITE_API_PORT=3003 npx vite).
    port: Number(process.env.VITE_UI_PORT) || 5174,
    proxy: {
      '/api': {
        target: `http://localhost:${Number(process.env.VITE_API_PORT) || 3002}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
