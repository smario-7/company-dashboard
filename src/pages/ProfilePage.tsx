/**
 * ProfilePage.tsx
 *
 * - Display name, avatar, role badge
 * - Theme preference (light / dark / system)
 * - Account info and sign out
 */

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

type ThemeOption = 'light' | 'dark' | 'system'

export function ProfilePage() {
  const { user, settings, logout } = useAuth()
  const [themeOverride, setThemeOverride] = useState<ThemeOption | null>(null)
  const [themeSaving, setThemeSaving] = useState(false)

  const activeTheme = themeOverride ?? user?.theme ?? 'system'

  const setTheme = async (next: ThemeOption) => {
    if (!user) return
    setThemeOverride(next)
    setThemeSaving(true)
    await settings.updateProfile(user.id, { theme: next })
    document.documentElement.classList.toggle('dark', next !== 'light')
    setTimeout(() => setThemeSaving(false), 500)
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6 animate-fade-in">
      <h1 className="font-display text-xl font-bold text-surface-50">Profile</h1>

      <div className="card p-5 flex items-center gap-4">
        <img
          src={user.avatar_url}
          alt={user.display_name}
          className="h-16 w-16 rounded-2xl ring-2 ring-white/10"
        />
        <div>
          <p className="text-base font-semibold text-surface-50">{user.display_name}</p>
          <p className="text-sm text-surface-200/50">@{user.github_login}</p>
          <span className={`badge mt-2 ${
            user.role === 'admin'
              ? 'bg-brand-500/15 text-brand-400'
              : 'bg-white/5 text-surface-200/60'
          }`}>
            {user.role}
          </span>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-surface-50">Appearance</h2>
        <div className="flex gap-2">
          {(['dark', 'light', 'system'] as ThemeOption[]).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              disabled={themeSaving}
              className={`flex-1 rounded-xl border py-2 text-xs font-medium capitalize transition-all ${
                activeTheme === t
                  ? 'border-brand-400/50 bg-brand-500/10 text-brand-400'
                  : 'border-white/5 bg-surface-800 text-surface-200/50 hover:border-white/10 hover:text-surface-200'
              }`}
            >
              {t === 'dark' ? '🌙' : t === 'light' ? '☀️' : '💻'} {t}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-surface-50">Account</h2>
        <div className="flex items-center gap-3">
          <img src={user.avatar_url} className="h-10 w-10 rounded-full ring-1 ring-white/10" alt="" />
          <div>
            <p className="text-sm font-medium text-surface-50">{user.display_name}</p>
            <a
              href={`https://github.com/${user.github_login}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-400 hover:underline"
            >
              @{user.github_login}
            </a>
          </div>
        </div>
        <button onClick={() => void logout()} className="btn-ghost text-xs w-full text-left">
          Sign out
        </button>
      </div>
    </div>
  )
}
