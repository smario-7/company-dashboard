/**
 * AuthContext.tsx
 *
 * Provides:
 *   - user        — currently logged-in AppUser (or null)
 *   - storage     — GitHubStorage singleton
 *   - db          — DatabaseManager singleton
 *   - isLoading   — true while restoring session on mount
 *   - login()     — called after GitHub Device Flow + password are confirmed
 *   - logout()    — clears session
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
import { decrypt } from '../lib/crypto'
import type { AppUser, DBUser } from '../lib/types'

const OWNER = import.meta.env.VITE_GITHUB_OWNER as string
const REPO  = import.meta.env.VITE_GITHUB_REPO  as string

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  user:      AppUser | null
  storage:   GitHubStorage | null
  db:        DatabaseManager | null
  isLoading: boolean
  /** Call this after Device Flow + password verification */
  login: (params: {
    githubToken: string
    password: string
    dbUser: DBUser
    email: string
  }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_SESSION  = 'cd_session'
const KEY_USER     = 'cd_user'
const SKEY_TOKEN   = 'cd_token'          // sessionStorage — cleared on tab close

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<AppUser | null>(null)
  const [storage,   setStorage]   = useState<GitHubStorage | null>(null)
  const [db,        setDb]        = useState<DatabaseManager | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ─── Restore session on mount ───────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const token   = sessionStorage.getItem(SKEY_TOKEN)
        const session = localStorage.getItem(KEY_SESSION)
        const userStr = localStorage.getItem(KEY_USER)

        if (!token || !session || !userStr) return

        // Check session expiry
        const { expiresAt } = JSON.parse(session) as { expiresAt: string }
        if (new Date(expiresAt) < new Date()) {
          clearLocalStorage()
          return
        }

        const savedUser = JSON.parse(userStr) as AppUser
        await mountSession(token, savedUser)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mount helpers ──────────────────────────────────────────────────────────

  const mountSession = async (token: string, appUser: AppUser) => {
    const st = new GitHubStorage(token, OWNER, REPO, appUser.githubLogin, appUser.email)
    const manager = new DatabaseManager(st)
    await manager.init()
    setUser(appUser)
    setStorage(st)
    setDb(manager)
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  const login = useCallback(async ({
    githubToken,
    password,
    dbUser,
    email,
  }: {
    githubToken: string
    password: string
    dbUser: DBUser
    email: string
  }) => {
    // Decrypt the stored GitHub token using the user's password
    // (githubToken here is already the plaintext token from Device Flow or decryption)
    const appUser: AppUser = {
      id:          dbUser.id,
      githubLogin: dbUser.github_login,
      githubId:    dbUser.github_id,
      displayName: dbUser.display_name,
      avatarUrl:   dbUser.avatar_url,
      email,
      theme:       dbUser.theme,
    }

    // Persist session (7 days)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    sessionStorage.setItem(SKEY_TOKEN, githubToken)
    localStorage.setItem(KEY_SESSION, JSON.stringify({ expiresAt }))
    localStorage.setItem(KEY_USER, JSON.stringify(appUser))

    await mountSession(githubToken, appUser)
  }, [])

  // ─── Logout ─────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    clearLocalStorage()
    setUser(null)
    setStorage(null)
    setDb(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, storage, db, isLoading, login, logout }}>
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clearLocalStorage() {
  sessionStorage.removeItem(SKEY_TOKEN)
  localStorage.removeItem(KEY_SESSION)
  localStorage.removeItem(KEY_USER)
}
