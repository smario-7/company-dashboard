/**
 * LoginPage.tsx
 *
 * Jeden przycisk: "Sign in with GitHub"
 * Supabase obsługuje cały OAuth flow.
 * Kontrola dostępu odbywa się w AuthContext.mountSession().
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (user) navigate('/projects', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('denied') === 'true') {
      setError(
        'Access denied. Your GitHub account is not a collaborator of this workspace. ' +
        'Ask an admin to add you to the repository.'
      )
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('reauth') === 'true') {
      setError('Session expired. Please sign in with GitHub again.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          scopes:     'repo user:email',
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        },
      })
      if (authError) throw authError
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
      setLoading(false)
    }
  }

  return (
    <LoginForm
      error={error}
      loading={loading}
      onLogin={handleLogin}
    />
  )
}

function LoginForm({
  error, loading, onLogin,
}: {
  error: string
  loading: boolean
  onLogin: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-900 px-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(79,142,247,1) 1px,transparent 1px),' +
            'linear-gradient(90deg,rgba(79,142,247,1) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="mb-10 flex flex-col items-center gap-2 animate-fade-in">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/30">
          <GridIcon className="h-6 w-6 text-brand-400" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-surface-50">
          Company Dashboard
        </h1>
        <p className="text-xs text-surface-200/40">Project workspace · GitHub-backed</p>
      </div>

      <div className="glass w-full max-w-sm rounded-3xl p-6 shadow-modal animate-slide-up">
        {error && (
          <div className="mb-4 rounded-xl bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <p className="text-xs text-surface-200/50">
            Sign in with your GitHub account.
            Only repository collaborators can access this workspace.
          </p>

          <button
            onClick={onLogin}
            disabled={loading}
            className="btn-primary w-full py-2.5"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />
                Redirecting to GitHub…
              </span>
            ) : (
              <>
                <GitHubIcon className="h-4 w-4" />
                Continue with GitHub
              </>
            )}
          </button>
        </div>
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
