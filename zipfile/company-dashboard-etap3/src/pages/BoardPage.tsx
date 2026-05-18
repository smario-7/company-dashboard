/**
 * BoardPage.tsx
 *
 * Trello-style board:
 *  - Horizontal scrolling columns
 *  - Drag & drop to reorder columns (@dnd-kit)
 *  - Add column inline
 *  - Column menu: rename, change color, archive
 *  - Cards placeholder (Etap 4)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor,
  KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  horizontalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '../contexts/AuthContext'
import { BoardService } from '../lib/BoardService'
import { generateId } from '../lib/utils'
import type { Board, Column } from '../lib/types'

const COLUMN_COLORS = [
  '#64748b','#ef4444','#f97316','#f59e0b',
  '#84cc16','#22c55e','#14b8a6','#3b82f6',
  '#8b5cf6','#ec4899',
]

export function BoardPage() {
  const { projectSlug, boardSlug } = useParams<{ projectSlug: string; boardSlug: string }>()
  const { storage } = useAuth()

  const [board,   setBoard]   = useState<Board | null>(null)
  const [sha,     setSha]     = useState('')
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const svc = storage ? new BoardService(storage) : null

  // ─── Load board ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!svc || !projectSlug || !boardSlug) return
    setLoading(true)
    try {
      const result = await svc.getBoard(projectSlug, boardSlug)
      if (result) { setBoard(result.data); setSha(result.sha) }
    } finally {
      setLoading(false)
    }
  }, [storage, projectSlug, boardSlug]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  // ─── Save columns ─────────────────────────────────────────────────────────
  const saveColumns = async (columns: Column[], currentSha: string) => {
    if (!svc || !projectSlug || !boardSlug || !board) return
    setSaving(true)
    try {
      const result = await svc.saveColumns(projectSlug, boardSlug, columns, currentSha)
      setSha(result.sha)
      setBoard(prev => prev ? { ...prev, columns } : prev)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ─── Drag & drop columns ──────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !board) return
    const oldIdx = board.columns.findIndex(c => c.id === active.id)
    const newIdx = board.columns.findIndex(c => c.id === over.id)
    const reordered = arrayMove(board.columns, oldIdx, newIdx)
    setBoard(prev => prev ? { ...prev, columns: reordered } : prev)
    saveColumns(reordered, sha)
  }

  // ─── Add column ───────────────────────────────────────────────────────────
  const [addingCol,   setAddingCol]   = useState(false)
  const [newColName,  setNewColName]  = useState('')
  const newColRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (addingCol) newColRef.current?.focus() }, [addingCol])

  const submitAddColumn = async () => {
    if (!newColName.trim() || !board) return
    const col: Column = { id: generateId(), name: newColName.trim(), color: '#64748b' }
    const updated = [...board.columns, col]
    setNewColName('')
    setAddingCol(false)
    await saveColumns(updated, sha)
  }

  // ─── Rename column ────────────────────────────────────────────────────────
  const [renamingId,  setRenamingId]  = useState<string | null>(null)
  const [renameVal,   setRenameVal]   = useState('')

  const startRename = (col: Column) => {
    setRenamingId(col.id); setRenameVal(col.name)
  }

  const submitRename = async () => {
    if (!board || !renamingId || !renameVal.trim()) { setRenamingId(null); return }
    const updated = board.columns.map(c =>
      c.id === renamingId ? { ...c, name: renameVal.trim() } : c
    )
    setRenamingId(null)
    await saveColumns(updated, sha)
  }

  // ─── Change column color ──────────────────────────────────────────────────
  const changeColor = async (colId: string, color: string) => {
    if (!board) return
    const updated = board.columns.map(c => c.id === colId ? { ...c, color } : c)
    await saveColumns(updated, sha)
  }

  // ─── Archive column ───────────────────────────────────────────────────────
  const archiveColumn = async (colId: string) => {
    if (!board) return
    const updated = board.columns.filter(c => c.id !== colId)
    await saveColumns(updated, sha)
  }

  // ─── Menu per column ──────────────────────────────────────────────────────
  const [colMenu, setColMenu] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-surface-800 border-t-brand-400" />
      </div>
    )
  }

  if (!board) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-surface-200/40">Board not found</p>
        <Link to={`/projects/${projectSlug}`} className="btn-ghost text-xs">← Back</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/5 px-6 py-3 flex-shrink-0">
        <Link
          to={`/projects/${projectSlug}`}
          className="text-xs text-surface-200/40 hover:text-surface-200 transition-colors"
        >
          ← {projectSlug}
        </Link>
        <span className="text-surface-200/20">/</span>
        <h1 className="font-semibold text-surface-50 text-sm">{board.name}</h1>
        {saving && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-surface-200/30">
            <div className="h-3 w-3 animate-spin rounded-full border border-surface-200/30 border-t-surface-200/60" />
            Saving…
          </span>
        )}
        {error && <span className="ml-auto text-xs text-accent-red">{error}</span>}
      </div>

      {/* Board canvas — horizontal scroll */}
      <div className="flex flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-4 gap-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={board.columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {board.columns.map(col => (
              <SortableColumn
                key={col.id}
                column={col}
                menuOpen={colMenu === col.id}
                isRenaming={renamingId === col.id}
                renameVal={renameVal}
                onMenuToggle={() => setColMenu(colMenu === col.id ? null : col.id)}
                onMenuClose={() => setColMenu(null)}
                onStartRename={() => { startRename(col); setColMenu(null) }}
                onRenameChange={setRenameVal}
                onRenameSubmit={submitRename}
                onColorChange={color => { changeColor(col.id, color); setColMenu(null) }}
                onArchive={() => { archiveColumn(col.id); setColMenu(null) }}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add column */}
        <div className="flex-shrink-0 w-64">
          {addingCol ? (
            <div className="rounded-2xl bg-surface-800 border border-white/5 p-3 space-y-2">
              <input
                ref={newColRef}
                type="text"
                placeholder="Column name"
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitAddColumn()
                  if (e.key === 'Escape') { setAddingCol(false); setNewColName('') }
                }}
                className="input text-sm"
              />
              <div className="flex gap-2">
                <button onClick={submitAddColumn} className="btn-primary flex-1 py-1.5 text-xs">Add</button>
                <button onClick={() => { setAddingCol(false); setNewColName('') }} className="btn-ghost py-1.5 text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingCol(true)}
              className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-white/10
                         px-4 py-3 text-sm text-surface-200/30 hover:border-white/20 hover:text-surface-200/60
                         transition-all"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add column
            </button>
          )}
        </div>

        {/* Spacer at end */}
        <div className="flex-shrink-0 w-4" />
      </div>

      {/* Close menu on outside click */}
      {colMenu && <div className="fixed inset-0 z-10" onClick={() => setColMenu(null)} />}
    </div>
  )
}

