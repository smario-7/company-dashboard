#!/usr/bin/env node
/**
 * Sprawdza czy Supabase zwraca poprawny GitHub client_id w URL authorize.
 */

import { loadEnv } from './load-env.mjs'

const { env } = loadEnv()
const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const anonKey = env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !anonKey) {
  console.error('Ustaw VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY w .env.local')
  process.exit(1)
}

const redirectTo = 'http://localhost:5173/company-dashboard/'
const authorizeUrl =
  `${supabaseUrl}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(redirectTo)}`

const res = await fetch(authorizeUrl, {
  method: 'GET',
  redirect: 'manual',
  headers: { apikey: anonKey },
})

const location = res.headers.get('location')
if (!location) {
  console.error('Brak przekierowania z Supabase (status', res.status + ')')
  process.exit(1)
}

const ghUrl = new URL(location)
const clientId = ghUrl.searchParams.get('client_id') ?? ''

const invalid =
  !clientId ||
  clientId.includes(' ') ||
  /company/i.test(clientId) ||
  /dashboard/i.test(clientId)

if (invalid) {
  console.error(`
OAuth NIE jest poprawnie skonfigurowany.

  client_id w URL: "${clientId}"
  (GitHub zwróci 404 dla takiego ID)

Napraw w Supabase → Authentication → Providers → GitHub:
  wpisz Client ID z GitHub OAuth App (np. Ov23li...), nie nazwę aplikacji.

Instrukcja krok po kroku:
  npm run oauth:setup
`)
  process.exit(1)
}

console.log('OK — Supabase używa poprawnego GitHub client_id:', clientId)
console.log('Przykładowy URL authorize:', location.slice(0, 120) + '…')
process.exit(0)
