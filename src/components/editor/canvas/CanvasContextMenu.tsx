import { useState } from 'react'
import type { CanvasPathEntry } from '../../../lib/canvasPaths'

interface Props {
  x:               number
  y:               number
  availableFiles:  CanvasPathEntry[]
  availableAssets: CanvasPathEntry[]
  onAddText:       () => void
  onAddFile:       (vaultPath: string) => void
  onAddGroup:      () => void
  onAddLink:       () => void
  onClose:         () => void
}

export function CanvasContextMenu({
  x, y, availableFiles, availableAssets, onAddText, onAddFile, onAddGroup, onAddLink, onClose,
}: Props) {
  const [fileOpen, setFileOpen] = useState(false)

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={e => { e.preventDefault(); onClose() }}
      />
      <div
        className="absolute z-50 min-w-[180px] rounded-xl bg-surface-850 border border-white/10
                   shadow-modal py-1 animate-fade-in"
        style={{ left: x, top: y }}
        onPointerDown={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        <MenuItem label="Add text" onClick={() => { onAddText(); onClose() }} />
        <div className="relative">
          <MenuItem label="Add file ›" onClick={() => setFileOpen(v => !v)} />
          {fileOpen && (
            <div className="absolute left-full top-0 ml-1 max-h-48 overflow-y-auto min-w-[200px]
                            rounded-xl bg-surface-850 border border-white/10 py-1 shadow-modal">
              {availableFiles.length === 0 && availableAssets.length === 0 && (
                <p className="px-3 py-2 text-xs text-surface-200/30">No files</p>
              )}
              {availableFiles.map(f => (
                <MenuItem
                  key={f.path}
                  label={f.name}
                  sub={f.path}
                  onClick={() => { onAddFile(f.path); onClose() }}
                />
              ))}
              {availableAssets.map(f => (
                <MenuItem
                  key={f.path}
                  label={f.name}
                  sub={f.path}
                  onClick={() => { onAddFile(f.path); onClose() }}
                />
              ))}
            </div>
          )}
        </div>
        <MenuItem label="Add group" onClick={() => { onAddGroup(); onClose() }} />
        <MenuItem label="Add link" onClick={() => { onAddLink(); onClose() }} />
        <div className="my-1 border-t border-white/5" />
        <MenuItem label="Paste" disabled onClick={() => {}} />
      </div>
    </>
  )
}

function MenuItem({
  label, sub, onClick, disabled,
}: {
  label: string
  sub?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-white/5
                 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      <span className="text-xs text-surface-200/70">{label}</span>
      {sub && (
        <span className="text-[10px] text-surface-200/30 truncate max-w-[220px]">{sub}</span>
      )}
    </button>
  )
}
