import { supabase } from './supabase'
import type { Notification, NotificationType } from './types'
import type { UserProfile } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface NotificationRow {
  id: string
  user_id: string
  type: NotificationType
  read: boolean
  actor_id: string | null
  payload: Notification['payload']
  created_at: string
  actor?: Pick<UserProfile, 'display_name' | 'avatar_url' | 'github_login'> | null
}

export interface NotificationPrefs {
  user_id: string
  on_card_assign: boolean
  on_comment: boolean
  on_due_date: boolean
  on_card_move: boolean
  on_mention: boolean
}

export class NotificationService {
  async list(options: { limit?: number; unreadOnly?: boolean } = {}): Promise<NotificationRow[]> {
    const { limit = 50, unreadOnly = false } = options
    let q = supabase
      .from('notifications')
      .select('id, user_id, type, read, actor_id, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) q = q.eq('read', false)

    const { data, error } = await q
    if (error) throw error
    return this.attachActors((data ?? []) as NotificationRow[])
  }

  private async attachActors(rows: NotificationRow[]): Promise<NotificationRow[]> {
    const actorIds = [...new Set(rows.map(r => r.actor_id).filter(Boolean))] as string[]
    if (actorIds.length === 0) return rows

    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar_url, github_login')
      .in('id', actorIds)
    if (error) throw error

    const byId = new Map((profiles ?? []).map(p => [p.id, p]))
    return rows.map(r => ({
      ...r,
      actor: r.actor_id ? byId.get(r.actor_id) ?? null : null,
    }))
  }

  async countUnread(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)
    if (error) throw error
    return count ?? 0
  }

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
    if (error) throw error
  }

  async markAllRead(): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false)
    if (error) throw error
  }

  async create(
    recipientId: string,
    type: NotificationType,
    actorId: string | null,
    payload: Notification['payload'],
  ): Promise<string | null> {
    const { data, error } = await supabase.rpc('create_notification', {
      p_recipient_id: recipientId,
      p_type:         type,
      p_actor_id:     actorId,
      p_payload:      payload,
    })
    if (error) throw error
    return data as string | null
  }

  subscribe(
    userId: string,
    onChange: () => void,
  ): RealtimeChannel {
    // Unique topic per subscription — avoids reusing a channel already in `subscribed` state (React Strict Mode).
    const channel = supabase.channel(`notifications:${userId}:${crypto.randomUUID()}`)
    channel
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => onChange(),
      )
      .subscribe()
    return channel
  }

  unsubscribe(channel: RealtimeChannel): void {
    void supabase.removeChannel(channel)
  }
}
