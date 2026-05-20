import { supabase, type UserProfile } from './supabase'

export class SettingsService {

  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return data
  }

  async getAllProfiles(): Promise<UserProfile[]> {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at')
    return data ?? []
  }

  async upsertProfile(
    profile: Partial<UserProfile> & { id: string }
  ): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .upsert(profile, { onConflict: 'id' })
    if (error) throw error
  }

  async updateProfile(
    userId: string,
    patch: Partial<Pick<UserProfile, 'display_name' | 'theme' | 'role'>>
  ): Promise<void> {
    if ('role' in patch) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const caller = await this.getProfile(session.user.id)
      if (caller?.role !== 'admin') {
        throw new Error('Only admins can change user roles')
      }
    }

    const { error } = await supabase
      .from('user_profiles')
      .update(patch)
      .eq('id', userId)

    if (error) throw error
  }

  async deleteProfile(userId: string): Promise<void> {
    await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId)
  }

  async isFirstUser(): Promise<boolean> {
    const { count, error } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
    if (error) throw new Error(error.message)
    return count === 0
  }

  async getConfig(key: string): Promise<unknown> {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', key)
      .single()
    return data?.value
  }

  async setConfig(key: string, value: unknown): Promise<void> {
    await supabase
      .from('app_config')
      .upsert({ key, value })
  }

  async getNotificationPrefs(userId: string) {
    const { data, error } = await supabase
      .from('notification_prefs')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data
  }

  async upsertNotificationPrefs(
    userId: string,
    prefs: {
      on_card_assign?: boolean
      on_comment?: boolean
      on_due_date?: boolean
      on_card_move?: boolean
      on_mention?: boolean
    },
  ): Promise<void> {
    const { error } = await supabase
      .from('notification_prefs')
      .upsert({ user_id: userId, ...prefs })
    if (error) throw error
  }
}
