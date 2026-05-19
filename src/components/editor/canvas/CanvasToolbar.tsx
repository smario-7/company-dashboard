import { useState, type ReactNode } from 'react'
import type { CanvasPathEntry } from '../../../lib/canvasPaths'

interface Props {
  onAddText:      () => void
  onAddFile:      (vaultPath: string) => void
  onAddGroup:     () => void
  onFitView:      () => void
  onSave:         () => void
  onUndo:         () => void
  onRedo:         () => void
  canUndo:        boolean
  canRedo:        boolean
  saving:         boolean
  zoom:           number
  onZoomChange:   (zoom: number) => void
  availableFiles: CanvasPathEntry[]
}

export function CanvasToolbar({
  onAddText, onAddFile, onAddGroup,
  onFitView, onSave, onUndo, onRedo,
  canUndo, canRedo, saving,
  zoom, onZoomChange,
  availableFiles,
}: Props) {
  const [filePickerOpen, setFilePickerOpen] = useState(false)

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 flex-shrink-0 flex-wrap">
      <div className="flex items-center gap-1 border-r border-white/5 pr-2 mr-1">
        <ToolBtn title="Add text node" onClick={onAddText}>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          Text
        </ToolBtn>

        <div className="relative">
          <ToolBtn title="Add file node" onClick={() => setFilePickerOpen(v => !v)}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            File
          </ToolBtn>
          {filePickerOpen && (
            <div className="absolute top-full left-0 mt-1 z-30 w-56 max-h-48 overflow-y-auto rounded-xl
                            bg-surface-850 border border-white/5 shadow-modal py-1 animate-fade-in">
              {availableFiles.length === 0 && (
                <p className="px-3 py-2 text-xs text-surface-200/30">No files in this card</p>
              )}
              {availableFiles.map(f => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => { onAddFile(f.path); setFilePickerOpen(false) }}
                  className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-white/5"
                >
                  <span className="text-xs text-surface-200/70">📄 {f.name}</span>
                </button>
              ))}
              <div className="fixed inset-0 -z-10" onClick={() => setFilePickerOpen(false)} />
            </div>
          )}
        </div>

        <ToolBtn title="Add group" onClick={onAddGroup}>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="4 2"/>
          </svg>
          Group
        </ToolBtn>
      </div>

      <div className="flex items-center gap-1 border-r border-white/5 pr-2 mr-1">
        <IconBtn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6"/><path d="M3 13A9 9 0 1 0 5.5 5.5L3 7"/>
          </svg>
        </IconBtn>
        <IconBtn onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6"/><path d="M21 13A9 9 0 1 1 18.5 5.5L21 7"/>
          </svg>
        </IconBtn>
      </div>

      <div className="flex items-center gap-2 border-r border-white/5 pr-2 mr-1">
        <IconBtn onClick={() => onZoomChange(Math.max(0.15, zoom - 0.1))} title="Zoom out">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/>
          </svg>
        </IconBtn>
        <span className="text-xs text-surface-200/40 w-10 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <IconBtn onClick={() => onZoomChange(Math.min(2.5, zoom + 0.1))} title="Zoom in">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
          </svg>
        </IconBtn>
        <IconBtn onClick={onFitView} title="Fit view">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </IconBtn>
      </div>

      <div className="ml-auto">
        <button type="button" onClick={onSave} disabled={saving} className="btn-primary py-1 px-3 text-xs">
          {saving ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
              Saving…
            </span>
          ) : 'Save canvas'}
        </button>
      </div>
    </div>
  )
}

function ToolBtn({
  children, onClick, title,
}: {
  children: ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs
                 text-surface-200/50 hover:bg-white/5 hover:text-surface-200 transition-all"
    >
      {children}
    </button>
  )
}

function IconBtn({
  children, onClick, disabled, title,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-7 w-7 flex items-center justify-center rounded-lg
                 text-surface-200/40 hover:bg-white/5 hover:text-surface-200
                 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
    >
      {children}
    </button>
  )
}
