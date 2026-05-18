import type { GitHubStorage } from './GitHubStorage'
import type { Board, Column } from './types'
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
      .map(r => r.value!.data)
      .filter(b => includeArchived || !b.archived)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  // ─── Get ───────────────────────────────────────────────────────────────────

  async getBoard(
    projectSlug: string,
    boardSlug: string,
  ): Promise<{ data: Board; sha: string } | null> {
    return this.storage.readJSON<Board>(this.path(projectSlug, boardSlug))
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async createBoard(
    projectSlug: string,
    params: Pick<Board, 'name' | 'description'>,
    createdBy: string,
  ): Promise<Board> {
    const slug  = slugify(params.name)
    const board: Board = {
      ...params,
      id:         generateId(),
      slug,
      columns:    DEFAULT_COLUMNS.map(c => ({ ...c, id: generateId() })),
      created_by: createdBy,
      created_at: new Date().toISOString(),
      archived:   false,
    }

    await Promise.all([
      this.storage.writeJSON(
        this.path(projectSlug, slug),
        board,
        undefined,
        `feat: create board "${params.name}"`,
      ),
      this.storage.createDirectory(
        `projects/${projectSlug}/boards/${slug}/cards`,
        `feat: init cards dir for board "${params.name}"`,
      ),
    ])

    return board
  }

  // ─── Update (name / description) ──────────────────────────────────────────

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

  // ─── Save columns (called after drag-drop reorder or add/rename/remove) ────

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
