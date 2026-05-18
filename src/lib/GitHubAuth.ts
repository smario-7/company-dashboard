/**
 * GitHubAuth.ts
 *
 * Implements GitHub OAuth 2.0 Device Authorization Grant (RFC 8628).
 * Works entirely from the browser — no server or client_secret needed.
 *
 * Flow:
 *   1. requestDeviceCode()  →  get device_code + user_code
 *   2. Show user_code and verification_uri to the user
 *   3. pollForToken()       →  poll until user authorises or code expires
 *   4. getUserInfo()        →  fetch GitHub profile with the token
 */

import type { DeviceCodeResponse, GitHubUserInfo } from './types'

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string
const SCOPE     = 'repo user:email'

export class GitHubAuth {
  // ─── Step 1: request device + user codes ───────────────────────────────────

  static async requestDeviceCode(): Promise<DeviceCodeResponse> {
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept:         'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPE }),
    })

    if (!res.ok) {
      throw new Error(`Device code request failed: ${res.status}`)
    }

    return res.json() as Promise<DeviceCodeResponse>
  }

  // ─── Step 2: poll until authorised ─────────────────────────────────────────

  /**
   * Polls GitHub every `interval` seconds until the user completes auth.
   *
   * @param deviceCode   - from requestDeviceCode()
   * @param interval     - poll interval in seconds (from GitHub response)
   * @param onStatus     - optional callback to report status strings to the UI
   * @param signal       - AbortSignal to cancel polling
   */
  static async pollForToken(
    deviceCode: string,
    interval: number,
    onStatus?: (msg: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    let delay = interval * 1000

    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (signal?.aborted) {
          return reject(new Error('Polling cancelled'))
        }

        try {
          const res = await fetch('https://github.com/login/oauth/access_token', {
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

          if (data.access_token) {
            return resolve(data.access_token)
          }

          switch (data.error) {
            case 'authorization_pending':
              onStatus?.('Waiting for authorisation…')
              break
            case 'slow_down':
              delay += 5_000           // GitHub asked us to back off
              onStatus?.('Slowing down…')
              break
            case 'expired_token':
              return reject(new Error('Code expired — please try again'))
            case 'access_denied':
              return reject(new Error('Access denied by user'))
            default:
              return reject(
                new Error(data.error_description ?? data.error ?? 'Unknown error'),
              )
          }

          setTimeout(poll, delay)
        } catch (err) {
          reject(err)
        }
      }

      // Start polling after the first interval
      setTimeout(poll, delay)
    })
  }

  // ─── Step 3: fetch user profile ────────────────────────────────────────────

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

    const user  = await userRes.json() as { login: string; id: number; name: string | null; avatar_url: string }
    const emails = emailsRes.ok
      ? await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>
      : []

    const primaryEmail =
      emails.find(e => e.primary && e.verified)?.email ??
      emails[0]?.email ??
      ''

    return {
      login:      user.login,
      id:         user.id,
      name:       user.name,
      avatar_url: user.avatar_url,
      email:      primaryEmail,
    }
  }

  // ─── Validate existing token ────────────────────────────────────────────────

  /** Returns user info if the token is still valid, null otherwise. */
  static async validateToken(token: string): Promise<GitHubUserInfo | null> {
    try {
      return await GitHubAuth.getUserInfo(token)
    } catch {
      return null
    }
  }
}
