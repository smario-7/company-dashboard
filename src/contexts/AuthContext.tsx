/**
 * AuthContext.tsx
 *
 * Auth oparty na Supabase + GitHub OAuth.
 * Kontrola dostępu: sprawdzenie czy user jest collaboratorem repo GitHub.
 * provider_token z sesji Supabase = GitHub token dla GitHubStorage.
 */

import {
  createContext, useContext, useState,
  useEffect, useCallback, type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type UserProfile } from '../lib/supabase'
import { SettingsService } from '../lib/SettingsService'
import { GitHubStorage } from '../lib/GitHubStorage'
import { useRepoAccessGuard } from '../hooks/useRepoAccessGuard'

const OWNER = import.meta.env.VITE_GITHUB_OWNER
const REPO  = import.meta.env.VITE_GITHUB_REPO

const settingsSvc = new SettingsService()

export interface AuthContextValue {
  user:      UserProfile | null
  storage:   GitHubStorage | null
  settings:  SettingsService
  session:   Session | null
  isLoading: boolean
  logout:    () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<UserProfile | null>(null)
  const [storage,   setStorage]   = useState<GitHubStorage | null>(null)
  const [session,   setSession]   = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useRepoAccessGuard(session)

  const mountSession = useCallback(async (s: Session) => {
    const githubLogin = (s.user.user_metadata?.user_name as string) ?? ''
    const githubEmail = s.user.email ?? ''
    const avatarUrl   = (s.user.user_metadata?.avatar_url as string) ?? ''
    const displayName = (s.user.user_metadata?.full_name as string) ?? githubLogin
    const token       = s.provider_token ?? ''

    if (!token) {
      await supabase.auth.signOut()
      window.location.href = `${import.meta.env.BASE_URL}login?reauth=true`
      return
    }

    const repoCheck = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!repoCheck.ok) {
      await supabase.auth.signOut()
      window.location.href = `${import.meta.env.BASE_URL}login?denied=true`
      return
    }

    const isFirst = await settingsSvc.isFirstUser()

    const profilePatch: Partial<UserProfile> & { id: string } = {
      id:           s.user.id,
      github_login: githubLogin,
      display_name: displayName,
      avatar_url:   avatarUrl,
    }
    if (isFirst) profilePatch.role = 'admin'

    await settingsSvc.upsertProfile(profilePatch)

    const profile = await settingsSvc.getProfile(s.user.id)
    if (!profile) return

    const st = new GitHubStorage(token, OWNER, REPO, githubLogin, githubEmail)

    setSession(s)
    setUser(profile)
    setStorage(st)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        void mountSession(s).finally(() => setIsLoading(false))
      } else {
        setIsLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        if (s) {
          if (event === 'INITIAL_SESSION') return
          void mountSession(s)
        } else {
          setSession(null)
          setUser(null)
          setStorage(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [mountSession])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{
      user, storage, settings: settingsSvc,
      session, isLoading, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
