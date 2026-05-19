import type { CanvasPathEntry } from './canvasPaths'
import { normalizeFilePathOnImport } from './canvasPaths'

export type FilePreviewKind =
  | 'loading'
  | 'error'
  | 'markdown'
  | 'image'
  | 'text'
  | 'json'
  | 'unsupported'

export interface FilePreviewState {
  kind:     FilePreviewKind
  fileName: string
  message?: string
  html?:    string
  text?:    string
  imageUrl?: string
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'])
const TEXT_EXTS  = new Set(['.txt', '.md', '.markdown', '.csv', '.log', '.yaml', '.yml', '.xml', '.html', '.htm'])
const JSON_EXTS  = new Set(['.json', '.jsonc'])

export function fileBasename(ref: string): string {
  return ref.split('/').pop() ?? ref
}

export function resolveRepoPath(
  ref: string,
  cardFiles: CanvasPathEntry[],
  assets: CanvasPathEntry[],
  cardBase: string,
): string | null {
  if (!ref.trim()) return null

  const entries = [...cardFiles, ...assets]
  const paths   = new Set(entries.map(e => e.path))

  const normalized = normalizeFilePathOnImport(ref, cardFiles, assets)
  if (paths.has(normalized)) return normalized

  if (ref.startsWith('projects/') && paths.has(ref)) return ref

  const relative = `${cardBase}/${ref.replace(/^\//, '')}`
  if (paths.has(relative)) return relative

  if (ref.startsWith('projects/')) return ref

  return null
}

export function detectPreviewKind(fileName: string): Exclude<FilePreviewKind, 'loading' | 'error'> {
  const lower = fileName.toLowerCase()
  const dot   = lower.lastIndexOf('.')
  const ext   = dot >= 0 ? lower.slice(dot) : ''

  if (IMAGE_EXTS.has(ext)) return 'image'
  if (ext === '.md' || ext === '.markdown') return 'markdown'
  if (JSON_EXTS.has(ext)) return 'json'
  if (ext === '.canvas') return 'unsupported'
  if (TEXT_EXTS.has(ext) || ext === '') return 'text'

  if (['.pdf', '.zip', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext)) {
    return 'unsupported'
  }

  return 'text'
}

const PREVIEW_CHAR_LIMIT = 12_000

export function truncateForPreview(content: string): string {
  if (content.length <= PREVIEW_CHAR_LIMIT) return content
  return content.slice(0, PREVIEW_CHAR_LIMIT) + '\n\n…'
}

export function formatJsonPreview(content: string): { text: string; valid: boolean } {
  try {
    const parsed = JSON.parse(content)
    return { text: JSON.stringify(parsed, null, 2), valid: true }
  } catch {
    return { text: content, valid: false }
  }
}
