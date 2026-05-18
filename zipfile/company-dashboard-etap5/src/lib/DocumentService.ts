/**
 * DocumentService.ts
 *
 * Manages files inside a card's directory in the GitHub repo:
 *   projects/{project}/boards/{board}/cards/{card}/
 *     ├── README.md          (created automatically on first open)
 *     ├── *.md               (user-created markdown files)
 *     ├── *.canvas           (Obsidian-format canvas files)
 *     └── assets/            (uploaded attachments)
 */

import type { GitHubStorage } from './GitHubStorage'

export interface CardFile {
  name: string
  path: string
  sha:  string
  size: number
  type: 'md' | 'canvas' | 'asset' | 'other'
}

export class DocumentService {
  constructor(private storage: GitHubStorage) {}

  private base(p: string, b: string, c: string): string {
    return `projects/${p}/boards/${b}/cards/${c}`
  }

  // ─── File listing ──────────────────────────────────────────────────────────

  async listFiles(projectSlug: string, boardSlug: string, cardId: string): Promise<CardFile[]> {
    const base    = this.base(projectSlug, boardSlug, cardId)
    const entries = await this.storage.listFiles(base)

    return entries
      .filter(e => e.type === 'file' && e.name !== 'meta.json' && !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        path: e.path,
        sha:  e.sha,
        size: e.size,
        type: (e.name.endsWith('.md')
          ? 'md'
          : e.name.endsWith('.canvas')
          ? 'canvas'
          : 'other') as CardFile['type'],
      }))
      .sort((a, b) => {
        // README.md always first
        if (a.name === 'README.md') return -1
        if (b.name === 'README.md') return 1
        return a.name.localeCompare(b.name)
      })
  }

  async listAssets(projectSlug: string, boardSlug: string, cardId: string): Promise<CardFile[]> {
    const path    = `${this.base(projectSlug, boardSlug, cardId)}/assets`
    const entries = await this.storage.listFiles(path)
    return entries
      .filter(e => e.type === 'file' && !e.name.startsWith('.'))
      .map(e => ({ name: e.name, path: e.path, sha: e.sha, size: e.size, type: 'asset' as const }))
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async readFile(path: string): Promise<{ content: string; sha: string } | null> {
    return this.storage.readFile(path)
  }

  // ─── Write ────────────────────────────────────────────────────────────────

  async writeFile(
    path:    string,
    content: string,
    sha?:    string,
    message?: string,
  ): Promise<{ sha: string }> {
    return this.storage.writeFile(path, content, sha, message ?? `docs: update ${path.split('/').pop()}`)
  }

  // ─── Create README on first open ───────────────────────────────────────────

  async ensureReadme(
    projectSlug: string,
    boardSlug:   string,
    cardId:      string,
    cardTitle:   string,
  ): Promise<void> {
    const path = `${this.base(projectSlug, boardSlug, cardId)}/README.md`
    const existing = await this.storage.readFile(path)
    if (!existing) {
      await this.storage.writeFile(
        path,
        `# ${cardTitle}\n\nAdd your notes here.\n`,
        undefined,
        `feat: init README for card`,
      )
    }
  }

  // ─── Create new file ──────────────────────────────────────────────────────

  async createFile(
    projectSlug: string,
    boardSlug:   string,
    cardId:      string,
    fileName:    string,
    initialContent = '',
  ): Promise<{ path: string; sha: string }> {
    const path   = `${this.base(projectSlug, boardSlug, cardId)}/${fileName}`
    const result = await this.storage.writeFile(
      path,
      initialContent,
      undefined,
      `feat: create ${fileName}`,
    )
    return { path, sha: result.sha }
  }

  // ─── Delete file ──────────────────────────────────────────────────────────

  async deleteFile(path: string, sha: string): Promise<void> {
    await this.storage.deleteFile(path, sha, `docs: delete ${path.split('/').pop()}`)
  }

  // ─── Upload asset (image / file) ──────────────────────────────────────────

  async uploadAsset(
    projectSlug: string,
    boardSlug:   string,
    cardId:      string,
    fileName:    string,
    base64Data:  string,
  ): Promise<{ path: string; sha: string }> {
    const path   = `${this.base(projectSlug, boardSlug, cardId)}/assets/${fileName}`
    const result = await this.storage.writeBinaryFile(
      path,
      base64Data,
      undefined,
      `feat: add attachment "${fileName}"`,
    )
    return { path, sha: result.sha }
  }

  // ─── GitHub raw URL for assets ────────────────────────────────────────────

  rawUrl(owner: string, repo: string, path: string): string {
    return `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`
  }
}
