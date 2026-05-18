/**
 * Okresowo weryfikuje czy zalogowany użytkownik nadal ma dostęp do repo GitHub.
 * Przy utracie dostępu — wylogowanie i przekierowanie na /login?denied=true
 */

import { useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const OWNER          = import.meta.env.VITE_GITHUB_OWNER
const REPO           = import.meta.env.VITE_GITHUB_REPO
const CHECK_INTERVAL = 30 * 60 * 1000
const GH_TOKEN_KEY   = 'company-dashboard:github_provider_token'

async function checkRepoAccess(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    )
    return res.ok
  } catch {
    return true
  }
}

async function revokeSession(): Promise<void> {
  await supabase.auth.signOut()
  const base = import.meta.env.BASE_URL
  window.location.href = `${base}login?denied=true`
}

export function useRepoAccessGuard(session: Session | null): void {
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCheckRef = useRef<number>(0)

  useEffect(() => {
    const token = session?.provider_token ?? sessionStorage.getItem(GH_TOKEN_KEY)
    if (!token) return

    const runCheck = async () => {
      const now = Date.now()
      if (now - lastCheckRef.current < 60_000) return
      lastCheckRef.current = now

      const hasAccess = await checkRepoAccess(token)
      if (!hasAccess) {
        await revokeSession()
      }
    }

    void runCheck()

    intervalRef.current = setInterval(() => void runCheck(), CHECK_INTERVAL)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runCheck()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [session?.provider_token])
}
