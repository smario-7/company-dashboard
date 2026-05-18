/**
 * LoginPage.tsx
 *
 * Stage flow:
 *  'idle'           – show "Continue as @user" (if creds cached) or "Sign in with GitHub"
 *  'password'       – returning user enters password (no Device Flow needed)
 *  'github-flow'    – Device Flow in progress
 *  'access-denied'  – user not invited
 *  'set-password'   – new user picks a password
 *  'loading'        – finalising auth
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitHubAuth } from '../lib/GitHubAuth'
import { GitHubStorage } from '../lib/GitHubStorage'
import { DatabaseManager } from '../lib/DatabaseManager'
import { WorkspaceManager } from '../lib/WorkspaceManager'
import { hashPassword, verifyPassword, encrypt, decrypt } from '../lib/crypto'
import { useAuth, getLocalCredentials } from '../contexts/AuthContext'
import type { DBUser, DeviceCodeResponse } from '../lib/types'

const OWNER = import.meta.env.VITE_GITHUB_OWNER
const REPO  = import.meta.env.VITE_GITHUB_REPO

type Stage = 'idle' | 'password' | 'github-flow' | 'access-denied'
           | 'set-password' | 'loading'

export function LoginPage() {
  const navigate     = useNavigate()
  const { user, login } = useAuth()
  const cachedCreds  = getLocalCredentials()

  const [stage,      setStage]      = useState<Stage>('idle')
  const [error,      setError]      = useState('')
  const [status,     setStatus]     = useState('')
  const [device,     setDevice]     = useState<DeviceCodeResponse | null>(null)
  const [ghToken,    setGhToken]    = useState('')
  const [ghUser,     setGhUser]     = useState<{ login: string; id: number; name: string|null; avatar_url: string; email: string } | null>(null)
  const [dbUser,     setDbUser]     = useState<DBUser | null>(null)
  const [password,   setPassword]   = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [copied,     setCopied]     = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (user) navigate('/projects', { replace: true })
  }, [user, navigate])

  // ─── Returning user: password only ─────────────────────────────────────────

  const submitPassword = async () => {
    if (!cachedCreds) return
    setError('')
    setStage('loading')
    setStatus('Verifying password…')

    try {
      const ok = await verifyPassword(password, cachedCreds.passwordHash)
      if (!ok) { setError('Incorrect password'); setStage('password'); return }

      setStatus('Decrypting credentials…')
      const token = await decrypt(cachedCreds.githubTokenEncrypted, password)

      setStatus('Loading workspace…')
      const st      = new GitHubStorage(token, OWNER, REPO, cachedCreds.githubLogin, cachedCreds.email)
      const manager = new DatabaseManager(st)
      await manager.init()

      const found = manager.queryOne<DBUser>(
        'SELECT * FROM users WHERE github_login = ?',
        [cachedCreds.githubLogin],
      )
      if (!found) { setError('User not found in database'); setStage('idle'); return }

      // Update last_login_at
      manager.execute(
        `UPDATE users SET last_login_at = datetime('now') WHERE github_login = ?`,
        [cachedCreds.githubLogin],
      )

      await login({ githubToken: token, dbUser: found, email: cachedCreds.email })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
      setStage('password')
    }
  }

  // ─── Device Flow ───────────────────────────────────────────────────────────

  const startDeviceFlow = async () => {
    setError('')
    setStage('github-flow')
    setStatus('Requesting device code…')

    try {
      const info = await GitHubAuth.requestDeviceCode()
      setDevice(info)
      abortRef.current = new AbortController()
      setStatus('Waiting for GitHub authorisation…')

      const token = await GitHubAuth.pollForToken(
        info.device_code,
        info.interval,
        setStatus,
        abortRef.current.signal,
      )

      setStatus('Fetching GitHub profile…')
      const gu = await GitHubAuth.getUserInfo(token)
      setGhToken(token)
      setGhUser(gu)

      // Load DB to check invitation + existing user
      setStatus('Checking workspace access…')
      const st      = new GitHubStorage(token, OWNER, REPO, gu.login, gu.email)
      const manager = new DatabaseManager(st)
      await manager.init()
      const ws = new WorkspaceManager(st, manager)

      const existing = manager.queryOne<DBUser>(
        'SELECT * FROM users WHERE github_id = ?',
        [gu.id],
      )

      if (existing) {
        // Returning user via Device Flow (new device / token expired)
        setDbUser(existing)
        setStage('password')
        return
      }

      // New user — check invitation
      if (!ws.isInvited(gu.login)) {
        setStage('access-denied')
        return
      }

      setStage('set-password')
    } catch (e: unknown) {
      if ((e as Error).message === 'Polling cancelled') { setStage('idle'); return }
      setError(e instanceof Error ? e.message : 'GitHub auth failed')
      setStage('idle')
    }
  }

  // ─── New user: set password ─────────────────────────────────────────────────

  const submitSetPassword = async () => {
    if (password.length < 8)       { setError('Minimum 8 characters'); return }
    if (password !== confirmPw)    { setError('Passwords do not match'); return }
    if (!ghToken || !ghUser)       { setError('Missing GitHub token'); return }

    setError('')
    setStage('loading')
    setStatus('Creating account…')

    try {
      const st      = new GitHubStorage(ghToken, OWNER, REPO, ghUser.login, ghUser.email)
      const manager = new DatabaseManager(st)
      await manager.init()
      const ws      = new WorkspaceManager(st, manager)

      const isFirst        = ws.isFirstUser()
      const role           = isFirst ? 'admin' : 'member'
      const pwHash         = await hashPassword(password)
      const encryptedToken = await encrypt(ghToken, password)

      manager.execute(
        `INSERT INTO users
           (github_login, github_id, display_name, avatar_url,
            password_hash, github_token_encrypted, role)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ghUser.login, ghUser.id, ghUser.name ?? ghUser.login,
         ghUser.avatar_url, pwHash, encryptedToken, role],
      )

      manager.execute(
        `INSERT OR IGNORE INTO notification_prefs (user_id)
         SELECT id FROM users WHERE github_id = ?`,
        [ghUser.id],
      )

      // Mark invitation used (no-op for first user)
      ws.markInvitationUsed(ghUser.login)

      await manager.flush(`feat: register user ${ghUser.login}`)

      // Ensure workspace config exists
      await ws.ensureConfig()

      const newUser = manager.queryOne<DBUser>(
        'SELECT * FROM users WHERE github_id = ?',
        [ghUser.id],
      )!

      await login({ githubToken: ghToken, dbUser: newUser, email: ghUser.email })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed')
      setStage('set-password')
    }
  }

  const copyCode = () => {
    if (!device) return
    navigator.clipboard.writeText(device.user_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-900 px-4">
      {/* Grid bg */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(rgba(79,142,247,1) 1px,transparent 1px),linear-gradient(90deg,rgba(79,142,247,1) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-2 animate-fade-in">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/30">
          <GridIcon className="h-6 w-6 text-brand-400" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-surface-50">
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
            {cachedCreds ? (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <img src={cachedCreds.avatarUrl} alt="" className="h-10 w-10 rounded-full ring-1 ring-white/10" />
                  <div>
                    <p className="text-sm font-medium text-surface-50">{cachedCreds.displayName}</p>
                    <p className="text-xs text-surface-200/40">@{cachedCreds.githubLogin}</p>
                  </div>
                </div>
                <button onClick={() => { setPassword(''); setStage('password') }} className="btn-primary w-full py-2.5">
                  Continue as @{cachedCreds.githubLogin}
                </button>
                <button onClick={startDeviceFlow} className="btn-ghost w-full text-xs">
                  <GitHubIcon className="h-3.5 w-3.5" /> Use a different account
                </button>
              </>
            ) : (
              <>
                <p className="mb-1 text-xs text-surface-200/50">
                  Sign in with your GitHub account. Only workspace members can log in.
                </p>
                <button onClick={startDeviceFlow} className="btn-primary w-full py-2.5">
                  <GitHubIcon className="h-4 w-4" /> Continue with GitHub
                </button>
              </>
            )}
          </div>
        )}

        {/* ── PASSWORD (returning user) ── */}
        {stage === 'password' && (
          <div className="flex flex-col gap-3">
            {(cachedCreds || dbUser) && (
              <div className="flex items-center gap-3 mb-1">
                <img
                  src={cachedCreds?.avatarUrl ?? dbUser?.avatar_url}
                  alt=""
                  className="h-9 w-9 rounded-full ring-1 ring-white/10"
                />
                <div>
                  <p className="text-sm font-medium text-surface-50">
                    {cachedCreds?.displayName ?? dbUser?.display_name}
                  </p>
                  <p className="text-xs text-surface-200/40">
                    @{cachedCreds?.githubLogin ?? dbUser?.github_login}
                  </p>
                </div>
              </div>
            )}
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
            <button onClick={() => { setStage('idle'); setPassword('') }} className="btn-ghost text-xs w-full">
              ← Back
            </button>
          </div>
        )}

        {/* ── GITHUB DEVICE FLOW ── */}
        {stage === 'github-flow' && !device && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-surface-800 border-t-brand-400" />
            <p className="text-xs text-surface-200/40">{status}</p>
          </div>
        )}
        {stage === 'github-flow' && device && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-xs text-center text-surface-200/50">
              Open{' '}
              <a href={device.verification_uri} target="_blank" rel="noreferrer"
                className="text-brand-400 underline underline-offset-2">
                {device.verification_uri}
              </a>{' '}and enter this code:
            </p>
            <button onClick={copyCode}
              className="group flex items-center gap-3 rounded-2xl bg-surface-850 px-6 py-4 ring-1 ring-white/10 transition hover:ring-brand-400/30">
              <span className="font-mono text-2xl font-medium tracking-[0.3em] text-surface-50">
                {device.user_code}
              </span>
              <span className="text-xs text-surface-200/30 group-hover:text-brand-400">
                {copied ? '✓' : 'copy'}
              </span>
            </button>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-accent-green" />
              <p className="text-xs text-surface-200/40">{status}</p>
            </div>
            <button onClick={() => { abortRef.current?.abort(); setStage('idle') }} className="btn-ghost text-xs">
              Cancel
            </button>
          </div>
        )}

        {/* ── ACCESS DENIED ── */}
        {stage === 'access-denied' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-red/10 ring-1 ring-accent-red/20">
              <span className="text-xl">🔒</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-surface-50">Access denied</p>
              <p className="mt-1 text-xs text-surface-200/40">
                Your GitHub account has not been invited to this workspace.
                Ask a workspace admin to invite <span className="text-surface-200">{ghUser?.login}</span>.
              </p>
            </div>
            <button onClick={() => setStage('idle')} className="btn-ghost text-xs">
              ← Back to login
            </button>
          </div>
        )}

        {/* ── SET PASSWORD (new user) ── */}
        {stage === 'set-password' && (
          <div className="flex flex-col gap-3">
            {ghUser && (
              <div className="flex items-center gap-3 mb-1">
                <img src={ghUser.avatar_url} alt="" className="h-9 w-9 rounded-full ring-1 ring-white/10" />
                <div>
                  <p className="text-sm font-medium text-surface-50">{ghUser.name ?? ghUser.login}</p>
                  <p className="text-xs text-surface-200/40">@{ghUser.login}</p>
                </div>
              </div>
            )}
            <p className="text-xs text-surface-200/40 mb-1">
              Choose a password. It encrypts your GitHub token and is required on every login.
            </p>
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

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}
function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  )
}
