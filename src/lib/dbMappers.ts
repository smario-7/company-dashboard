import type { Board, CardMeta, Column, Label, Project } from './types'

export interface ProjectRow {
  id: string
  slug: string
  name: string
  description: string
  color: string
  emoji: string
  archived: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface BoardRow {
  id: string
  project_id: string
  slug: string
  name: string
  description: string
  columns: Column[]
  card_order: Record<string, string[]>
  labels: Label[]
  archived: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface CardRow {
  id: string
  board_id: string
  title: string
  description: string
  label_ids: string[]
  assignees: string[]
  due_date: string | null
  priority: CardMeta['priority']
  checklist: CardMeta['checklist']
  archived: boolean
  created_by: string
  created_at: string
  updated_at: string
  last_due_reminder_at?: string | null
}

export function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    color: row.color,
    emoji: row.emoji,
    archived: row.archived,
    created_by: row.created_by,
    created_at: row.created_at,
  }
}

export function boardFromRow(row: BoardRow): Board {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    columns: row.columns ?? [],
    card_order: row.card_order ?? {},
    labels: row.labels ?? [],
    archived: row.archived,
    created_by: row.created_by,
    created_at: row.created_at,
  }
}

export function cardFromRow(row: CardRow): CardMeta {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    label_ids: row.label_ids ?? [],
    assignees: row.assignees ?? [],
    due_date: row.due_date,
    priority: row.priority,
    checklist: (row.checklist ?? []) as CardMeta['checklist'],
    archived: row.archived,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function cardToRow(card: CardMeta, boardId: string): Omit<CardRow, 'last_due_reminder_at'> {
  return {
    id: card.id,
    board_id: boardId,
    title: card.title,
    description: card.description,
    label_ids: card.label_ids,
    assignees: card.assignees,
    due_date: card.due_date,
    priority: card.priority,
    checklist: card.checklist,
    archived: card.archived,
    created_by: card.created_by,
    created_at: card.created_at,
    updated_at: card.updated_at,
  }
}
