import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/CSV-Dashboard-Analyzer/',
  plugins: [react()],
})
