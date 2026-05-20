import { supabase } from './supabase'
import type { CardMeta } from './types'
import { cardFromRow, cardToRow, type CardRow } from './dbMappers'
import { generateId } from './utils'

export interface CardEntry {
  data: CardMeta
}

export class SupabaseCardService {
  async loadCards(boardId: string, cardIds: string[]): Promise<Record<string, CardEntry>> {
    if (cardIds.length === 0) return {}

    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('board_id', boardId)
      .in('id', cardIds)
    if (error) throw error

    const map: Record<string, CardEntry> = {}
    for (const row of (data ?? []) as CardRow[]) {
      map[row.id] = { data: cardFromRow(row) }
    }
    return map
  }

  async createCard(
    boardId: string,
    title: string,
    createdBy: string,
  ): Promise<CardMeta> {
    const now  = new Date().toISOString()
    const meta: CardMeta = {
      id: generateId(),
      title,
      description: '',
      label_ids:   [],
      assignees:   [],
      due_date:    null,
      priority:    'none',
      checklist:   [],
      archived:    false,
      created_by:  createdBy,
      created_at:  now,
      updated_at:  now,
    }

    const { error } = await supabase.from('cards').insert(cardToRow(meta, boardId))
    if (error) throw error
    return meta
  }

  async updateCard(
    boardId: string,
    cardId: string,
    updates: Partial<Omit<CardMeta, 'id' | 'created_by' | 'created_at'>>,
  ): Promise<CardMeta> {
    const { data: existing, error: fetchErr } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .eq('board_id', boardId)
      .maybeSingle()
    if (fetchErr) throw fetchErr
    if (!existing) throw new Error(`Card "${cardId}" not found`)

    const updated: CardMeta = {
      ...cardFromRow(existing as CardRow),
      ...updates,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('cards')
      .update({
        title:       updated.title,
        description: updated.description,
        label_ids:   updated.label_ids,
        assignees:   updated.assignees,
        due_date:    updated.due_date,
        priority:    updated.priority,
        checklist:   updated.checklist,
        archived:    updated.archived,
        updated_at:  updated.updated_at,
      })
      .eq('id', cardId)
    if (error) throw error
    return updated
  }

  async setArchived(boardId: string, cardId: string, archived: boolean): Promise<CardMeta> {
    return this.updateCard(boardId, cardId, { archived })
  }

  async getCardsDueSoon(boardId: string, withinDays: number): Promise<CardMeta[]> {
    const today = new Date()
    const end = new Date(today)
    end.setDate(end.getDate() + withinDays)
    const todayStr = today.toISOString().slice(0, 10)
    const endStr   = end.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('board_id', boardId)
      .eq('archived', false)
      .not('due_date', 'is', null)
      .gte('due_date', todayStr)
      .lte('due_date', endStr)
    if (error) throw error
    return (data as CardRow[]).map(cardFromRow)
  }

  async markDueReminderSent(cardId: string): Promise<void> {
    const todayStr = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('cards')
      .update({ last_due_reminder_at: todayStr })
      .eq('id', cardId)
    if (error) throw error
  }

  async needsDueReminder(card: CardMeta): Promise<boolean> {
    if (!card.due_date || card.archived) return false
    const { data, error } = await supabase
      .from('cards')
      .select('last_due_reminder_at')
      .eq('id', card.id)
      .maybeSingle()
    if (error) throw error
    const todayStr = new Date().toISOString().slice(0, 10)
    return (data as { last_due_reminder_at: string | null } | null)?.last_due_reminder_at !== todayStr
  }
}
