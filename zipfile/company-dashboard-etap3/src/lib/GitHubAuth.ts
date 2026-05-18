/**
 * GitHubAuth.ts
 *
 * GitHub OAuth 2.0 Device Authorization Grant.
 *
 * GitHub does NOT set Access-Control-Allow-Origin on its OAuth endpoints,
 * so direct browser fetch is blocked. We route through a proxy:
 *
 *   DEV  → Vite proxy at /github-proxy  (configured in vite.config.ts)
 *   PROD → Cloudflare Worker at VITE_GITHUB_PROXY_URL (workers/github-proxy.js)
 */

import type { DeviceCodeResponse, GitHubUserInfo } from './types'

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string
const SCOPE     = 'repo user:email'

/**
 * Base URL for GitHub OAuth proxy.
 * In development Vite rewrites /github-proxy/* → https://github.com/*
 * In production we point to the Cloudflare Worker.
 */
function proxyBase(): string {
  if (import.meta.env.DEV) return '/github-proxy'
  const worker = import.meta.env.VITE_GITHUB_PROXY_URL as string | undefined
  if (!worker) {
    throw new Error(
      'VITE_GITHUB_PROXY_URL is not set. ' +
      'Deploy the Cloudflare Worker from workers/github-proxy.js ' +
      'and add its URL as a GitHub secret.',
    )
  }
  return worker
}

export class GitHubAuth {
  // ─── Step 1: request device + user codes ──────────────────────────────────

  static async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const res = await fetch(`${proxyBase()}/login/device/code`, {
      method: 'POST',
      headers: {
        Accept:         'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPE }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Device code request failed (${res.status}): ${text}`)
    }

    return res.json() as Promise<DeviceCodeResponse>
  }

  // ─── Step 2: poll until authorised ────────────────────────────────────────

  static async pollForToken(
    deviceCode: string,
    interval: number,
    onStatus?: (msg: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    let delay = interval * 1000

    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (signal?.aborted) return reject(new Error('Polling cancelled'))

        try {
          const res = await fetch(`${proxyBase()}/login/oauth/access_token`, {
            method: 'POST',
            headers: {
              Accept:         'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id:   CLIENT_ID,
              device_code: deviceCode,
              grant_type:  'urn:ietf:params:oauth:grant-type:device_code',
            }),
          })

          const data = await res.json() as Record<string, string>

          if (data.access_token) return resolve(data.access_token)

          switch (data.error) {
            case 'authorization_pending':
              onStatus?.('Waiting for authorisation…')
              break
            case 'slow_down':
              delay += 5_000
              onStatus?.('Slowing down…')
              break
            case 'expired_token':
              return reject(new Error('Code expired — please try again'))
            case 'access_denied':
              return reject(new Error('Access denied by user'))
            default:
              return reject(new Error(data.error_description ?? data.error ?? 'Unknown error'))
          }

          setTimeout(poll, delay)
        } catch (err) {
          reject(err)
        }
      }

      setTimeout(poll, delay)
    })
  }

  // ─── Step 3: fetch user profile (direct — api.github.com supports CORS) ───

  static async getUserInfo(token: string): Promise<GitHubUserInfo> {
    const [userRes, emailsRes] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])

    if (!userRes.ok) throw new Error(`Failed to fetch GitHub user: ${userRes.status}`)

    const user   = await userRes.json() as { login: string; id: number; name: string | null; avatar_url: string }
    const emails = emailsRes.ok
      ? await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>
      : []

    const primaryEmail =
      emails.find(e => e.primary && e.verified)?.email ??
      emails[0]?.email ??
      ''

    return { login: user.login, id: user.id, name: user.name, avatar_url: user.avatar_url, email: primaryEmail }
  }

  static async validateToken(token: string): Promise<GitHubUserInfo | null> {
    try { return await GitHubAuth.getUserInfo(token) }
    catch { return null }
  }
}
