import { useAuth } from '../contexts/AuthContext'

export function ProjectsPage() {
  const { user } = useAuth()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 animate-fade-in">
      <div className="text-center">
        <p className="font-mono text-xs text-accent-green">✓ etap 1 + 2 complete</p>
        <h2 className="mt-2 font-display text-xl font-bold text-surface-50">Projects</h2>
        <p className="mt-1 text-xs text-surface-200/40">Coming in Etap 3</p>
      </div>

      {user && (
        <div className="card mt-4 p-4 text-xs text-surface-200/50 space-y-1">
          <p>Logged in as <span className="text-surface-50 font-medium">@{user.githubLogin}</span></p>
          <p>Role: <span className={user.role === 'admin' ? 'text-brand-400' : 'text-surface-200'}>{user.role}</span></p>
          <p>Session + GitHub token active ✓</p>
        </div>
      )}
    </div>
  )
}

