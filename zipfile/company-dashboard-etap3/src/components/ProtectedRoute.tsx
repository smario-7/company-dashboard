import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** Spinner shown while the session is being restored */
function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-900">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-800 border-t-brand-400" />
        <p className="font-mono text-xs text-surface-200/40">loading…</p>
      </div>
    </div>
  )
}

export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <LoadingScreen />
  if (!user)     return <Navigate to="/login" replace />
  return <Outlet />
}
