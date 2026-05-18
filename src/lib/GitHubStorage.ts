/**
 * GitHubStorage.ts
 *
 * Wraps the GitHub Contents API for reading and writing files in the repo.
 * Every write is signed with the authenticated user's identity.
 *
 * SHA-based optimistic locking:
 *   - readFile returns the current SHA along with content
 *   - writeFile sends the SHA back; GitHub rejects (422) if it changed
 *   - On conflict, throws { type: 'conflict', currentSha } — caller can retry
 */

import { Octokit } from '@octokit/rest'
import type {
  FileContent,
  BinaryFileContent,
  ConflictError,
} from './types'

export type { FileContent, BinaryFileContent }

interface ListEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  sha: string
  size: number
}

export class GitHubStorage {
  private octokit: Octokit
  private owner: string
  private repo: string
  private userLogin: string
  private userEmail: string

  constructor(
    token: string,
    owner: string,
    repo: string,
    userLogin: string,
    userEmail: string,
  ) {
    this.octokit = new Octokit({ auth: token })
    this.owner = owner
    this.repo = repo
    this.userLogin = userLogin
    this.userEmail = userEmail
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  /** Read a text file. Returns null if it does not exist. */
  async readFile(path: string): Promise<FileContent | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      })

      if (Array.isArray(data) || data.type !== 'file') return null

      const content = data.encoding === 'base64'
        ? decodeURIComponent(
            escape(atob((data.content as string).replace(/\n/g, '')))
          )
        : (data.content as string)

      return { content, sha: data.sha }
    } catch (err: unknown) {
      if (this.isNotFound(err)) return null
      throw err
    }
  }

  /**
   * Read a binary file as base64.
   * Returns null if it does not exist.
   */
  async readBinaryFile(path: string): Promise<BinaryFileContent | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      })

      if (Array.isArray(data) || data.type !== 'file') return null

      return {
        base64: (data.content as string).replace(/\n/g, ''),
        sha: data.sha,
      }
    } catch (err: unknown) {
      if (this.isNotFound(err)) return null
      throw err
    }
  }

  /** List files/dirs in a directory. Returns [] if not found. */
  async listFiles(path: string): Promise<ListEntry[]> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      })

      if (!Array.isArray(data)) return []

      return data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type as 'file' | 'dir',
        sha: item.sha,
        size: item.size ?? 0,
      }))
    } catch (err: unknown) {
      if (this.isNotFound(err)) return []
      throw err
    }
  }

  async fileExists(path: string): Promise<boolean> {
    return (await this.readFile(path)) !== null
  }

  // ─── Write ───────────────────────────────────────────────────────────────────

  /**
   * Write a text file.
   * Pass `sha` to update an existing file; omit for new files.
   * Throws ConflictError on SHA mismatch.
   */
  async writeFile(
    path: string,
    content: string,
    sha?: string,
    message?: string,
  ): Promise<{ sha: string }> {
    // GitHub API requires base64 content
    const encoded = btoa(unescape(encodeURIComponent(content)))
    return this.putFile(path, encoded, sha, message)
  }

  /**
   * Write a binary file already encoded as base64.
   * Throws ConflictError on SHA mismatch.
   */
  async writeBinaryFile(
    path: string,
    base64: string,
    sha?: string,
    message?: string,
  ): Promise<{ sha: string }> {
    return this.putFile(path, base64, sha, message)
  }

  private async putFile(
    path: string,
    base64Content: string,
    sha: string | undefined,
    message: string | undefined,
  ): Promise<{ sha: string }> {
    try {
      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message: message ?? `chore: update ${path}`,
        content: base64Content,
        sha,
        committer: { name: this.userLogin, email: this.userEmail },
        author:    { name: this.userLogin, email: this.userEmail },
      })

      return { sha: data.content!.sha! }
    } catch (err: unknown) {
      // GitHub returns 409 or 422 on SHA conflict
      if (this.isConflict(err)) {
        const current = await this.readBinaryFile(path)
        const conflict: ConflictError = {
          type: 'conflict',
          currentSha: current?.sha ?? null,
        }
        throw conflict
      }
      throw err
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async deleteFile(path: string, sha: string, message?: string): Promise<void> {
    await this.octokit.repos.deleteFile({
      owner: this.owner,
      repo: this.repo,
      path,
      message: message ?? `chore: delete ${path}`,
      sha,
      committer: { name: this.userLogin, email: this.userEmail },
    })
  }

  // ─── Directory helpers ────────────────────────────────────────────────────────

  /**
   * GitHub has no concept of empty directories.
   * We create a .gitkeep placeholder to materialise the path.
   */
  async createDirectory(dirPath: string, message?: string): Promise<void> {
    await this.writeFile(
      `${dirPath}/.gitkeep`,
      '',
      undefined,
      message ?? `chore: create directory ${dirPath}`,
    )
  }

  // ─── JSON helpers ─────────────────────────────────────────────────────────────

  async readJSON<T>(path: string): Promise<{ data: T; sha: string } | null> {
    const file = await this.readFile(path)
    if (!file) return null
    return { data: JSON.parse(file.content) as T, sha: file.sha }
  }

  async writeJSON<T>(
    path: string,
    data: T,
    sha?: string,
    message?: string,
  ): Promise<{ sha: string }> {
    return this.writeFile(
      path,
      JSON.stringify(data, null, 2),
      sha,
      message,
    )
  }

  // ─── Error helpers ────────────────────────────────────────────────────────────

  private isNotFound(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      (err as { status: number }).status === 404
    )
  }

  private isConflict(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false
    const status = (err as { status?: number }).status
    return status === 409 || status === 422
  }
}
