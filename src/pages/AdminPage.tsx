/**
 * AdminPage.tsx
 *
 * Users — list, change role, remove (Supabase + GitHub collaborator)
 * Add collaborators — link to GitHub repo settings
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { UserProfile } from '../lib/supabase'

const GITHUB_ACCESS_URL = 'https://github.com/smario-7/company-dashboard/settings/access'

export function AdminPage() {
  const { user, storage, settings } = useAuth()

  const [users,   setUsers]   = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState<Record<string, boolean>>({})
  const [toast,   setToast]   = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setUsers(await settings.getAllProfiles())
    } finally {
      setLoading(false)
    }
  }, [settings])

  useEffect(() => { void reload() }, [reload])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const toggleRole = async (u: UserProfile) => {
    if (!user || user.role !== 'admin') {
      console.warn('Unauthorized: only admins can change roles')
      return
    }
    if (u.github_login === user.github_login) return

    const newRole = u.role === 'admin' ? 'member' : 'admin'
    await settings.updateProfile(u.id, { role: newRole })
    showToast(`@${u.github_login} is now ${newRole}`)
    void reload()
  }

  const removeUser = async (u: UserProfile) => {
    if (!user || user.role !== 'admin') {
      console.warn('Unauthorized: only admins can remove users')
      return
    }
    if (!storage) return
    if (u.github_login === user.github_login) return

    const key = `remove-${u.id}`
    setBusy(b => ({ ...b, [key]: true }))
    try {
      await storage.removeCollaborator(u.github_login)
      await settings.deleteProfile(u.id)
      showToast(`@${u.github_login} removed`)
      void reload()
    } catch (e: unknown) {
      showToast(`Error: ${e instanceof Error ? e.message : 'failed'}`)
    } finally {
      setBusy(b => ({ ...b, [key]: false }))
    }
  }

  if (!user || user.role !== 'admin') return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8 animate-fade-in">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-2xl bg-surface-800 border border-white/10
                        px-4 py-3 text-sm text-surface-50 shadow-modal animate-slide-up">
          {toast}
        </div>
      )}

      <h1 className="font-display text-xl font-bold text-surface-50">Admin Panel</h1>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-sm font-semibold text-surface-50">
            Users
            <span className="ml-2 badge bg-white/5 text-surface-200/50">{users.length}</span>
          </h2>
        </div>

        {loading ? (
          <p className="px-5 py-4 text-xs text-surface-200/40">Loading…</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {users.map(u => {
              const isSelf    = u.github_login === user.github_login
              const removeKey = `remove-${u.id}`
              return (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <img
                    src={u.avatar_url}
                    alt={u.display_name}
                    className="h-9 w-9 flex-shrink-0 rounded-full ring-1 ring-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-surface-50 truncate">{u.display_name}</p>
                      <span className={`badge flex-shrink-0 ${
                        u.role === 'admin'
                          ? 'bg-brand-500/15 text-brand-400'
                          : 'bg-white/5 text-surface-200/50'
                      }`}>
                        {u.role}
                      </span>
                      {isSelf && <span className="badge bg-accent-green/10 text-accent-green text-[10px]">you</span>}
                    </div>
                    <p className="text-xs text-surface-200/40">@{u.github_login}</p>
                  </div>

                  {!isSelf && user.role === 'admin' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => void toggleRole(u)}
                        className="btn-ghost text-xs py-1 px-2"
                        title={`Make ${u.role === 'admin' ? 'member' : 'admin'}`}
                      >
                        {u.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                      <button
                        onClick={() => void removeUser(u)}
                        disabled={busy[removeKey]}
                        className="btn-danger text-xs py-1 px-2"
                      >
                        {busy[removeKey] ? '…' : 'Remove'}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="text-sm font-semibold text-surface-50">Add collaborators</h2>
          <p className="mt-0.5 text-xs text-surface-200/40">
            Access is controlled by GitHub repository collaborators.
            Add users directly in GitHub to grant access.
          </p>
        </div>
        <div className="px-5 py-4">
          <a
            href={GITHUB_ACCESS_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-primary inline-flex"
          >
            Manage collaborators on GitHub →
          </a>
        </div>
      </section>
    </div>
  )
}
