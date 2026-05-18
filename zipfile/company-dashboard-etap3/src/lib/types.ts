// ─── Database models ──────────────────────────────────────────────────────────

export interface DBUser {
  id: number
  github_login: string
  github_id: number
  display_name: string
  avatar_url: string
  password_hash: string
  github_token_encrypted: string | null
  role: 'admin' | 'member'
  theme: 'light' | 'dark' | 'system'
  push_subscription_json: string | null
  fcm_token: string | null
  created_at: string
  last_login_at: string | null
}

export interface DBInvitation {
  id: number
  github_login: string
  invited_by: number
  invited_at: string
  used_at: string | null
}

export interface DBSession {
  id: string
  user_id: number
  expires_at: string
  created_at: string
}

export interface DBUserBoardSettings {
  user_id: number
  board_path: string
  settings_json: string
  last_visited_at: string | null
}

export interface DBNotificationPrefs {
  user_id: number
  on_card_assign: 0 | 1
  on_comment: 0 | 1
  on_due_date: 0 | 1
  on_card_move: 0 | 1
  on_mention: 0 | 1
}

// ─── App models ───────────────────────────────────────────────────────────────

export interface AppUser {
  id: number
  githubLogin: string
  githubId: number
  displayName: string
  avatarUrl: string
  email: string
  theme: 'light' | 'dark' | 'system'
  role: 'admin' | 'member'
}

export interface AppConfig {
  name: string
  created_at: string
  version: string
  owner: string
  repo: string
  admins: string[]          // list of github_login values
}

// ─── GitHub API ───────────────────────────────────────────────────────────────

export interface GitHubUserInfo {
  login: string
  id: number
  name: string | null
  avatar_url: string
  email: string
}

export interface FileContent {
  content: string            // decoded text
  sha: string
}

export interface BinaryFileContent {
  base64: string             // raw base64 from GitHub API
  sha: string
}

export interface ConflictError {
  type: 'conflict'
  currentSha: string | null
}

export function isConflictError(e: unknown): e is ConflictError {
  return typeof e === 'object' && e !== null && (e as ConflictError).type === 'conflict'
}

// ─── GitHub Device Flow ───────────────────────────────────────────────────────

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'card_assigned'
  | 'comment_added'
  | 'mentioned'
  | 'due_date_reminder'
  | 'card_moved'

export interface Notification {
  id: string
  type: NotificationType
  read: boolean
  created_at: string
  actor_login: string
  actor_avatar: string
  payload: {
    project?: string
    board?: string
    card_id?: string
    card_title?: string
    comment?: string
  }
}

// ─── Projects & Boards ────────────────────────────────────────────────────────

export interface Project {
  id: string
  slug: string
  name: string
  description: string
  color: string
  emoji: string
  created_by: string
  created_at: string
  archived: boolean
}

export interface Board {
  id: string
  slug: string
  name: string
  description: string
  columns: Column[]
  created_by: string
  created_at: string
  archived: boolean
}

export interface Column {
  id: string
  name: string
  color: string
}
