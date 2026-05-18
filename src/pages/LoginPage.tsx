/**
 * LoginPage.tsx
 *
 * Two-step login:
 *   Step A  →  GitHub Device Flow   (first-time or re-linking)
 *   Step B  →  Password entry       (every day login)
 *
 * On first-time: after Device Flow the user sets a password.
 * On return visit: user types password, which decrypts the stored GitHub token.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitHubAuth } from '../lib/GitHubAuth'
import { GitHubStorage } from '../lib/GitHubStorage'
import { DatabaseManager } from '../lib/DatabaseManager'
import { hashPassword, verifyPassword, encrypt } from '../lib/crypto'
import { useAuth } from '../contexts/AuthContext'
import type { DBUser, DeviceCodeResponse } from '../lib/types'

const OWNER = import.meta.env.VITE_GITHUB_OWNER as string
const REPO  = import.meta.env.VITE_GITHUB_REPO  as string

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage =
  | 'idle'               // initial — show "Login" button
  | 'github-flow'        // Device Flow in progress — show user code
  | 'set-password'       // New user: choose a password
  | 'enter-password'     // Returning user: enter password
  | 'loading'            // Auth finalising

// ─── Page ────────────────────────────────────────────────────────────────────

export function LoginPage() {
  const navigate = useNavigate()
  const { user, login } = useAuth()

  const [stage,       setStage]       = useState<Stage>('idle')
  const [error,       setError]       = useState('')
  const [status,      setStatus]      = useState('')
  const [deviceInfo,  setDeviceInfo]  = useState<DeviceCodeResponse | null>(null)
  const [githubToken, setGithubToken] = useState('')
  const [dbUser,      setDbUser]      = useState<DBUser | null>(null)
  const [userEmail,   setUserEmail]   = useState('')
  const [password,    setPassword]    = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [codeCopied,  setCodeCopied]  = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/projects', { replace: true })
  }, [user, navigate])

  // ─── Step 1: Start GitHub Device Flow ──────────────────────────────────────

  const startDeviceFlow = async () => {
    setError('')
    setStage('github-flow')
    setStatus('Requesting device code…')

    try {
      const info = await GitHubAuth.requestDeviceCode()
      setDeviceInfo(info)

      abortRef.current = new AbortController()
      setStatus('Waiting for GitHub authorisation…')

      const token = await GitHubAuth.pollForToken(
        info.device_code,
        info.interval,
        setStatus,
        abortRef.current.signal,
      )

      setStatus('Fetching your GitHub profile…')
      const ghUser = await GitHubAuth.getUserInfo(token)
      setUserEmail(ghUser.email)
      setGithubToken(token)

      // Check if user already exists in DB
      const tempStorage = new GitHubStorage(token, OWNER, REPO, ghUser.login, ghUser.email)
      const manager     = new DatabaseManager(tempStorage)
      await manager.init()

      const existing = manager.queryOne<DBUser>(
        'SELECT * FROM users WHERE github_id = ?',
        [ghUser.id],
      )

      if (existing) {
        // Returning user — update token and ask for password
        setDbUser(existing)
        setStage('enter-password')
      } else {
        // New user — check they have repo access (they could get the token somehow)
        // (access is implicitly verified by being able to read/write the DB)
        setDbUser(null)
        setStage('set-password')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
      setStage('idle')
    }
  }

  // ─── Step 2a: New user sets password ───────────────────────────────────────

  const submitSetPassword = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPw) {
      setError('Passwords do not match')
      return
    }

    setError('')
    setStage('loading')
    setStatus('Creating your account…')

    try {
      const ghUser = await GitHubAuth.getUserInfo(githubToken)
      const tempStorage = new GitHubStorage(githubToken, OWNER, REPO, ghUser.login, ghUser.email)
      const manager     = new DatabaseManager(tempStorage)
      await manager.init()

      const pwHash          = await hashPassword(password)
      const encryptedToken  = await encrypt(githubToken, password)

      manager.execute(
        `INSERT INTO users
           (github_login, github_id, display_name, avatar_url,
            password_hash, github_token_encrypted)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ghUser.login, ghUser.id, ghUser.name ?? ghUser.login,
         ghUser.avatar_url, pwHash, encryptedToken],
      )

      // Insert default notification prefs
      manager.execute(
        `INSERT OR IGNORE INTO notification_prefs (user_id)
         SELECT id FROM users WHERE github_id = ?`,
        [ghUser.id],
      )

      await manager.flush('feat: register new user')

      const newUser = manager.queryOne<DBUser>(
        'SELECT * FROM users WHERE github_id = ?',
        [ghUser.id],
      )!

      await login({
        githubToken,
        password,
        dbUser: newUser,
        email: ghUser.email,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
      setStage('set-password')
    }
  }

  // ─── Step 2b: Returning user enters password ────────────────────────────────

  const submitPassword = async () => {
    if (!dbUser) return
    setError('')
    setStage('loading')
    setStatus('Verifying password…')

    try {
      const ok = await verifyPassword(password, dbUser.password_hash)
      if (!ok) {
        setError('Incorrect password')
        setStage('enter-password')
        return
      }

      // If user did Device Flow, update encrypted token
      let finalToken = githubToken
      if (!finalToken && dbUser.github_token_encrypted) {
        const { decrypt } = await import('../lib/crypto')
        finalToken = await decrypt(dbUser.github_token_encrypted, password)
      }

      await login({ githubToken: finalToken, password, dbUser, email: userEmail })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setStage('enter-password')
    }
  }

  const copyCode = () => {
    if (!deviceInfo) return
    navigator.clipboard.writeText(deviceInfo.user_code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const cancelFlow = () => {
    abortRef.current?.abort()
    setStage('idle')
    setError('')
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-900 px-4">
      {/* Background grid effect */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(79,142,247,1) 1px, transparent 1px), linear-gradient(90deg, rgba(79,142,247,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Logo / title */}
      <div className="mb-10 flex flex-col items-center gap-2 animate-fade-in">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/30">
          <GridIcon className="h-6 w-6 text-brand-400" />
        </div>
        <h1 className="font-display text-2xl font-700 tracking-tight text-surface-50">
          Company Dashboard
        </h1>
        <p className="text-xs text-surface-200/40">Project workspace · GitHub-backed</p>
      </div>

      {/* Card */}
      <div className="glass w-full max-w-sm rounded-3xl p-6 shadow-modal animate-slide-up">
        {error && (
          <div className="mb-4 rounded-xl bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
            {error}
          </div>
        )}

        {/* ── IDLE ── */}
        {stage === 'idle' && (
          <div className="flex flex-col gap-3">
            <p className="mb-2 text-xs text-surface-200/50">
              Sign in with your GitHub account. Only workspace members can log in.
            </p>
            <button onClick={startDeviceFlow} className="btn-primary w-full py-2.5">
              <GitHubIcon className="h-4 w-4" />
              Continue with GitHub
            </button>
          </div>
        )}

        {/* ── DEVICE FLOW ── */}
        {stage === 'github-flow' && deviceInfo && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-surface-200/50">
              Open{' '}
              <a
                href={deviceInfo.verification_uri}
                target="_blank"
                rel="noreferrer"
                className="text-brand-400 underline underline-offset-2"
              >
                {deviceInfo.verification_uri}
              </a>{' '}
              and enter this code:
            </p>

            <button
              onClick={copyCode}
              className="group relative flex items-center gap-3 rounded-2xl bg-surface-850
                         px-6 py-4 ring-1 ring-white/10 transition hover:ring-brand-400/30"
            >
              <span className="font-mono text-2xl font-500 tracking-[0.3em] text-surface-50">
                {deviceInfo.user_code}
              </span>
              <span className="text-xs text-surface-200/30 group-hover:text-brand-400">
                {codeCopied ? '✓ copied' : 'copy'}
              </span>
            </button>

            <div className="flex items-center gap-2">
              <div className="h-1 w-1 animate-pulse-slow rounded-full bg-accent-green" />
              <p className="text-xs text-surface-200/40">{status}</p>
            </div>

            <button onClick={cancelFlow} className="btn-ghost text-xs">
              Cancel
            </button>
          </div>
        )}

        {/* ── DEVICE FLOW (waiting for code) ── */}
        {stage === 'github-flow' && !deviceInfo && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-surface-800 border-t-brand-400" />
            <p className="text-xs text-surface-200/40">{status}</p>
          </div>
        )}

        {/* ── SET PASSWORD (new user) ── */}
        {stage === 'set-password' && (
          <div className="flex flex-col gap-3">
            <div className="mb-1">
              <p className="text-sm font-medium text-surface-50">Choose a password</p>
              <p className="mt-0.5 text-xs text-surface-200/40">
                This password encrypts your GitHub token. You'll enter it on each login.
              </p>
            </div>
            <input
              type="password"
              placeholder="Password (min. 8 characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              className="input"
              onKeyDown={e => e.key === 'Enter' && submitSetPassword()}
            />
            <button onClick={submitSetPassword} className="btn-primary w-full">
              Create account
            </button>
          </div>
        )}

        {/* ── ENTER PASSWORD (returning user) ── */}
        {stage === 'enter-password' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 mb-1">
              {dbUser?.avatar_url && (
                <img
                  src={dbUser.avatar_url}
                  alt={dbUser.display_name}
                  className="h-9 w-9 rounded-full ring-1 ring-white/10"
                />
              )}
              <div>
                <p className="text-sm font-medium text-surface-50">
                  {dbUser?.display_name ?? dbUser?.github_login}
                </p>
                <p className="text-xs text-surface-200/40">@{dbUser?.github_login}</p>
              </div>
            </div>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && submitPassword()}
            />
            <button onClick={submitPassword} className="btn-primary w-full">
              Sign in
            </button>
            <button
              onClick={() => { setStage('idle'); setPassword('') }}
              className="btn-ghost text-xs w-full"
            >
              Use a different account
            </button>
          </div>
        )}

        {/* ── LOADING ── */}
        {stage === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-surface-800 border-t-brand-400" />
            <p className="text-xs text-surface-200/40">{status || 'Signing in…'}</p>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-surface-200/25">
        Access is restricted to GitHub repository collaborators.
      </p>
    </div>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
