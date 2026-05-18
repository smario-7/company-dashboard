import { useState } from 'react'
import type { CardFile } from '../../lib/DocumentService'

interface Props {
  files:        CardFile[]
  activeFile:   CardFile | null
  onSelect:     (file: CardFile) => void
  onNewFile:    (name: string) => void
  onDeleteFile: (file: CardFile) => void
  loading:      boolean
}

const FILE_ICON: Record<string, string> = {
  md:     '📄',
  canvas: '🎨',
  asset:  '📎',
  other:  '📁',
}

export function FileTree({ files, activeFile, onSelect, onNewFile, onDeleteFile, loading }: Props) {
  const [creating, setCreating]   = useState(false)
  const [newName,  setNewName]    = useState('')
  const [newType,  setNewType]    = useState<'md' | 'canvas'>('md')
  const [hoverId,  setHoverId]    = useState<string | null>(null)

  const mdFiles     = files.filter(f => f.type === 'md')
  const canvasFiles = files.filter(f => f.type === 'canvas')

  const submitNew = () => {
    const raw = newName.trim()
    if (!raw) return
    const ext  = newType === 'md' ? '.md' : '.canvas'
    const name = raw.endsWith(ext) ? raw : raw + ext
    onNewFile(name)
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="flex flex-col h-full border-r border-white/5 bg-surface-900/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <p className="text-xs font-medium text-surface-200/50">Files</p>
        <button
          onClick={() => setCreating(v => !v)}
          className="h-5 w-5 flex items-center justify-center rounded text-surface-200/30
                     hover:bg-white/5 hover:text-brand-400 transition-all"
          title="New file"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>

      {/* New file form */}
      {creating && (
        <div className="px-2 py-2 border-b border-white/5 space-y-1.5 flex-shrink-0">
          <div className="flex gap-1">
            <button
              onClick={() => setNewType('md')}
              className={`flex-1 rounded-lg py-1 text-xs transition-all ${newType === 'md' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-200/40 hover:bg-white/5'}`}
            >
              .md
            </button>
            <button
              onClick={() => setNewType('canvas')}
              className={`flex-1 rounded-lg py-1 text-xs transition-all ${newType === 'canvas' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-200/40 hover:bg-white/5'}`}
            >
              .canvas
            </button>
          </div>
          <input
            type="text"
            placeholder={`name.${newType}`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') setCreating(false) }}
            className="input py-1 text-xs"
            autoFocus
          />
          <div className="flex gap-1">
            <button onClick={submitNew} className="btn-primary flex-1 py-1 text-xs">Create</button>
            <button onClick={() => setCreating(false)} className="btn-ghost py-1 text-xs px-2">✕</button>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-4 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-5 rounded bg-surface-800 animate-pulse" />)}
          </div>
        ) : (
          <>
            {mdFiles.length > 0 && (
              <Section label="Markdown">
                {mdFiles.map(f => (
                  <FileRow
                    key={f.path}
                    file={f}
                    active={activeFile?.path === f.path}
                    hovered={hoverId === f.path}
                    onHover={setHoverId}
                    onSelect={onSelect}
                    onDelete={onDeleteFile}
                    deletable={f.name !== 'README.md'}
                  />
                ))}
              </Section>
            )}
            {canvasFiles.length > 0 && (
              <Section label="Canvas">
                {canvasFiles.map(f => (
                  <FileRow
                    key={f.path}
                    file={f}
                    active={activeFile?.path === f.path}
                    hovered={hoverId === f.path}
                    onHover={setHoverId}
                    onSelect={onSelect}
                    onDelete={onDeleteFile}
                    deletable
                  />
                ))}
              </Section>
            )}
            {mdFiles.length === 0 && canvasFiles.length === 0 && !loading && (
              <p className="px-3 py-4 text-xs text-surface-200/25 text-center">No files yet</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-surface-200/25">
        {label}
      </p>
      {children}
    </div>
  )
}

function FileRow({
  file, active, hovered, onHover, onSelect, onDelete, deletable,
}: {
  file:      CardFile
  active:    boolean
  hovered:   boolean
  deletable: boolean
  onHover:   (path: string | null) => void
  onSelect:  (f: CardFile) => void
  onDelete:  (f: CardFile) => void
}) {
  return (
    <div
      className={`group flex items-center gap-1.5 px-2 py-1 mx-1 rounded-lg cursor-pointer transition-all
                  ${active ? 'bg-brand-500/15 text-brand-400' : 'text-surface-200/60 hover:bg-white/5 hover:text-surface-50'}`}
      onClick={() => onSelect(file)}
      onMouseEnter={() => onHover(file.path)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="text-xs flex-shrink-0 opacity-70">
        {FILE_ICON[file.type]}
      </span>
      <span className="text-xs truncate flex-1 min-w-0">{file.name}</span>
      {deletable && hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(file) }}
          className="flex-shrink-0 h-4 w-4 flex items-center justify-center rounded
                     text-surface-200/20 hover:text-accent-red transition-colors"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      )}
    </div>
  )
}
