/**
 * WorkspaceManager.ts
 *
 * Manages the workspace-level state stored in app-config.json.
 *
 * Responsibilities:
 *  - Create app-config.json on first run
 *  - Check whether a GitHub user is allowed to register (invited or first user)
 *  - Mark invitations as used after successful registration
 *  - Provide helpers for admin operations
 */

import type { GitHubStorage } from './GitHubStorage'
import type { DatabaseManager } from './DatabaseManager'
import type { AppConfig, DBInvitation } from './types'

const CONFIG_PATH = 'app-config.json'

const OWNER = import.meta.env.VITE_GITHUB_OWNER
const REPO  = import.meta.env.VITE_GITHUB_REPO

export class WorkspaceManager {
  constructor(
    private storage: GitHubStorage,
    private db:      DatabaseManager,
  ) {}

  // ─── Workspace init ────────────────────────────────────────────────────────

  /**
   * Ensures app-config.json exists.
   * Called once after the first user registers.
   */
  async ensureConfig(): Promise<AppConfig> {
    const existing = await this.storage.readJSON<AppConfig>(CONFIG_PATH)
    if (existing) return existing.data

    const config: AppConfig = {
      name:       'Company Dashboard',
      created_at: new Date().toISOString(),
      version:    '1.0.0',
      owner:      OWNER,
      repo:       REPO,
      admins:     [],
    }

    await this.storage.writeJSON(
      CONFIG_PATH,
      config,
      undefined,
      'chore: initialize workspace',
    )
    return config
  }

  // ─── First-user check ──────────────────────────────────────────────────────

  /** True if there are no registered users yet (next registration = admin). */
  isFirstUser(): boolean {
    const row = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM users',
    )
    return (row?.count ?? 0) === 0
  }

  // ─── Invitation checks ─────────────────────────────────────────────────────

  /**
   * Returns true if `githubLogin` may register:
   *  - First user always allowed
   *  - Otherwise must have an unused invitation
   */
  isInvited(githubLogin: string): boolean {
    if (this.isFirstUser()) return true

    const inv = this.db.queryOne<DBInvitation>(
      `SELECT id FROM invitations
       WHERE github_login = ? AND used_at IS NULL`,
      [githubLogin],
    )
    return inv !== null
  }

  /** Mark the invitation as used after a successful registration. */
  markInvitationUsed(githubLogin: string): void {
    this.db.execute(
      `UPDATE invitations SET used_at = datetime('now') WHERE github_login = ?`,
      [githubLogin],
    )
  }

  // ─── Invitation management (admin) ─────────────────────────────────────────

  /** Add a new invitation. `invitedBy` = id of the admin user. */
  addInvitation(githubLogin: string, invitedBy: number): void {
    this.db.execute(
      `INSERT OR IGNORE INTO invitations (github_login, invited_by)
       VALUES (?, ?)`,
      [githubLogin.toLowerCase(), invitedBy],
    )
  }

  /** Revoke an unused invitation (removes the row entirely). */
  revokeInvitation(id: number): void {
    this.db.execute('DELETE FROM invitations WHERE id = ? AND used_at IS NULL', [id])
  }

  /** List all invitations (pending and used). */
  listInvitations(): DBInvitation[] {
    return this.db.query<DBInvitation>(
      `SELECT i.*, u.display_name as inviter_name
       FROM invitations i
       LEFT JOIN users u ON u.id = i.invited_by
       ORDER BY i.invited_at DESC`,
    )
  }

  listPendingInvitations(): DBInvitation[] {
    return this.db.query<DBInvitation>(
      `SELECT * FROM invitations WHERE used_at IS NULL ORDER BY invited_at DESC`,
    )
  }
}
