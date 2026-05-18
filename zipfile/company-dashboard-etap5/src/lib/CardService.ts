import type { GitHubStorage } from './GitHubStorage'
import type { CardMeta } from './types'
import { generateId } from './utils'

export interface CardEntry {
  data: CardMeta
  sha:  string
}

export class CardService {
  constructor(private storage: GitHubStorage) {}

  private path(projectSlug: string, boardSlug: string, cardId: string): string {
    return `projects/${projectSlug}/boards/${boardSlug}/cards/${cardId}/meta.json`
  }

  // ─── Load multiple cards in parallel ──────────────────────────────────────

  async loadCards(
    projectSlug: string,
    boardSlug:   string,
    cardIds:     string[],
  ): Promise<Record<string, CardEntry>> {
    if (cardIds.length === 0) return {}

    const results = await Promise.allSettled(
      cardIds.map(id =>
        this.storage.readJSON<CardMeta>(this.path(projectSlug, boardSlug, id)),
      ),
    )

    const map: Record<string, CardEntry> = {}
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        map[cardIds[i]] = result.value
      }
    })
    return map
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async createCard(
    projectSlug: string,
    boardSlug:   string,
    title:       string,
    createdBy:   string,
  ): Promise<CardMeta> {
    const id   = generateId()
    const now  = new Date().toISOString()
    const meta: CardMeta = {
      id,
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

    await this.storage.writeJSON(
      this.path(projectSlug, boardSlug, id),
      meta,
      undefined,
      `feat: create card "${title}"`,
    )

    return meta
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async updateCard(
    projectSlug: string,
    boardSlug:   string,
    cardId:      string,
    updates:     Partial<Omit<CardMeta, 'id' | 'created_by' | 'created_at'>>,
    sha:         string,
  ): Promise<{ sha: string }> {
    const existing = await this.storage.readJSON<CardMeta>(
      this.path(projectSlug, boardSlug, cardId),
    )
    if (!existing) throw new Error(`Card "${cardId}" not found`)

    const updated: CardMeta = {
      ...existing.data,
      ...updates,
      updated_at: new Date().toISOString(),
    }

    return this.storage.writeJSON(
      this.path(projectSlug, boardSlug, cardId),
      updated,
      sha,
      `feat: update card "${updated.title}"`,
    )
  }

  // ─── Archive ───────────────────────────────────────────────────────────────

  async setArchived(
    projectSlug: string,
    boardSlug:   string,
    cardId:      string,
    sha:         string,
    archived:    boolean,
  ): Promise<void> {
    await this.updateCard(projectSlug, boardSlug, cardId, { archived }, sha)
  }
}
