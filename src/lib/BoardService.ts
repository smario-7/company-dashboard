import type { GitHubStorage } from './GitHubStorage'
import type { Board, Column, Label } from './types'
import { slugify, generateId } from './utils'

const DEFAULT_COLUMNS: Omit<Column, 'id'>[] = [
  { name: 'To Do',       color: '#64748b' },
  { name: 'In Progress', color: '#f59e0b' },
  { name: 'Done',        color: '#22c55e' },
]

export class BoardService {
  constructor(private storage: GitHubStorage) {}

  private path(projectSlug: string, boardSlug: string): string {
    return `projects/${projectSlug}/boards/${boardSlug}/board.json`
  }

  /** Ensure legacy boards without card_order/labels still work. */
  private normalize(board: Board): Board {
    return {
      ...board,
      card_order: board.card_order ?? {},
      labels:     board.labels     ?? [],
    }
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  async listBoards(projectSlug: string, includeArchived = false): Promise<Board[]> {
    const dirs = await this.storage.listFiles(`projects/${projectSlug}/boards`)
    const results = await Promise.allSettled(
      dirs
        .filter(d => d.type === 'dir' && !d.name.startsWith('.'))
        .map(d =>
          this.storage.readJSON<Board>(
            `projects/${projectSlug}/boards/${d.name}/board.json`,
          ),
        ),
    )
    return results
      .filter((r): r is PromiseFulfilledResult<{ data: Board; sha: string } | null> =>
        r.status === 'fulfilled' && r.value !== null,
      )
      .map(r => this.normalize(r.value!.data))
      .filter(b => includeArchived || !b.archived)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  // ─── Get ───────────────────────────────────────────────────────────────────

  async getBoard(
    projectSlug: string,
    boardSlug: string,
  ): Promise<{ data: Board; sha: string } | null> {
    const result = await this.storage.readJSON<Board>(this.path(projectSlug, boardSlug))
    if (!result) return null
    return { data: this.normalize(result.data), sha: result.sha }
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async createBoard(
    projectSlug: string,
    params: Pick<Board, 'name' | 'description'>,
    createdBy: string,
  ): Promise<Board> {
    const slug    = slugify(params.name)
    const columns = DEFAULT_COLUMNS.map(c => ({ ...c, id: generateId() }))
    const board: Board = {
      ...params,
      id:         generateId(),
      slug,
      columns,
      card_order: Object.fromEntries(columns.map(c => [c.id, []])),
      labels:     [],
      created_by: createdBy,
      created_at: new Date().toISOString(),
      archived:   false,
    }
    await this.storage.writeJSON(
      this.path(projectSlug, slug),
      board,
      undefined,
      `feat: create board "${params.name}"`,
    )
    return board
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async updateBoard(
    projectSlug: string,
    boardSlug: string,
    updates: Partial<Pick<Board, 'name' | 'description'>>,
  ): Promise<void> {
    const existing = await this.getBoard(projectSlug, boardSlug)
    if (!existing) throw new Error(`Board "${boardSlug}" not found`)
    await this.storage.writeJSON(
      this.path(projectSlug, boardSlug),
      { ...existing.data, ...updates },
      existing.sha,
      `feat: update board "${boardSlug}"`,
    )
  }

  // ─── Save columns ──────────────────────────────────────────────────────────

  async saveColumns(
    projectSlug: string,
    boardSlug: string,
    columns: Column[],
    sha: string,
  ): Promise<{ sha: string }> {
    const existing = await this.getBoard(projectSlug, boardSlug)
    if (!existing) throw new Error(`Board "${boardSlug}" not found`)
    return this.storage.writeJSON(
      this.path(projectSlug, boardSlug),
      { ...existing.data, columns },
      sha,
      `feat: update columns on board "${boardSlug}"`,
    )
  }

  // ─── Save card order (after drag & drop) ──────────────────────────────────

  async saveCardOrder(
    projectSlug: string,
    boardSlug: string,
    cardOrder: Record<string, string[]>,
    sha: string,
  ): Promise<{ sha: string }> {
    const existing = await this.getBoard(projectSlug, boardSlug)
    if (!existing) throw new Error(`Board "${boardSlug}" not found`)
    return this.storage.writeJSON(
      this.path(projectSlug, boardSlug),
      { ...existing.data, card_order: cardOrder },
      sha,
      `feat: reorder cards on board "${boardSlug}"`,
    )
  }

  // ─── Save labels ───────────────────────────────────────────────────────────

  async saveLabels(
    projectSlug: string,
    boardSlug: string,
    labels: Label[],
    sha: string,
  ): Promise<{ sha: string }> {
    const existing = await this.getBoard(projectSlug, boardSlug)
    if (!existing) throw new Error(`Board "${boardSlug}" not found`)
    return this.storage.writeJSON(
      this.path(projectSlug, boardSlug),
      { ...existing.data, labels },
      sha,
      `feat: update labels on board "${boardSlug}"`,
    )
  }

  // ─── Archive / Restore ─────────────────────────────────────────────────────

  async setArchived(
    projectSlug: string,
    boardSlug: string,
    archived: boolean,
  ): Promise<void> {
    const existing = await this.getBoard(projectSlug, boardSlug)
    if (!existing) throw new Error(`Board "${boardSlug}" not found`)
    await this.storage.writeJSON(
      this.path(projectSlug, boardSlug),
      { ...existing.data, archived },
      existing.sha,
      `${archived ? 'chore: archive' : 'chore: restore'} board "${boardSlug}"`,
    )
  }
}
