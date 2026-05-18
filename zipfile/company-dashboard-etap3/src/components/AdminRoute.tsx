import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function AdminRoute() {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/projects" replace />
  return <Outlet />
}
