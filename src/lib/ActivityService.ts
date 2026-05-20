import { supabase } from './supabase'
import type { UserProfile } from './supabase'

export interface ActivityEntry {
  id: string
  board_id: string
  card_id: string | null
  actor_id: string
  action: string
  payload: Record<string, unknown>
  created_at: string
  actor?: Pick<UserProfile, 'display_name' | 'avatar_url' | 'github_login'>
}

export class ActivityService {
  async log(
    boardId: string,
    cardId: string | null,
    actorId: string,
    action: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await supabase.from('activity_log').insert({
      board_id: boardId,
      card_id:  cardId,
      actor_id: actorId,
      action,
      payload,
    })
    if (error) throw error
  }

  async listForCard(cardId: string, limit = 30): Promise<ActivityEntry[]> {
    const { data, error } = await supabase
      .from('activity_log')
      .select('id, board_id, card_id, actor_id, action, payload, created_at')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error

    const entries = (data ?? []) as ActivityEntry[]
    if (entries.length === 0) return []

    const actorIds = [...new Set(entries.map(e => e.actor_id))]
    const { data: profiles, error: pErr } = await supabase
      .from('user_profiles')
      .select('id, display_name, avatar_url, github_login')
      .in('id', actorIds)
    if (pErr) throw pErr

    const byId = new Map((profiles ?? []).map(p => [p.id, p]))
    return entries.map(e => ({
      ...e,
      actor: byId.get(e.actor_id) ?? undefined,
    }))
  }
}
