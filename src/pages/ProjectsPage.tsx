import { useAuth } from '../contexts/AuthContext'

export function ProjectsPage() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-surface-900">
      {/* Topbar */}
      <header className="flex h-14 items-center justify-between border-b border-white/5 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/15 ring-1 ring-brand-400/30">
            <svg className="h-4 w-4 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <span className="font-display text-sm font-600 text-surface-50">
            Company Dashboard
          </span>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="h-7 w-7 rounded-full ring-1 ring-white/10"
              />
              <button onClick={logout} className="btn-ghost text-xs">
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <div className="text-center">
          <p className="font-mono text-xs text-accent-green">✓ etap 1 complete</p>
          <h2 className="mt-2 font-display text-xl font-700 text-surface-50">
            Projects
          </h2>
          <p className="mt-1 text-xs text-surface-200/40">
            Coming in Etap 3
          </p>
        </div>

        {user && (
          <div className="card mt-4 p-4 text-xs text-surface-200/50">
            <p>Logged in as <span className="text-surface-50 font-medium">@{user.githubLogin}</span></p>
            <p className="mt-0.5">Session + GitHub token active ✓</p>
          </div>
        )}
      </main>
    </div>
  )
}
