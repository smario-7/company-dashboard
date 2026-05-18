/**
 * AdminPage.tsx
 *
 * Two sections:
 *  1. Users     — list, change role, remove (SQLite + GitHub collaborator)
 *  2. Invitations — add GitHub login to whitelist, revoke pending invites
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { WorkspaceManager } from '../lib/WorkspaceManager'
import type { DBUser, DBInvitation } from '../lib/types'

export function AdminPage() {
  const { user, db, storage } = useAuth()

  const [users,       setUsers]       = useState<DBUser[]>([])
  const [invitations, setInvitations] = useState<DBInvitation[]>([])
  const [inviteInput, setInviteInput] = useState('')
  const [inviteErr,   setInviteErr]   = useState('')
  const [busy,        setBusy]        = useState<Record<string, boolean>>({})
  const [toast,       setToast]       = useState('')

  const ws = (db && storage) ? new WorkspaceManager(storage, db) : null

  const reload = useCallback(() => {
    if (!db) return
    setUsers(db.query<DBUser>('SELECT * FROM users ORDER BY created_at ASC'))
    setInvitations(ws?.listPendingInvitations() ?? [])
  }, [db])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { reload() }, [reload])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Change role ──────────────────────────────────────────────────────────────

  const toggleRole = (u: DBUser) => {
    if (!db || !user) return
    if (u.github_login === user.githubLogin) return  // can't demote yourself
    const newRole = u.role === 'admin' ? 'member' : 'admin'
    db.execute('UPDATE users SET role = ? WHERE id = ?', [newRole, u.id])
    showToast(`@${u.github_login} is now ${newRole}`)
    reload()
  }

  // ── Remove user ──────────────────────────────────────────────────────────────

  const removeUser = async (u: DBUser) => {
    if (!db || !storage || !user) return
    if (u.github_login === user.githubLogin) return  // can't remove yourself

    const key = `remove-${u.id}`
    setBusy(b => ({ ...b, [key]: true }))
    try {
      // 1. Remove from GitHub collaborators
      await storage.removeCollaborator(u.github_login)
      // 2. Remove from SQLite (cascades to sessions, prefs, etc.)
      db.execute('DELETE FROM users WHERE id = ?', [u.id])
      await db.flush(`feat: remove user ${u.github_login}`)
      showToast(`@${u.github_login} removed`)
      reload()
    } catch (e: unknown) {
      showToast(`Error: ${e instanceof Error ? e.message : 'failed'}`)
    } finally {
      setBusy(b => ({ ...b, [key]: false }))
    }
  }

  // ── Add invitation ───────────────────────────────────────────────────────────

  const addInvitation = () => {
    if (!ws || !user || !db) return
    const login = inviteInput.trim().toLowerCase().replace(/^@/, '')
    if (!login) return

    // Check not already a user
    const exists = db.queryOne('SELECT id FROM users WHERE github_login = ?', [login])
    if (exists) { setInviteErr('This user is already registered'); return }

    // Check not already invited
    const alreadyInvited = db.queryOne(
      'SELECT id FROM invitations WHERE github_login = ? AND used_at IS NULL', [login]
    )
    if (alreadyInvited) { setInviteErr('Already invited'); return }

    ws.addInvitation(login, user.id)
    setInviteInput('')
    setInviteErr('')
    showToast(`Invitation sent to @${login}`)
    reload()
  }

  // ── Revoke invitation ────────────────────────────────────────────────────────

  const revokeInvitation = (inv: DBInvitation) => {
    if (!ws) return
    ws.revokeInvitation(inv.id)
    showToast(`Invitation for @${inv.github_login} revoked`)
    reload()
  }

  if (!user || user.role !== 'admin') return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-2xl bg-surface-800 border border-white/10
                        px-4 py-3 text-sm text-surface-50 shadow-modal animate-slide-up">
          {toast}
        </div>
      )}

      <h1 className="font-display text-xl font-bold text-surface-50">Admin Panel</h1>

      {/* ── Users ──────────────────────────────────────────────────────────── */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-sm font-semibold text-surface-50">
            Users
            <span className="ml-2 badge bg-white/5 text-surface-200/50">{users.length}</span>
          </h2>
        </div>

        <ul className="divide-y divide-white/5">
          {users.map(u => {
            const isSelf    = u.github_login === user.githubLogin
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
                  <p className="text-xs text-surface-200/40">
                    @{u.github_login}
                    {u.last_login_at && (
                      <span className="ml-2">· last seen {formatDate(u.last_login_at)}</span>
                    )}
                  </p>
                </div>

                {!isSelf && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleRole(u)}
                      className="btn-ghost text-xs py-1 px-2"
                      title={`Make ${u.role === 'admin' ? 'member' : 'admin'}`}
                    >
                      {u.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                    <button
                      onClick={() => removeUser(u)}
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
      </section>

      {/* ── Invitations ────────────────────────────────────────────────────── */}
      <section className="card overflow-hidden">
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="text-sm font-semibold text-surface-50">
            Invite users
            {invitations.length > 0 && (
              <span className="ml-2 badge bg-brand-500/15 text-brand-400">{invitations.length} pending</span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-surface-200/40">
            Enter a GitHub username. The user will be able to register when they sign in.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {inviteErr && (
            <p className="text-xs text-accent-red">{inviteErr}</p>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-200/40 text-sm">@</span>
              <input
                type="text"
                placeholder="github-username"
                value={inviteInput}
                onChange={e => { setInviteInput(e.target.value); setInviteErr('') }}
                onKeyDown={e => e.key === 'Enter' && addInvitation()}
                className="input pl-7"
              />
            </div>
            <button onClick={addInvitation} className="btn-primary flex-shrink-0">
              Invite
            </button>
          </div>

          {/* Pending invitations list */}
          {invitations.length > 0 && (
            <ul className="space-y-2 pt-1">
              {invitations.map(inv => (
                <li key={inv.id}
                  className="flex items-center justify-between rounded-xl bg-surface-850 px-3 py-2">
                  <span className="text-sm text-surface-200">@{inv.github_login}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-surface-200/40">{formatDate(inv.invited_at)}</span>
                    <button
                      onClick={() => revokeInvitation(inv)}
                      className="text-xs text-accent-red/70 hover:text-accent-red transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {invitations.length === 0 && (
            <p className="text-xs text-surface-200/30 py-2">No pending invitations.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
