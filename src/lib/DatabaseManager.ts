/**
 * DatabaseManager.ts
 *
 * Manages a SQLite database stored as a binary file in the GitHub repo.
 *
 * Flow:
 *   1. init()  →  fetch database.sqlite from repo, load with sql.js
 *   2. query() →  SELECT, returns typed rows
 *   3. execute()→  INSERT / UPDATE / DELETE, schedules a debounced save
 *   4. save()  →  export DB → base64 → GitHub API PUT (with SHA lock)
 *
 * On SHA conflict during save, the manager reloads the latest DB from the repo,
 * re-applies the pending changes and retries.
 */

import type { Database, SqlJsStatic } from 'sql.js'
import type { GitHubStorage } from './GitHubStorage'
import { isConflictError } from './types'

const DB_PATH = 'database.sqlite'

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA = /* sql */ `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  github_login            TEXT UNIQUE NOT NULL,
  github_id               INTEGER UNIQUE NOT NULL,
  display_name            TEXT    NOT NULL DEFAULT '',
  avatar_url              TEXT    NOT NULL DEFAULT '',
  password_hash           TEXT    NOT NULL,
  github_token_encrypted  TEXT,
  theme                   TEXT    NOT NULL DEFAULT 'system',
  push_subscription_json  TEXT,
  fcm_token               TEXT,
  created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at           TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_board_settings (
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_path      TEXT    NOT NULL,
  settings_json   TEXT    NOT NULL DEFAULT '{}',
  last_visited_at TEXT,
  PRIMARY KEY (user_id, board_path)
);

CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  on_card_assign  INTEGER NOT NULL DEFAULT 1,
  on_comment      INTEGER NOT NULL DEFAULT 1,
  on_due_date     INTEGER NOT NULL DEFAULT 1,
  on_card_move    INTEGER NOT NULL DEFAULT 0,
  on_mention      INTEGER NOT NULL DEFAULT 1
);
`

// ─── Manager ──────────────────────────────────────────────────────────────────

export class DatabaseManager {
  private db:      Database | null = null
  private SQL:     SqlJsStatic | null = null
  private sha:     string | null = null
  private storage: GitHubStorage
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  /** Pending operations to replay after a conflict reload */
  private pendingOps: Array<{ sql: string; params?: unknown[] }> = []

  constructor(storage: GitHubStorage) {
    this.storage = storage
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    // Lazy-load sql.js WASM (only once per page load)
    if (!this.SQL) {
      const initSqlJs = (await import('sql.js')).default
      this.SQL = await initSqlJs({
        locateFile: (file: string) =>
          `/company-dashboard/${file}`,
      })
    }

    const file = await this.storage.readBinaryFile(DB_PATH)

    if (file) {
      this.sha = file.sha
      this.db = new this.SQL.Database(b64ToUint8(file.base64))
    } else {
      // First run — create empty DB
      this.db = new this.SQL.Database()
    }

    this.db.run(SCHEMA)

    // Persist on first creation
    if (!file) {
      await this.save('chore: initialize database')
    }
  }

  // ─── Query ─────────────────────────────────────────────────────────────────

  /** Run a SELECT and return typed rows. */
  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    if (!this.db) throw new Error('DatabaseManager: not initialised')
    const stmt = this.db.prepare(sql)
    stmt.bind(params as never)
    const rows: T[] = []
    while (stmt.step()) rows.push(stmt.getAsObject() as T)
    stmt.free()
    return rows
  }

  /** Run a single SELECT that is expected to return one row. */
  queryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): T | null {
    const rows = this.query<T>(sql, params)
    return rows[0] ?? null
  }

  // ─── Mutate ────────────────────────────────────────────────────────────────

  /**
   * Execute an INSERT / UPDATE / DELETE.
   * Changes are flushed to GitHub automatically after a 2 s debounce.
   */
  execute(sql: string, params: unknown[] = []): void {
    if (!this.db) throw new Error('DatabaseManager: not initialised')
    this.db.run(sql, params as never)
    this.pendingOps.push({ sql, params })
    this.scheduleSave()
  }

  /** Execute without buffering (for setup / schema changes). */
  executeDirect(sql: string, params: unknown[] = []): void {
    if (!this.db) throw new Error('DatabaseManager: not initialised')
    this.db.run(sql, params as never)
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.save(), 2_000)
  }

  /** Flush in-memory DB to GitHub. Retries once on SHA conflict. */
  async save(message?: string): Promise<void> {
    if (!this.db) return
    const base64 = uint8ToB64(this.db.export())

    try {
      const result = await this.storage.writeBinaryFile(
        DB_PATH,
        base64,
        this.sha ?? undefined,
        message ?? 'chore: update database',
      )
      this.sha = result.sha
      this.pendingOps = []        // cleared on successful save
    } catch (err) {
      if (isConflictError(err)) {
        // Someone else saved while we were working — reload and replay
        await this.reload()
        await this.replayPending()
        await this.save(message)
      } else {
        throw err
      }
    }
  }

  /** Force an immediate save (skips debounce). */
  async flush(message?: string): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    await this.save(message)
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async reload(): Promise<void> {
    const file = await this.storage.readBinaryFile(DB_PATH)
    if (!file || !this.SQL) return
    this.sha = file.sha
    this.db = new this.SQL.Database(b64ToUint8(file.base64))
    this.db.run(SCHEMA)
  }

  private replayPending(): void {
    for (const op of this.pendingOps) {
      this.db!.run(op.sql, op.params as never)
    }
  }
}

// ─── Byte helpers ─────────────────────────────────────────────────────────────

function b64ToUint8(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function uint8ToB64(arr: Uint8Array): string {
  return btoa(Array.from(arr, b => String.fromCharCode(b)).join(''))
}
