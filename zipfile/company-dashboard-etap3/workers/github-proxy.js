/**
 * github-proxy.js — Cloudflare Worker
 *
 * Proxies two GitHub OAuth endpoints that block browser requests via CORS:
 *   POST /login/device/code
 *   POST /login/oauth/access_token
 *
 * Deploy:
 *   1. Go to https://workers.cloudflare.com  (free account)
 *   2. Create Worker → paste this file → Save & Deploy
 *   3. Copy the worker URL (e.g. https://github-proxy.YOUR_NAME.workers.dev)
 *   4. Add to GitHub repo secrets: VITE_GITHUB_PROXY_URL = <worker URL>
 *
 * Security:
 *   - Only the two OAuth paths are forwarded; everything else returns 403
 *   - No secrets stored in the worker
 */

const ALLOWED_PATHS = new Set([
  '/login/device/code',
  '/login/oauth/access_token',
])

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
}

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url      = new URL(request.url)
    const pathname = url.pathname

    // Only allow the two OAuth paths
    if (!ALLOWED_PATHS.has(pathname)) {
      return new Response(JSON.stringify({ error: 'Not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      })
    }

    // Forward to GitHub
    const githubUrl  = `https://github.com${pathname}`
    const body       = await request.text()

    const upstream = await fetch(githubUrl, {
      method:  'POST',
      headers: {
        'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
        'Accept':        request.headers.get('Accept')       ?? 'application/json',
      },
      body,
    })

    const responseBody = await upstream.text()

    return new Response(responseBody, {
      status:  upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
        ...CORS_HEADERS,
      },
    })
  },
}
