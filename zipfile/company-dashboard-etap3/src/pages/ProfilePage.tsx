/**
 * ProfilePage.tsx
 *
 * - Display name, avatar, role badge
 * - Change password (re-encrypts GitHub token with new password)
 * - Theme preference (light / dark / system)
 * - Session info
 */

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { verifyPassword, hashPassword, encrypt } from '../lib/crypto'
import type { DBUser } from '../lib/types'

type ThemeOption = 'light' | 'dark' | 'system'

export function ProfilePage() {
  const { user, db, refreshCredentials } = useAuth()

  // ── Password change ─────────────────────────────────────────────────────────
  const [oldPw,     setOldPw]     = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwStatus,  setPwStatus]  = useState<'idle' | 'saving' | 'ok' | 'err'>('idle')
  const [pwError,   setPwError]   = useState('')

  const changePassword = async () => {
    if (!user || !db) return
    if (newPw.length < 8)    { setPwError('Minimum 8 characters'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }

    setPwError('')
    setPwStatus('saving')

    try {
      // Load current user from DB
      const dbUser = db.queryOne<DBUser>(
        'SELECT * FROM users WHERE github_login = ?', [user.githubLogin]
      )
      if (!dbUser) throw new Error('User not found')

      // Verify old password
      const ok = await verifyPassword(oldPw, dbUser.password_hash)
      if (!ok) { setPwError('Incorrect current password'); setPwStatus('err'); return }

      // Decrypt token with old password, re-encrypt with new
      const { decrypt } = await import('../lib/crypto')
      const token         = await decrypt(dbUser.github_token_encrypted!, oldPw)
      const newHash       = await hashPassword(newPw)
      const newEncrypted  = await encrypt(token, newPw)

      db.execute(
        `UPDATE users SET password_hash = ?, github_token_encrypted = ? WHERE github_login = ?`,
        [newHash, newEncrypted, user.githubLogin],
      )

      // Refresh local credential cache
      const updated = db.queryOne<DBUser>(
        'SELECT * FROM users WHERE github_login = ?', [user.githubLogin]
      )!
      refreshCredentials(updated)

      setOldPw(''); setNewPw(''); setConfirmPw('')
      setPwStatus('ok')
      setTimeout(() => setPwStatus('idle'), 3000)
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : 'Failed to change password')
      setPwStatus('err')
    }
  }

  // ── Theme ────────────────────────────────────────────────────────────────────
  const [themeSaving, setThemeSaving] = useState(false)

  const setTheme = async (theme: ThemeOption) => {
    if (!user || !db) return
    setThemeSaving(true)
    db.execute(
      `UPDATE users SET theme = ? WHERE github_login = ?`,
      [theme, user.githubLogin],
    )
    const updated = db.queryOne<DBUser>(
      'SELECT * FROM users WHERE github_login = ?', [user.githubLogin]
    )!
    refreshCredentials(updated)

    // Apply to DOM
    document.documentElement.classList.toggle('dark', theme !== 'light')
    setTimeout(() => setThemeSaving(false), 500)
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6 animate-fade-in">
      <h1 className="font-display text-xl font-bold text-surface-50">Profile</h1>

      {/* ── Identity card ──────────────────────────────────────────────────── */}
      <div className="card p-5 flex items-center gap-4">
        <img
          src={user.avatarUrl}
          alt={user.displayName}
          className="h-16 w-16 rounded-2xl ring-2 ring-white/10"
        />
        <div>
          <p className="text-base font-semibold text-surface-50">{user.displayName}</p>
          <p className="text-sm text-surface-200/50">@{user.githubLogin}</p>
          <span className={`badge mt-2 ${
            user.role === 'admin'
              ? 'bg-brand-500/15 text-brand-400'
              : 'bg-white/5 text-surface-200/60'
          }`}>
            {user.role}
          </span>
        </div>
      </div>

      {/* ── Theme ──────────────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-surface-50">Appearance</h2>
        <div className="flex gap-2">
          {(['dark', 'light', 'system'] as ThemeOption[]).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              disabled={themeSaving}
              className={`flex-1 rounded-xl border py-2 text-xs font-medium capitalize transition-all ${
                user.theme === t
                  ? 'border-brand-400/50 bg-brand-500/10 text-brand-400'
                  : 'border-white/5 bg-surface-800 text-surface-200/50 hover:border-white/10 hover:text-surface-200'
              }`}
            >
              {t === 'dark' ? '🌙' : t === 'light' ? '☀️' : '💻'} {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Change password ────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-surface-50">Change password</h2>
        <p className="text-xs text-surface-200/40">
          Changing your password re-encrypts your stored GitHub token.
        </p>

        {pwError && (
          <div className="rounded-xl bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
            {pwError}
          </div>
        )}
        {pwStatus === 'ok' && (
          <div className="rounded-xl bg-accent-green/10 px-3 py-2 text-xs text-accent-green">
            ✓ Password changed successfully
          </div>
        )}

        <input
          type="password"
          placeholder="Current password"
          value={oldPw}
          onChange={e => setOldPw(e.target.value)}
          className="input"
        />
        <input
          type="password"
          placeholder="New password (min. 8 characters)"
          value={newPw}
          onChange={e => setNewPw(e.target.value)}
          className="input"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPw}
          onChange={e => setConfirmPw(e.target.value)}
          className="input"
          onKeyDown={e => e.key === 'Enter' && changePassword()}
        />
        <button
          onClick={changePassword}
          disabled={pwStatus === 'saving' || !oldPw || !newPw || !confirmPw}
          className="btn-primary w-full"
        >
          {pwStatus === 'saving' ? 'Saving…' : 'Update password'}
        </button>
      </div>

      {/* ── Session info ───────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-2">
        <h2 className="text-sm font-semibold text-surface-50">Session</h2>
        <p className="font-mono text-xs text-surface-200/40">
          GitHub account: <span className="text-surface-200">@{user.githubLogin}</span>
        </p>
        <p className="font-mono text-xs text-surface-200/40">
          Token: <span className="text-accent-green">active</span> · expires in 7 days
        </p>
      </div>
    </div>
  )
}
