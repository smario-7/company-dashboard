/**
 * DatabaseManager.ts
 *
 * Manages a SQLite database stored as a binary file in the GitHub repo.
 * Includes schema migrations for adding new columns/tables without data loss.
 */

import type { Database, SqlJsStatic } from 'sql.js'
import type { GitHubStorage } from './GitHubStorage'
import { isConflictError } from './types'

// sql.js is a UMD module — we load it via a dynamic <script> tag so Vite
// doesn't touch it, and we await the load before calling initSqlJs.
declare global {
  interface Window {
    initSqlJs?: (config: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>
  }
}

/** Injects a <script> tag and resolves when it has loaded. No-op if already present. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-sqljs]`)) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.setAttribute('data-sqljs', '')
    s.src = src
    s.onload  = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load sql.js from: ${src}`))
    document.head.appendChild(s)
  })
}

let sqlJsPromise: Promise<SqlJsStatic> | null = null

/** Returns the sql.js instance, loading it on first call. */
async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsPromise) return sqlJsPromise

  sqlJsPromise = (async () => {
    const base = import.meta.env.BASE_URL          // '/' in dev, '/company-dashboard/' in prod
    await loadScript(`${base}sql-wasm.js`)

    if (typeof window.initSqlJs !== 'function') {
      throw new Error(
        'window.initSqlJs not found after loading sql-wasm.js. ' +
        'Make sure public/sql-wasm.js exists (run: npm install)',
      )
    }

    return window.initSqlJs({
      locateFile: (file: string) => `${base}${file}`,
    })
  })()

  return sqlJsPromise
}

const DB_PATH = 'database.sqlite'

// ─── Base Schema ──────────────────────────────────────────────────────────────

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
  role                    TEXT    NOT NULL DEFAULT 'member',
  theme                   TEXT    NOT NULL DEFAULT 'system',
  push_subscription_json  TEXT,
  fcm_token               TEXT,
  created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at           TEXT
);

CREATE TABLE IF NOT EXISTS invitations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  github_login  TEXT    UNIQUE NOT NULL,
  invited_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  invited_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  used_at       TEXT
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

// ─── Migrations ───────────────────────────────────────────────────────────────
// Each migration runs only once (guarded by try/catch or IF NOT EXISTS).
// Always append — never modify existing entries.

const MIGRATIONS: string[] = [
  // v1 – add role column to users (for DBs created before Etap 2)
  `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member'`,
  // v2 – create invitations table (for DBs created before Etap 2)
  `CREATE TABLE IF NOT EXISTS invitations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    github_login  TEXT    UNIQUE NOT NULL,
    invited_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    invited_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    used_at       TEXT
  )`,
]

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
    if (!this.SQL) {
      this.SQL = await getSqlJs()
    }

    const file = await this.storage.readBinaryFile(DB_PATH)

    if (file) {
      this.sha = file.sha
      this.db = new this.SQL.Database(b64ToUint8(file.base64))
    } else {
      this.db = new this.SQL.Database()
    }

    this.db.run(SCHEMA)
    this.runMigrations()

    if (!file) {
      await this.save('chore: initialize database')
    }
  }

  private runMigrations(): void {
    for (const sql of MIGRATIONS) {
      try {
        this.db!.run(sql)
      } catch {
        // Migration already applied (column exists, table exists, etc.)
      }
    }
  }

  // ─── Query ─────────────────────────────────────────────────────────────────

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    if (!this.db) throw new Error('DatabaseManager: not initialised')
    const stmt = this.db.prepare(sql)
    stmt.bind(params as never)
    const rows: T[] = []
    while (stmt.step()) rows.push(stmt.getAsObject() as T)
    stmt.free()
    return rows
  }

  queryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): T | null {
    return this.query<T>(sql, params)[0] ?? null
  }

  // ─── Mutate ────────────────────────────────────────────────────────────────

  execute(sql: string, params: unknown[] = []): void {
    if (!this.db) throw new Error('DatabaseManager: not initialised')
    this.db.run(sql, params as never)
    this.pendingOps.push({ sql, params })
    this.scheduleSave()
  }

  executeDirect(sql: string, params: unknown[] = []): void {
    if (!this.db) throw new Error('DatabaseManager: not initialised')
    this.db.run(sql, params as never)
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.save(), 2_000)
  }

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
      this.pendingOps = []
    } catch (err) {
      if (isConflictError(err)) {
        await this.reload()
        this.replayPending()
        await this.save(message)
      } else {
        throw err
      }
    }
  }

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
    if (!file) return
    if (!this.SQL) this.SQL = await getSqlJs()
    this.sha = file.sha
    this.db = new this.SQL.Database(b64ToUint8(file.base64))
    this.db.run(SCHEMA)
    this.runMigrations()
  }
  private replayPending(): void {
    for (const op of this.pendingOps) {
      try {
        this.db!.run(op.sql, op.params as never)
      } catch {
        // Skip if already applied
      }
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
