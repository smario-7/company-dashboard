// ─── App models ───────────────────────────────────────────────────────────────

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
  card_order: Record<string, string[]>  // column_id → ordered card_ids
  labels: Label[]                        // label definitions for this board
  created_by: string
  created_at: string
  archived: boolean
}

export interface Column {
  id: string
  name: string
  color: string
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export interface Label {
  id: string
  name: string
  color: string
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface CardMeta {
  id: string
  title: string
  description: string
  label_ids: string[]
  assignees: string[]         // github_login values
  due_date: string | null     // ISO date string
  priority: 'none' | 'low' | 'medium' | 'high'
  checklist: ChecklistItem[]
  archived: boolean
  created_by: string
  created_at: string
  updated_at: string
}

// ─── JSON Canvas (Obsidian / jsoncanvas.org spec 1.0) ───────────────────────

export type PortSide = 'top' | 'right' | 'bottom' | 'left'
export type EdgeEnd = 'none' | 'arrow'
export type CanvasNodeColor = '0' | '1' | '2' | '3' | '4' | '5' | '6' | string
export type GroupBackgroundStyle = 'cover' | 'ratio' | 'repeat'

export interface CanvasNodeBase {
  id:     string
  x:      number
  y:      number
  width:  number
  height: number
  color?: CanvasNodeColor
}

export interface CanvasTextNode extends CanvasNodeBase {
  type: 'text'
  text: string
}

export interface CanvasFileNode extends CanvasNodeBase {
  type: 'file'
  file: string
  subpath?: string
}

export interface CanvasLinkNode extends CanvasNodeBase {
  type: 'link'
  url: string
}

export interface CanvasGroupNode extends CanvasNodeBase {
  type: 'group'
  label?: string
  background?: string
  backgroundStyle?: GroupBackgroundStyle
}

export type CanvasNode =
  | CanvasTextNode
  | CanvasFileNode
  | CanvasLinkNode
  | CanvasGroupNode

export interface CanvasEdge {
  id:       string
  fromNode: string
  toNode:   string
  fromSide?: PortSide
  toSide?:   PortSide
  fromEnd?:  EdgeEnd
  toEnd?:    EdgeEnd
  color?:    CanvasNodeColor
  label?:    string
}

export type JsonCanvasNode = Record<string, unknown>