// ─── SortableColumn ───────────────────────────────────────────────────────────

interface SortableColumnProps {
  column:          Column
  menuOpen:        boolean
  isRenaming:      boolean
  renameVal:       string
  onMenuToggle:    () => void
  onMenuClose:     () => void
  onStartRename:   () => void
  onRenameChange:  (v: string) => void
  onRenameSubmit:  () => void
  onColorChange:   (color: string) => void
  onArchive:       () => void
}

function SortableColumn({
  column, menuOpen, isRenaming, renameVal,
  onMenuToggle, onMenuClose, onStartRename,
  onRenameChange, onRenameSubmit, onColorChange, onArchive,
}: SortableColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id })

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
    zIndex:     isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-shrink-0 w-64 flex flex-col rounded-2xl bg-surface-800 border border-white/5 select-none"
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />

        {isRenaming ? (
          <input
            type="text"
            value={renameVal}
            onChange={e => onRenameChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onRenameSubmit()
              if (e.key === 'Escape') onRenameSubmit()
            }}
            onBlur={onRenameSubmit}
            className="input py-0.5 px-1.5 h-auto text-sm flex-1"
            autoFocus
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-surface-50 truncate">{column.name}</span>
        )}

        {/* Column menu */}
        <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
          <button
            onClick={onMenuToggle}
            className="h-6 w-6 flex items-center justify-center rounded-lg
                       text-surface-200/30 hover:bg-white/5 hover:text-surface-200 transition-all"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-7 z-30 w-44 rounded-2xl bg-surface-850 border border-white/5 shadow-modal py-1 animate-fade-in">
              <button onClick={onStartRename}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-surface-200/70 hover:bg-white/5 hover:text-surface-50">
                Rename
              </button>
              <div className="px-3 py-2 border-t border-white/5">
                <p className="text-xs text-surface-200/30 mb-2">Color</p>
                <div className="flex flex-wrap gap-1.5">
                  {COLUMN_COLORS.map(c => (
                    <button key={c} onClick={() => onColorChange(c)}
                      className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c, outline: column.color === c ? `2px solid ${c}` : undefined, outlineOffset: 2 }}
                    />
                  ))}
                </div>
              </div>
              <div className="border-t border-white/5">
                <button onClick={onArchive}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-accent-red/70 hover:bg-accent-red/5 hover:text-accent-red">
                  Remove column
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cards area (populated in Etap 4) */}
      <div className="flex-1 min-h-[120px] px-2 py-1">
        <div className="flex flex-col items-center justify-center h-full gap-1 opacity-0 hover:opacity-100 transition-opacity">
          <p className="text-xs text-surface-200/20">Cards coming in Etap 4</p>
        </div>
      </div>

      {/* Add card placeholder */}
      <div className="px-2 pb-2">
        <button className="flex w-full items-center gap-1.5 rounded-xl px-2 py-1.5
                           text-xs text-surface-200/25 hover:bg-white/5 hover:text-surface-200/50 transition-all">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add card
        </button>
      </div>
    </div>
  )
}
