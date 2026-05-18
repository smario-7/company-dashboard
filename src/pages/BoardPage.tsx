/**
 * BoardPage.tsx — Etap 4
 *
 * Full Trello-like board:
 *  - Columns (drag & drop to reorder)
 *  - Cards (drag & drop within and between columns)
 *  - Inline card creation
 *  - CardModal (title, description, labels, assignees, due date, priority, checklist)
 *  - LabelManager
 *  - Add / rename / recolor / remove columns
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, KeyboardSensor,
  useSensor, useSensors,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  horizontalListSortingStrategy, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '../contexts/AuthContext'
import { BoardService } from '../lib/BoardService'
import { CardService, type CardEntry } from '../lib/CardService'
import { SortableCard, CardMiniature } from '../components/CardMiniature'
import { CardModal } from '../components/CardModal'
import { LabelManager } from '../components/LabelManager'
import { generateId } from '../lib/utils'
import type { Board, Column, Label, CardMeta, DBUser } from '../lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findCardColumn(cardId: string, order: Record<string, string[]>): string | null {
  for (const [colId, ids] of Object.entries(order)) {
    if (ids.includes(cardId)) return colId
  }
  return null
}

function allCardIds(order: Record<string, string[]>): string[] {
  return Object.values(order).flat()
}

const COLUMN_COLORS = [
  '#64748b','#ef4444','#f97316','#f59e0b',
  '#84cc16','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899',
]

// ─── BoardPage ────────────────────────────────────────────────────────────────

export function BoardPage() {
  const { projectSlug, boardSlug } = useParams<{ projectSlug: string; boardSlug: string }>()
  const { storage, db } = useAuth()

  const [board,       setBoard]       = useState<Board | null>(null)
  const [boardSha,    setBoardSha]    = useState('')
  const [cards,       setCards]       = useState<Record<string, CardEntry>>({})
  const [localOrder,  setLocalOrder]  = useState<Record<string, string[]>>({})
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [members,     setMembers]     = useState<string[]>([])

  // UI state
  const [openCardId,     setOpenCardId]     = useState<string | null>(null)
  const [labelMgrOpen,   setLabelMgrOpen]   = useState(false)
  const [activeId,       setActiveId]       = useState<string | null>(null)   // dnd
  const [activeType,     setActiveType]     = useState<'card' | 'column' | null>(null)

  const boardSvc = storage ? new BoardService(storage) : null
  const cardSvc  = storage ? new CardService(storage)  : null

  // ─── Load board + cards ────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!boardSvc || !projectSlug || !boardSlug) return
    setLoading(true)
    try {
      const result = await boardSvc.getBoard(projectSlug, boardSlug)
      if (!result) return
      const { data, sha } = result
      setBoard(data)
      setBoardSha(sha)
      setLocalOrder(data.card_order)

      const ids = allCardIds(data.card_order)
      if (ids.length > 0 && cardSvc) {
        const loaded = await cardSvc.loadCards(projectSlug, boardSlug, ids)
        setCards(loaded)
      }
    } finally { setLoading(false) }
  }, [storage, projectSlug, boardSlug]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  // Load workspace members for assignees
  useEffect(() => {
    if (!db) return
    const users = db.query<DBUser>('SELECT github_login FROM users WHERE 1')
    setMembers(users.map(u => u.github_login))
  }, [db])

  // ─── Save helpers ──────────────────────────────────────────────────────────

  const saveBoardField = async (
    patch: Partial<Pick<Board, 'columns' | 'card_order' | 'labels'>>,
    currentSha: string,
  ): Promise<string> => {
    if (!boardSvc || !board || !projectSlug || !boardSlug) return currentSha
    setSaving(true)
    try {
      let newSha = currentSha
      if (patch.columns !== undefined) {
        const r = await boardSvc.saveColumns(projectSlug, boardSlug, patch.columns, currentSha)
        newSha = r.sha
      } else if (patch.card_order !== undefined) {
        const r = await boardSvc.saveCardOrder(projectSlug, boardSlug, patch.card_order, currentSha)
        newSha = r.sha
      } else if (patch.labels !== undefined) {
        const r = await boardSvc.saveLabels(projectSlug, boardSlug, patch.labels, currentSha)
        newSha = r.sha
      }
      setBoardSha(newSha)
      setBoard(prev => prev ? { ...prev, ...patch } : prev)
      return newSha
    } finally { setSaving(false) }
  }

  // ─── Card CRUD ─────────────────────────────────────────────────────────────

  const { user } = useAuth()

  const createCard = async (colId: string, title: string) => {
    if (!cardSvc || !user || !board || !projectSlug || !boardSlug) return
    setSaving(true)
    try {
      const meta = await cardSvc.createCard(projectSlug, boardSlug, title, user.githubLogin)
      // Append to column in board.json
      const newOrder = {
        ...localOrder,
        [colId]: [...(localOrder[colId] ?? []), meta.id],
      }
      const newSha = await saveBoardField({ card_order: newOrder }, boardSha)
      setLocalOrder(newOrder)
      setCards(prev => ({ ...prev, [meta.id]: { data: meta, sha: '' } }))
      // Reload to get SHA of meta.json
      const entry = await cardSvc.loadCards(projectSlug, boardSlug, [meta.id])
      setCards(prev => ({ ...prev, ...entry }))
      setBoardSha(newSha)
    } finally { setSaving(false) }
  }

  const handleCardSave = async (
    cardId: string,
    updates: Partial<CardMeta>,
    sha: string,
  ): Promise<{ sha: string }> => {
    if (!cardSvc || !projectSlug || !boardSlug) return { sha }
    const result = await cardSvc.updateCard(projectSlug, boardSlug, cardId, updates, sha)
    setCards(prev => prev[cardId]
      ? { ...prev, [cardId]: { data: { ...prev[cardId].data, ...updates }, sha: result.sha } }
      : prev
    )
    return result
  }

  const handleCardArchive = async (cardId: string, sha: string) => {
    if (!cardSvc || !projectSlug || !boardSlug) return
    await cardSvc.setArchived(projectSlug, boardSlug, cardId, sha, true)
    // Remove from card_order
    const newOrder: Record<string, string[]> = {}
    for (const [col, ids] of Object.entries(localOrder)) {
      newOrder[col] = ids.filter(id => id !== cardId)
    }
    await saveBoardField({ card_order: newOrder }, boardSha)
    setLocalOrder(newOrder)
    setCards(prev => {
      const next = { ...prev }
      delete next[cardId]
      return next
    })
    setOpenCardId(null)
  }

  // ─── Column ops ────────────────────────────────────────────────────────────

  const addColumn = async (name: string) => {
    if (!board) return
    const col: Column = { id: generateId(), name, color: '#64748b' }
    const newCols  = [...board.columns, col]
    const newOrder = { ...localOrder, [col.id]: [] }
    await saveBoardField({ columns: newCols }, boardSha)
    const newSha = await saveBoardField({ card_order: newOrder }, boardSha)
    setLocalOrder(newOrder)
    setBoardSha(newSha)
  }

  const renameColumn = async (colId: string, name: string) => {
    if (!board) return
    const cols = board.columns.map(c => c.id === colId ? { ...c, name } : c)
    await saveBoardField({ columns: cols }, boardSha)
  }

  const colorColumn = async (colId: string, color: string) => {
    if (!board) return
    const cols = board.columns.map(c => c.id === colId ? { ...c, color } : c)
    await saveBoardField({ columns: cols }, boardSha)
  }

  const removeColumn = async (colId: string) => {
    if (!board) return
    const cols     = board.columns.filter(c => c.id !== colId)
    const newOrder = { ...localOrder }
    delete newOrder[colId]
    await saveBoardField({ columns: cols }, boardSha)
    await saveBoardField({ card_order: newOrder }, boardSha)
    setLocalOrder(newOrder)
  }

  // ─── Labels ────────────────────────────────────────────────────────────────

  const handleSaveLabels = async (labels: Label[]) => {
    await saveBoardField({ labels }, boardSha)
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragStart = ({ active }: DragStartEvent) => {
    const type = active.data.current?.type as 'card' | 'column'
    setActiveId(active.id as string)
    setActiveType(type)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || activeType !== 'card') return
    const activeId = active.id as string
    const overId   = over.id as string
    const srcCol   = findCardColumn(activeId, localOrder)
    const dstCol   = findCardColumn(overId, localOrder) ?? overId // overId may be a column
    if (!srcCol || srcCol === dstCol) return

    setLocalOrder(prev => {
      const next      = { ...prev }
      next[srcCol]    = prev[srcCol].filter(id => id !== activeId)
      const dstCards  = [...(prev[dstCol] ?? [])]
      const overIdx   = dstCards.indexOf(overId)
      if (overIdx >= 0) dstCards.splice(overIdx, 0, activeId)
      else dstCards.push(activeId)
      next[dstCol] = dstCards
      return next
    })
  }

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null); setActiveType(null)
    if (!over || !board) return
    const aId = active.id as string
    const oId = over.id  as string

    if (activeType === 'column') {
      const oldIdx = board.columns.findIndex(c => c.id === aId)
      const newIdx = board.columns.findIndex(c => c.id === oId)
      if (oldIdx !== newIdx) {
        const cols = arrayMove(board.columns, oldIdx, newIdx)
        await saveBoardField({ columns: cols }, boardSha)
      }
      return
    }

    if (activeType === 'card') {
      // Same-column sort
      const col = findCardColumn(aId, localOrder)
      if (col) {
        const oldIdx = localOrder[col].indexOf(aId)
        const newIdx = localOrder[col].indexOf(oId)
        let finalOrder = localOrder
        if (oldIdx !== newIdx && newIdx >= 0) {
          finalOrder = { ...localOrder, [col]: arrayMove(localOrder[col], oldIdx, newIdx) }
          setLocalOrder(finalOrder)
        }
        await saveBoardField({ card_order: finalOrder }, boardSha)
      } else {
        await saveBoardField({ card_order: localOrder }, boardSha)
      }
    }
  }

  const onDragCancel = () => {
    setActiveId(null); setActiveType(null)
    if (board) setLocalOrder(board.card_order)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-surface-800 border-t-brand-400" />
    </div>
  )
  if (!board) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="text-surface-200/40">Board not found</p>
      <Link to={`/projects/${projectSlug}`} className="btn-ghost text-xs">← Back</Link>
    </div>
  )

  const openCard = openCardId ? cards[openCardId] : null

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-white/5 px-6 py-3 flex-shrink-0 flex-wrap gap-y-2">
        <Link to={`/projects/${projectSlug}`}
          className="text-xs text-surface-200/40 hover:text-surface-200 transition-colors">
          ← {projectSlug}
        </Link>
        <span className="text-surface-200/20">/</span>
        <h1 className="font-semibold text-surface-50 text-sm">{board.name}</h1>

        <div className="ml-auto flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-surface-200/30">
              <span className="h-3 w-3 animate-spin rounded-full border border-surface-200/30 border-t-surface-200/60" />
              Saving…
            </span>
          )}
          <button onClick={() => setLabelMgrOpen(true)} className="btn-ghost text-xs">
            🏷 Labels
          </button>
        </div>
      </div>

      {/* ── Board canvas ─────────────────────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-4 gap-3">
          <SortableContext items={board.columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {board.columns.map(col => (
              <BoardColumn
                key={col.id}
                column={col}
                cardIds={localOrder[col.id] ?? []}
                cards={cards}
                labels={board.labels}
                onCardClick={id => setOpenCardId(id)}
                onAddCard={title => createCard(col.id, title)}
                onRename={name => renameColumn(col.id, name)}
                onColorChange={color => colorColumn(col.id, color)}
                onRemove={() => removeColumn(col.id)}
              />
            ))}
          </SortableContext>

          {/* Add column */}
          <AddColumnButton onAdd={addColumn} />
          <div className="flex-shrink-0 w-4" />
        </div>

        {/* DragOverlay — ghost while dragging */}
        <DragOverlay>
          {activeId && activeType === 'card' && cards[activeId] && (
            <div className="w-64 rotate-2 scale-105">
              <CardMiniature
                card={cards[activeId].data}
                labels={board.labels}
                onClick={() => {}}
              />
            </div>
          )}
          {activeId && activeType === 'column' && (() => {
            const col = board.columns.find(c => c.id === activeId)
            return col ? (
              <div className="w-64 opacity-80 rounded-2xl bg-surface-800 border border-white/10 h-40" />
            ) : null
          })()}
        </DragOverlay>
      </DndContext>

      {/* ── Card Modal ───────────────────────────────────────────────────────── */}
      {openCard && (
        <CardModal
          card={openCard.data}
          sha={openCard.sha}
          labels={board.labels}
          members={members}
          onSave={(updates, sha) => handleCardSave(openCardId!, updates, sha)}
          onArchive={sha => handleCardArchive(openCardId!, sha)}
          onClose={() => setOpenCardId(null)}
        />
      )}

      {/* ── Label Manager ────────────────────────────────────────────────────── */}
      <LabelManager
        open={labelMgrOpen}
        onClose={() => setLabelMgrOpen(false)}
        labels={board.labels}
        onSave={handleSaveLabels}
      />
    </div>
  )
}

