import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** GitHub Pages: 404.html = index.html dla tras SPA (React Router). */
function githubPagesSpaFallback() {
  return {
    name: 'github-pages-spa-fallback',
    closeBundle() {
      const dist = resolve(__dirname, 'dist')
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
    },
  }
}

export default defineConfig({
  plugins: [react(), githubPagesSpaFallback()],
  base: '/company-dashboard/',
  optimizeDeps: {},
  build: {
    rollupOptions: {},
  },
})
