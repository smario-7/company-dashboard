import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/company-dashboard/',

  // ── Dev proxy — solves CORS for GitHub OAuth endpoints ──────────────────────
  // In production a Cloudflare Worker handles this (see workers/github-proxy.js)
  server: {
    proxy: {
      '/github-proxy': {
        target: 'https://github.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/github-proxy/, ''),
        secure: true,
      },
    },
  },

  optimizeDeps: {
    // sql.js is loaded via <script> tag in index.html, not bundled
  },
  build: {
    rollupOptions: {},
  },
})
