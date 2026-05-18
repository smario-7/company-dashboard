#!/usr/bin/env node
/**
 * Wypisuje URL-e do skonfigurowania GitHub OAuth + Supabase (kroki z planu naprawy 404).
 */

import { loadEnv } from './load-env.mjs'

const { env } = loadEnv()
const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
if (!supabaseUrl) {
  console.error('Ustaw VITE_SUPABASE_URL w .env.local')
  process.exit(1)
}

const callbackUrl = `${supabaseUrl}/auth/v1/callback`
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '_'
const supabaseProvidersUrl =
  `https://supabase.com/dashboard/project/${projectRef}/auth/providers`
const supabaseUrlConfigUrl =
  `https://supabase.com/dashboard/project/${projectRef}/auth/url-configuration`
const redirects = [
  'http://localhost:5173/company-dashboard/',
  'http://localhost:5173/company-dashboard/login',
  'https://smario-7.github.io/company-dashboard/',
  'https://smario-7.github.io/company-dashboard/login',
]

console.log(`
=== GitHub OAuth App ===
https://github.com/settings/developers

1. Otwórz OAuth App (lub New OAuth App)
2. Homepage URL: https://smario-7.github.io/company-dashboard/
3. Authorization callback URL (wklej dokładnie):

   ${callbackUrl}

4. Skopiuj Client ID (alfanumeryczny, np. Ov23li...) i Client Secret

=== Supabase → Authentication → Providers → GitHub ===
${supabaseProvidersUrl}

5. Enable GitHub
6. Client ID  → wartość z GitHub (NIE "Company Dashboard")
7. Client Secret → z GitHub
8. Save

=== Supabase → Authentication → URL Configuration ===
${supabaseUrlConfigUrl}

9. Site URL (dev): ${redirects[0]}

10. Redirect URLs — dodaj oba:
   - ${redirects[0]}
   - ${redirects[1]}

=== Weryfikacja ===
   npm run oauth:verify
`)
