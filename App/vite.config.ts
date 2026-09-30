import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/DEMO_Accounting/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/demo': 'http://localhost:4174',
    },
  },
}))
