import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/company-dashboard/',
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  build: {
    rollupOptions: {
      output: {
        // Keep sql.js as a separate chunk - it's large (~1MB)
        manualChunks: {
          'sql-js': ['sql.js'],
        },
      },
    },
  },
})
