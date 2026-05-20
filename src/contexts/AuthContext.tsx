/**
 * AuthContext.tsx
 *
 * Auth oparty na Supabase + GitHub OAuth.
 * Kontrola dostępu: sprawdzenie czy user jest collaboratorem repo GitHub.
 * provider_token z sesji Supabase = GitHub token dla GitHubStorage.
 */

import {
  createContext, useContext, useState,
  useEffect, useCallback, useRef, type ReactNode,
} from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase, type UserProfile } from '../lib/supabase'
import { SettingsService } from '../lib/SettingsService'
import { GitHubStorage } from '../lib/GitHubStorage'
import { SupabaseProjectService } from '../lib/SupabaseProjectService'
import { SupabaseBoardService } from '../lib/SupabaseBoardService'
import { SupabaseCardService } from '../lib/SupabaseCardService'
import { ActivityService } from '../lib/ActivityService'
import { CommentService } from '../lib/CommentService'
import { NotificationService } from '../lib/NotificationService'
import { DueDateReminderService } from '../lib/DueDateReminderService'
import { useRepoAccessGuard } from '../hooks/useRepoAccessGuard'

const OWNER = import.meta.env.VITE_GITHUB_OWNER
const REPO  = import.meta.env.VITE_GITHUB_REPO
const GH_TOKEN_KEY = 'company-dashboard:github_provider_token'

const settingsSvc = new SettingsService()
const projectsSvc      = new SupabaseProjectService()
const boardsSvc        = new SupabaseBoardService()
const cardsSvc         = new SupabaseCardService()
const activitySvc      = new ActivityService()
const commentsSvc      = new CommentService()
const notificationsSvc = new NotificationService()
const dueRemindersSvc  = new DueDateReminderService(cardsSvc, notificationsSvc)

export interface AuthContextValue {
  user:          UserProfile | null
  storage:       GitHubStorage | null
  settings:      SettingsService
  projects:      SupabaseProjectService
  boards:        SupabaseBoardService
  cards:         SupabaseCardService
  activity:      ActivityService
  comments:      CommentService
  notifications: NotificationService
  dueReminders:  DueDateReminderService
  session:       Session | null
  isLoading:     boolean
  authError:     string | null
  logout:        () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function githubLoginFromSession(s: Session): string {
  const meta = s.user.user_metadata
  return (
    (meta?.user_name as string) ??
    (meta?.preferred_username as string) ??
    (meta?.login as string) ??
    ''
  )
}

function resolveProviderToken(s: Session): string {
  if (s.provider_token) {
    sessionStorage.setItem(GH_TOKEN_KEY, s.provider_token)
    return s.provider_token
  }
  return sessionStorage.getItem(GH_TOKEN_KEY) ?? ''
}

function clearStoredProviderToken(): void {
  sessionStorage.removeItem(GH_TOKEN_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<UserProfile | null>(null)
  const [storage,   setStorage]   = useState<GitHubStorage | null>(null)
  const [session,   setSession]   = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const mountingRef = useRef(false)

  useRepoAccessGuard(session)

  const mountSession = useCallback(async (
    s: Session,
    event: AuthChangeEvent,
  ): Promise<boolean> => {
    const githubLogin = githubLoginFromSession(s)
    const githubEmail = s.user.email ?? ''
    const avatarUrl   = (s.user.user_metadata?.avatar_url as string) ?? ''
    const displayName =
      (s.user.user_metadata?.full_name as string) ??
      (s.user.user_metadata?.name as string) ??
      githubLogin

    let token = resolveProviderToken(s)

    if (!token && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
      const { data } = await supabase.auth.refreshSession()
      if (data.session?.provider_token) {
        token = resolveProviderToken(data.session)
        s = data.session
      }
    }

    if (!token) {
      if (event === 'SIGNED_IN') {
        await supabase.auth.signOut()
        clearStoredProviderToken()
        window.location.href = `${import.meta.env.BASE_URL}login?reauth=true`
      }
      return false
    }

    if (!githubLogin) {
      setAuthError('Could not read your GitHub username from the login session.')
      return false
    }

    const repoCheck = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!repoCheck.ok) {
      await supabase.auth.signOut()
      clearStoredProviderToken()
      window.location.href = `${import.meta.env.BASE_URL}login?denied=true`
      return false
    }

    try {
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
      if (!profile) {
        setAuthError(
          'Profile could not be loaded. Check Supabase RLS policies for user_profiles.',
        )
        return false
      }

      const st = new GitHubStorage(token, OWNER, REPO, githubLogin, githubEmail)

      setSession(s)
      setUser(profile)
      setStorage(st)
      setAuthError(null)
      return true
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save user profile'
      setAuthError(msg)
      return false
    }
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        if (event === 'SIGNED_OUT') {
          setSession(null)
          setUser(null)
          setStorage(null)
          setAuthError(null)
          clearStoredProviderToken()
          setIsLoading(false)
          return
        }

        if (!s) {
          if (event === 'INITIAL_SESSION') setIsLoading(false)
          return
        }

        if (mountingRef.current) return
        mountingRef.current = true

        void mountSession(s, event)
          .finally(() => {
            mountingRef.current = false
            setIsLoading(false)
          })
      },
    )

    return () => subscription.unsubscribe()
  }, [mountSession])

  const logout = useCallback(async () => {
    clearStoredProviderToken()
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{
      user, storage, settings: settingsSvc,
      projects: projectsSvc,
      boards: boardsSvc,
      cards: cardsSvc,
      activity: activitySvc,
      comments: commentsSvc,
      notifications: notificationsSvc,
      dueReminders: dueRemindersSvc,
      session, isLoading, authError, logout,
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
