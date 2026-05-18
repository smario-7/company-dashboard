/**
 * Layout.tsx
 *
 * Shell around all protected pages.
 * Desktop: collapsible left sidebar
 * Mobile:  fixed bottom navigation bar
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface NavItem {
  to:       string
  label:    string
  icon:     (active: boolean) => React.ReactNode
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    to:    '/projects',
    label: 'Projects',
    icon:  (a) => (
      <svg className={`h-5 w-5 ${a ? 'text-brand-400' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    to:    '/profile',
    label: 'Profile',
    icon:  (a) => (
      <svg className={`h-5 w-5 ${a ? 'text-brand-400' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
  {
    to:       '/admin',
    label:    'Admin',
    adminOnly: true,
    icon:     (a) => (
      <svg className={`h-5 w-5 ${a ? 'text-brand-400' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
      </svg>
    ),
  },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const visibleItems = NAV_ITEMS.filter(
    item => !item.adminOnly || user?.role === 'admin',
  )

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-150 ${
      isActive
        ? 'bg-brand-500/10 text-brand-400 font-medium'
        : 'text-surface-200/50 hover:bg-white/5 hover:text-surface-50'
    }`

  return (
    <div className="flex h-screen overflow-hidden bg-surface-900">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col border-r border-white/5 bg-surface-900 py-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 pb-6">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/15 ring-1 ring-brand-400/30">
            <svg className="h-4 w-4 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
          </div>
          <span className="font-display text-sm font-semibold text-surface-50">Dashboard</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {visibleItems.map(item => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {({ isActive }) => (
                <>
                  {item.icon(isActive)}
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="mt-auto border-t border-white/5 px-2 pt-4">
          <button
            onClick={() => navigate('/profile')}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm
                       text-surface-200/60 hover:bg-white/5 hover:text-surface-50 transition-all"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full ring-1 ring-white/10" />
            ) : (
              <div className="h-6 w-6 rounded-full bg-surface-800 ring-1 ring-white/10" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-surface-50">{user?.displayName}</p>
              <p className="truncate text-xs text-surface-200/40">@{user?.githubLogin}</p>
            </div>
          </button>
          <button
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs
                       text-surface-200/40 hover:bg-white/5 hover:text-surface-200/70 transition-all"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-y-auto pb-16 md:pb-0">
        {/* Mobile topbar */}
        <header className="flex h-12 items-center justify-between border-b border-white/5 px-4 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/15 ring-1 ring-brand-400/30">
              <svg className="h-3.5 w-3.5 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
            </div>
            <span className="font-display text-sm font-semibold text-surface-50">Dashboard</span>
          </div>
          {user?.avatarUrl && (
            <button onClick={() => navigate('/profile')}>
              <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full ring-1 ring-white/10" />
            </button>
          )}
        </header>

        <Outlet />
      </main>

      {/* ── Mobile bottom nav ────────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 flex h-16 items-center
                      border-t border-white/5 bg-surface-900/95 backdrop-blur-sm
                      md:hidden z-50">
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-all ${
                isActive ? 'text-brand-400' : 'text-surface-200/40'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {item.icon(isActive)}
                <span className="text-[10px]">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
