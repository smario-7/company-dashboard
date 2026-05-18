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
