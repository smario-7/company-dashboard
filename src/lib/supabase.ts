import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      flowType: 'pkce',
    },
  },
)

export interface UserProfile {
  id:           string
  github_login: string
  display_name: string
  avatar_url:   string
  theme:        'light' | 'dark' | 'system'
  role:         'admin' | 'member'
  created_at:   string
  updated_at:   string
}