// ─── BoardColumn ──────────────────────────────────────────────────────────────

interface ColProps {
  column:        Column
  cardIds:       string[]
  cards:         Record<string, CardEntry>
  labels:        Label[]
  onCardClick:   (id: string) => void
  onAddCard:     (title: string) => void
  onRename:      (name: string) => void
  onColorChange: (color: string) => void
  onRemove:      () => void
}

function BoardColumn({
  column, cardIds, cards, labels,
  onCardClick, onAddCard, onRename, onColorChange, onRemove,
}: ColProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id, data: { type: 'column' } })

  const style = { transform: CSS.Transform.toString(transform), transition }

  const [menuOpen,   setMenuOpen]   = useState(false)
  const [renaming,   setRenaming]   = useState(false)
  const [renameVal,  setRenameVal]  = useState(column.name)
  const [addingCard, setAddingCard] = useState(false)
  const [newTitle,   setNewTitle]   = useState('')
  const newCardRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (addingCard) newCardRef.current?.focus() }, [addingCard])

  const submitRename = () => {
    if (renameVal.trim()) onRename(renameVal.trim())
    setRenaming(false)
  }

  const submitAdd = () => {
    if (newTitle.trim()) onAddCard(newTitle.trim())
    setNewTitle(''); setAddingCard(false)
  }

  const visibleIds = cardIds.filter(id => cards[id] && !cards[id].data.archived)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex-shrink-0 w-64 flex flex-col rounded-2xl bg-surface-800 border border-white/5
                  max-h-full ${isDragging ? 'opacity-40' : ''}`}
    >
      {/* Column header — drag handle */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />

        {renaming ? (
          <input
            type="text" value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={submitRename}
            onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(false) }}
            className="input py-0.5 px-1.5 h-auto text-sm flex-1"
            autoFocus
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-surface-50 truncate">{column.name}</span>
        )}

        <span className="text-xs text-surface-200/30 flex-shrink-0">{visibleIds.length}</span>

        {/* Column menu */}
        <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
          <button onClick={() => setMenuOpen(v => !v)}
            className="h-6 w-6 flex items-center justify-center rounded-lg
                       text-surface-200/20 hover:bg-white/5 hover:text-surface-200 transition-all">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-7 z-30 w-44 rounded-2xl bg-surface-850 border border-white/5 shadow-modal py-1 animate-fade-in">
              <button onClick={() => { setRenaming(true); setMenuOpen(false) }}
                className="flex w-full items-center px-3 py-2 text-sm text-surface-200/70 hover:bg-white/5 hover:text-surface-50">
                Rename
              </button>
              <div className="px-3 py-2 border-t border-white/5">
                <p className="text-xs text-surface-200/30 mb-2">Color</p>
                <div className="flex flex-wrap gap-1.5">
                  {COLUMN_COLORS.map(c => (
                    <button key={c} onClick={() => { onColorChange(c); setMenuOpen(false) }}
                      className="h-5 w-5 rounded-full hover:scale-110 transition-transform"
                      style={{ backgroundColor: c, outline: column.color===c ? `2px solid ${c}` : undefined, outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
              <div className="border-t border-white/5">
                <button onClick={() => { onRemove(); setMenuOpen(false) }}
                  className="flex w-full items-center px-3 py-2 text-sm text-accent-red/70 hover:bg-accent-red/5 hover:text-accent-red">
                  Remove column
                </button>
              </div>
              <div className="fixed inset-0 -z-10" onClick={() => setMenuOpen(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Cards area */}
      <div className="flex-1 overflow-y-auto px-2 pb-1 min-h-[40px]">
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 py-1">
            {visibleIds.map(id => (
              <SortableCard
                key={id}
                id={id}
                card={cards[id].data}
                labels={labels}
                onClick={() => onCardClick(id)}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      {/* Add card */}
      <div className="px-2 pb-2 flex-shrink-0">
        {addingCard ? (
          <div className="space-y-1.5">
            <input
              ref={newCardRef}
              type="text"
              placeholder="Card title…"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitAdd()
                if (e.key === 'Escape') { setAddingCard(false); setNewTitle('') }
              }}
              className="input text-sm w-full"
            />
            <div className="flex gap-1.5">
              <button onClick={submitAdd} className="btn-primary flex-1 py-1 text-xs">Add card</button>
              <button onClick={() => { setAddingCard(false); setNewTitle('') }} className="btn-ghost py-1 text-xs px-2">✕</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingCard(true)}
            className="flex w-full items-center gap-1.5 rounded-xl px-2 py-1.5
                       text-xs text-surface-200/30 hover:bg-white/5 hover:text-surface-200/60 transition-all">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add card
          </button>
        )}
      </div>
    </div>
  )
}

// ─── AddColumnButton ──────────────────────────────────────────────────────────

function AddColumnButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const submit = () => {
    if (name.trim()) { onAdd(name.trim()); setName('') }
    setOpen(false)
  }

  return (
    <div className="flex-shrink-0 w-64">
      {open ? (
        <div className="rounded-2xl bg-surface-800 border border-white/5 p-3 space-y-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Column name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false) }}
            className="input text-sm"
          />
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary flex-1 py-1.5 text-xs">Add column</button>
            <button onClick={() => setOpen(false)} className="btn-ghost py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-white/10
                     px-4 py-3 text-sm text-surface-200/30 hover:border-white/20 hover:text-surface-200/60 transition-all">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add column
        </button>
      )}
    </div>
  )
}
