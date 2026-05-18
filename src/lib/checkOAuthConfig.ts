/**
 * Sprawdza czy Supabase ma poprawny GitHub client_id (nie nazwę aplikacji).
 */
export async function isGitHubOAuthMisconfigured(): Promise<boolean> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return false

  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
  const url =
    `${supabaseUrl}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(redirectTo)}`

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(8_000),
    })
    const location = res.headers.get('location')
    if (!location) return false

    const clientId = new URL(location).searchParams.get('client_id') ?? ''
    return (
      !clientId ||
      clientId.includes(' ') ||
      /company/i.test(clientId) ||
      /dashboard/i.test(clientId)
    )
  } catch {
    return false
  }
}

export const OAUTH_MISCONFIG_MESSAGE =
  'GitHub login is misconfigured: Supabase has the app name instead of the GitHub OAuth Client ID. ' +
  'An admin must fix Authentication → Providers → GitHub in the Supabase dashboard (see npm run oauth:setup).'
