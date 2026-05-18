/**
 * AuthContext.tsx
 *
 * Provides global auth state + singletons for storage and db.
 *
 * Two login paths:
 *  A) Returning user  — password only (decrypts stored token from localStorage)
 *  B) New user        — Device Flow first, then set password
 *
 * Token is kept in sessionStorage (cleared on tab close).
 * Encrypted token + password_hash live in both SQLite and localStorage
 * so returning users don't need a network call just to authenticate.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { GitHubStorage } from '../lib/GitHubStorage'
import { DatabaseManager } from '../lib/DatabaseManager'
import type { AppUser, DBUser } from '../lib/types'

const OWNER = import.meta.env.VITE_GITHUB_OWNER
const REPO  = import.meta.env.VITE_GITHUB_REPO

// ─── Local credential cache (survives page refresh, cleared on logout) ────────

interface LocalCredentials {
  githubLogin:            string
  displayName:            string
  avatarUrl:              string
  email:                  string
  role:                   'admin' | 'member'
  theme:                  'light' | 'dark' | 'system'
  passwordHash:           string
  githubTokenEncrypted:   string
}

const LKEY_CREDS   = 'cd_creds'
const LKEY_SESSION = 'cd_session'
const SKEY_TOKEN   = 'cd_token'     // sessionStorage — gone on tab close

// ─── Context shape ────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user:      AppUser | null
  storage:   GitHubStorage | null
  db:        DatabaseManager | null
  isLoading: boolean
  /**
   * Called after Device Flow + password set/verify.
   * Persists credentials locally and mounts the session.
   */
  login: (params: {
    githubToken: string
    dbUser:      DBUser
    email:       string
  }) => Promise<void>
  /** Called when password changes — re-encrypts and refreshes stored creds. */
  refreshCredentials: (dbUser: DBUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AppUser | null>(null)
  const [storage,   setStorage]   = useState<GitHubStorage | null>(null)
  const [db,        setDb]        = useState<DatabaseManager | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ─── Restore session on mount ─────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const token   = sessionStorage.getItem(SKEY_TOKEN)
        const session = localStorage.getItem(LKEY_SESSION)
        const credsRaw = localStorage.getItem(LKEY_CREDS)

        if (!token || !session || !credsRaw) return

        const { expiresAt } = JSON.parse(session) as { expiresAt: string }
        if (new Date(expiresAt) < new Date()) { purge(); return }

        const creds = JSON.parse(credsRaw) as LocalCredentials
        await mountSession(token, creds)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mount helpers ────────────────────────────────────────────────────────

  const mountSession = async (token: string, creds: LocalCredentials) => {
    const st = new GitHubStorage(token, OWNER, REPO, creds.githubLogin, creds.email)
    const manager = new DatabaseManager(st)
    await manager.init()

    setUser({
      id:          0,           // resolved from DB in login()
      githubLogin: creds.githubLogin,
      githubId:    0,
      displayName: creds.displayName,
      avatarUrl:   creds.avatarUrl,
      email:       creds.email,
      theme:       creds.theme,
      role:        creds.role,
    })
    setStorage(st)
    setDb(manager)
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  const login = useCallback(async ({
    githubToken,
    dbUser,
    email,
  }: {
    githubToken: string
    dbUser:      DBUser
    email:       string
  }) => {
    const creds: LocalCredentials = {
      githubLogin:          dbUser.github_login,
      displayName:          dbUser.display_name,
      avatarUrl:            dbUser.avatar_url,
      email,
      role:                 dbUser.role,
      theme:                dbUser.theme,
      passwordHash:         dbUser.password_hash,
      githubTokenEncrypted: dbUser.github_token_encrypted ?? '',
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    sessionStorage.setItem(SKEY_TOKEN, githubToken)
    localStorage.setItem(LKEY_SESSION, JSON.stringify({ expiresAt }))
    localStorage.setItem(LKEY_CREDS, JSON.stringify(creds))

    await mountSession(githubToken, creds)
  }, [])

  // ─── Refresh credentials (after password change) ──────────────────────────

  const refreshCredentials = useCallback((dbUser: DBUser) => {
    const credsRaw = localStorage.getItem(LKEY_CREDS)
    if (!credsRaw) return
    const existing = JSON.parse(credsRaw) as LocalCredentials
    const updated: LocalCredentials = {
      ...existing,
      passwordHash:         dbUser.password_hash,
      githubTokenEncrypted: dbUser.github_token_encrypted ?? '',
      role:                 dbUser.role,
      theme:                dbUser.theme,
      displayName:          dbUser.display_name,
    }
    localStorage.setItem(LKEY_CREDS, JSON.stringify(updated))
    setUser(prev => prev ? {
      ...prev,
      role:        dbUser.role,
      theme:       dbUser.theme,
      displayName: dbUser.display_name,
    } : prev)
  }, [])

  // ─── Logout ───────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    purge()
    setUser(null)
    setStorage(null)
    setDb(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, storage, db, isLoading, login, refreshCredentials, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

// ─── Public helper: get local credentials (for password-only login) ───────────

export function getLocalCredentials(): LocalCredentials | null {
  const raw = localStorage.getItem(LKEY_CREDS)
  return raw ? JSON.parse(raw) as LocalCredentials : null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function purge() {
  sessionStorage.removeItem(SKEY_TOKEN)
  localStorage.removeItem(LKEY_SESSION)
  localStorage.removeItem(LKEY_CREDS)
}
