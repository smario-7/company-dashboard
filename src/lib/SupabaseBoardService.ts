import { supabase } from './supabase'
import type { Board, Column, Label } from './types'
import { boardFromRow, type BoardRow } from './dbMappers'
import { slugify, generateId } from './utils'

const DEFAULT_COLUMNS: Omit<Column, 'id'>[] = [
  { name: 'To Do',       color: '#64748b' },
  { name: 'In Progress', color: '#f59e0b' },
  { name: 'Done',        color: '#22c55e' },
]

export class SupabaseBoardService {
  private normalize(board: Board): Board {
    return {
      ...board,
      card_order: board.card_order ?? {},
      labels:     board.labels     ?? [],
    }
  }

  async getProjectId(projectSlug: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .eq('slug', projectSlug)
      .maybeSingle()
    if (error) throw error
    return data?.id ?? null
  }

  async listBoards(projectSlug: string, includeArchived = false): Promise<Board[]> {
    const projectId = await this.getProjectId(projectSlug)
    if (!projectId) return []

    let q = supabase
      .from('boards')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (!includeArchived) q = q.eq('archived', false)

    const { data, error } = await q
    if (error) throw error
    return (data as BoardRow[]).map(r => this.normalize(boardFromRow(r)))
  }

  async getBoard(projectSlug: string, boardSlug: string): Promise<Board | null> {
    const projectId = await this.getProjectId(projectSlug)
    if (!projectId) return null

    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('project_id', projectId)
      .eq('slug', boardSlug)
      .maybeSingle()
    if (error) throw error
    return data ? this.normalize(boardFromRow(data as BoardRow)) : null
  }

  async createBoard(
    projectSlug: string,
    params: Pick<Board, 'name' | 'description'>,
    createdBy: string,
  ): Promise<Board> {
    const projectId = await this.getProjectId(projectSlug)
    if (!projectId) throw new Error(`Project "${projectSlug}" not found`)

    const slug    = slugify(params.name)
    const columns = DEFAULT_COLUMNS.map(c => ({ ...c, id: generateId() }))
    const row: BoardRow = {
      id: generateId(),
      project_id: projectId,
      slug,
      name: params.name,
      description: params.description,
      columns,
      card_order: Object.fromEntries(columns.map(c => [c.id, []])),
      labels: [],
      archived: false,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('boards').insert(row)
    if (error) throw error
    return this.normalize(boardFromRow(row))
  }

  async updateBoard(
    projectSlug: string,
    boardSlug: string,
    updates: Partial<Pick<Board, 'name' | 'description'>>,
  ): Promise<void> {
    const projectId = await this.getProjectId(projectSlug)
    if (!projectId) throw new Error(`Project "${projectSlug}" not found`)

    const { error } = await supabase
      .from('boards')
      .update(updates)
      .eq('project_id', projectId)
      .eq('slug', boardSlug)
    if (error) throw error
  }

  async saveBoard(board: Board): Promise<void> {
    const { error } = await supabase
      .from('boards')
      .update({
        name:        board.name,
        description: board.description,
        columns:     board.columns,
        card_order:  board.card_order,
        labels:      board.labels,
        archived:    board.archived,
      })
      .eq('id', board.id)
    if (error) throw error
  }

  async setArchived(projectSlug: string, boardSlug: string, archived: boolean): Promise<void> {
    const projectId = await this.getProjectId(projectSlug)
    if (!projectId) throw new Error(`Project "${projectSlug}" not found`)

    const { error } = await supabase
      .from('boards')
      .update({ archived })
      .eq('project_id', projectId)
      .eq('slug', boardSlug)
    if (error) throw error
  }
}
