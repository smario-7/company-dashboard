/**
 * BoardPage.tsx — Etap 5
 *
 * Save strategy:
 *  - Card creation → immediate commit (new file created)
 *  - Drag & drop, column changes, labels → localBoard (pending)
 *  - "Save" button in topbar → single commit of entire board.json
 *  - Card modal changes → explicit Save in modal
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
import type { Board, Column, Label, CardMeta } from '../lib/types'

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

export function BoardPage() {
  const { projectSlug, boardSlug } = useParams<{ projectSlug: string; boardSlug: string }>()
  const { storage, settings, user } = useAuth()

  const [board,          setBoard]          = useState<Board | null>(null)
  const [localBoard,     setLocalBoard]     = useState<Board | null>(null) // unsaved local state
  const [boardSha,       setBoardSha]       = useState('')
  const [cards,          setCards]          = useState<Record<string, CardEntry>>({})
  const [localOrder,     setLocalOrder]     = useState<Record<string, string[]>>({})
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [pendingChanges, setPendingChanges] = useState(false)
  const [members,        setMembers]        = useState<string[]>([])
  const [openCardId,     setOpenCardId]     = useState<string | null>(null)
  const [labelMgrOpen,   setLabelMgrOpen]   = useState(false)
  const [activeId,       setActiveId]       = useState<string | null>(null)
  const [activeType,     setActiveType]     = useState<'card' | 'column' | null>(null)

  const boardSvc = storage ? new BoardService(storage) : null
  const cardSvc  = storage ? new CardService(storage)  : null

  // ─── Load ───────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!boardSvc || !projectSlug || !boardSlug) return
    setLoading(true)
    try {
      const result = await boardSvc.getBoard(projectSlug, boardSlug)
      if (!result) return
      const { data, sha } = result
      setBoard(data)
      setLocalBoard(data)
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

  useEffect(() => {
    void settings.getAllProfiles().then(profiles => {
      setMembers(profiles.map(p => p.github_login))
    })
  }, [settings])

  // ─── Save to GitHub (explicit) ──────────────────────────────────────────

  const saveToGitHub = async () => {
    if (!localBoard || !boardSvc || !projectSlug || !boardSlug) return
    setSaving(true)
    try {
      const result = await boardSvc.saveBoard(projectSlug, boardSlug, localBoard, boardSha)
      setBoardSha(result.sha)
      setBoard(localBoard)
      setPendingChanges(false)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed. Please refresh and try again.')
    } finally { setSaving(false) }
  }

  // Mutate localBoard (no API call) and mark pending
  const mutateBoard = (updater: (b: Board) => Board) => {
    setLocalBoard(prev => {
      if (!prev) return prev
      const updated = updater(prev)
      setLocalOrder(updated.card_order)
      return updated
    })
    setPendingChanges(true)
  }

  // ─── Card creation (always commits immediately) ─────────────────────────

  const createCard = async (colId: string, title: string) => {
    if (!cardSvc || !user || !localBoard || !projectSlug || !boardSlug) return
    setSaving(true)
    try {
      const meta  = await cardSvc.createCard(projectSlug, boardSlug, title, user!.github_login)
      const newOrder = {
        ...localBoard.card_order,
        [colId]: [...(localBoard.card_order[colId] ?? []), meta.id],
      }
      const updatedBoard = { ...localBoard, card_order: newOrder }
      // Commit immediately (new card always saves)
      const result = await boardSvc!.saveBoard(projectSlug, boardSlug, updatedBoard, boardSha)
      setBoardSha(result.sha)
      setBoard(updatedBoard)
      setLocalBoard(updatedBoard)
      setLocalOrder(newOrder)
      setPendingChanges(false)

      // Load card meta SHA
      const entry = await cardSvc.loadCards(projectSlug, boardSlug, [meta.id])
      setCards(prev => ({ ...prev, ...entry }))
    } finally { setSaving(false) }
  }

  // ─── Card save / archive ────────────────────────────────────────────────

  const handleCardSave = async (cardId: string, updates: Partial<CardMeta>, sha: string): Promise<{ sha: string }> => {
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
    mutateBoard(b => {
      const newOrder: Record<string, string[]> = {}
      for (const [col, ids] of Object.entries(b.card_order)) {
        newOrder[col] = ids.filter(id => id !== cardId)
      }
      return { ...b, card_order: newOrder }
    })
    setCards(prev => { const n = { ...prev }; delete n[cardId]; return n })
    setOpenCardId(null)
    // Archive also needs immediate save (card removed from order)
    await saveToGitHub()
  }

  // ─── Column operations (all pending) ────────────────────────────────────

  const addColumn = (name: string) => {
    const col: Column = { id: generateId(), name, color: '#64748b' }
    mutateBoard(b => ({
      ...b,
      columns:    [...b.columns, col],
      card_order: { ...b.card_order, [col.id]: [] },
    }))
  }

  const renameColumn = (colId: string, name: string) =>
    mutateBoard(b => ({ ...b, columns: b.columns.map(c => c.id === colId ? { ...c, name } : c) }))

  const colorColumn = (colId: string, color: string) =>
    mutateBoard(b => ({ ...b, columns: b.columns.map(c => c.id === colId ? { ...c, color } : c) }))

  const removeColumn = (colId: string) =>
    mutateBoard(b => {
      const columns   = b.columns.filter(c => c.id !== colId)
      const cardOrder = { ...b.card_order }
      delete cardOrder[colId]
      return { ...b, columns, card_order: cardOrder }
    })

  // ─── Labels (pending) ────────────────────────────────────────────────────

  const handleSaveLabels = async (labels: Label[]) => {
    mutateBoard(b => ({ ...b, labels }))
  }

  // ─── Drag & Drop ─────────────────────────────────────────────────────────

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
    const dstCol   = findCardColumn(overId, localOrder) ?? overId
    if (!srcCol || srcCol === dstCol) return

    setLocalOrder(prev => {
      const next     = { ...prev }
      next[srcCol]   = prev[srcCol].filter(id => id !== activeId)
      const dstCards = [...(prev[dstCol] ?? [])]
      const overIdx  = dstCards.indexOf(overId)
      if (overIdx >= 0) dstCards.splice(overIdx, 0, activeId)
      else dstCards.push(activeId)
      next[dstCol] = dstCards
      return next
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null); setActiveType(null)
    if (!over || !localBoard) return
    const aId = active.id as string
    const oId = over.id  as string

    if (activeType === 'column') {
      const oldIdx = localBoard.columns.findIndex(c => c.id === aId)
      const newIdx = localBoard.columns.findIndex(c => c.id === oId)
      if (oldIdx !== newIdx) {
        mutateBoard(b => ({ ...b, columns: arrayMove(b.columns, oldIdx, newIdx) }))
      }
      return
    }

    if (activeType === 'card') {
      const col = findCardColumn(aId, localOrder)
      if (col) {
        const oldIdx = localOrder[col].indexOf(aId)
        const newIdx = localOrder[col].indexOf(oId)
        if (oldIdx !== newIdx && newIdx >= 0) {
          const newColOrder = arrayMove(localOrder[col], oldIdx, newIdx)
          setLocalOrder(prev => ({ ...prev, [col]: newColOrder }))
          setLocalBoard(prev => prev ? { ...prev, card_order: { ...prev.card_order, [col]: newColOrder } } : prev)
        } else {
          setLocalBoard(prev => prev ? { ...prev, card_order: localOrder } : prev)
        }
      }
      setPendingChanges(true)
    }
  }

  const onDragCancel = () => {
    setActiveId(null); setActiveType(null)
    if (board) { setLocalOrder(board.card_order); setLocalBoard(board) }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-surface-800 border-t-brand-400" />
    </div>
  )
  if (!localBoard) return (
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
        <h1 className="font-semibold text-surface-50 text-sm">{localBoard.name}</h1>

        <div className="ml-auto flex items-center gap-2">
          {pendingChanges && !saving && (
            <span className="text-xs text-accent-amber/70 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-amber" />
              Unsaved changes
            </span>
          )}
          <button onClick={() => setLabelMgrOpen(true)} className="btn-ghost text-xs">
            🏷 Labels
          </button>
          <button
            onClick={saveToGitHub}
            disabled={!pendingChanges || saving}
            className={`btn-primary text-xs py-1.5 px-3 ${!pendingChanges ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                Saving…
              </span>
            ) : 'Save →'}
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
          <SortableContext items={localBoard.columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {localBoard.columns.map(col => (
              <BoardColumn
                key={col.id}
                column={col}
                cardIds={localOrder[col.id] ?? []}
                cards={cards}
                labels={localBoard.labels}
                onCardClick={id => setOpenCardId(id)}
                onAddCard={title => createCard(col.id, title)}
                onRename={name => renameColumn(col.id, name)}
                onColorChange={color => colorColumn(col.id, color)}
                onRemove={() => removeColumn(col.id)}
              />
            ))}
          </SortableContext>
          <AddColumnButton onAdd={addColumn} />
          <div className="flex-shrink-0 w-4" />
        </div>

        <DragOverlay>
          {activeId && activeType === 'card' && cards[activeId] && (
            <div className="w-64 rotate-2 scale-105">
              <CardMiniature card={cards[activeId].data} labels={localBoard.labels} onClick={() => {}} />
            </div>
          )}
          {activeId && activeType === 'column' && (
            <div className="w-64 opacity-80 rounded-2xl bg-surface-800 border border-white/10 h-40" />
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Card Modal ───────────────────────────────────────────────────────── */}
      {openCard && storage && (
        <CardModal
          card={openCard.data}
          sha={openCard.sha}
          labels={localBoard.labels}
          members={members}
          projectSlug={projectSlug!}
          boardSlug={boardSlug!}
          storage={storage}
          onSave={(updates, sha) => handleCardSave(openCardId!, updates, sha)}
          onArchive={sha => handleCardArchive(openCardId!, sha)}
          onClose={() => setOpenCardId(null)}
        />
      )}

      {/* ── Label Manager ────────────────────────────────────────────────────── */}
      <LabelManager
        open={labelMgrOpen}
        onClose={() => setLabelMgrOpen(false)}
        labels={localBoard.labels}
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

function BoardColumn({ column, cardIds, cards, labels, onCardClick, onAddCard, onRename, onColorChange, onRemove }: ColProps) {
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
    <div ref={setNodeRef} style={style}
      className={`flex-shrink-0 w-64 flex flex-col rounded-2xl bg-surface-800 border border-white/5 max-h-full ${isDragging ? 'opacity-40' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing flex-shrink-0"
        {...attributes} {...listeners}>
        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />

        {renaming ? (
          <input type="text" value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={submitRename}
            onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(false) }}
            className="input py-0.5 px-1.5 h-auto text-sm flex-1"
            autoFocus onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-surface-50 truncate">{column.name}</span>
        )}

        <span className="text-xs text-surface-200/30 flex-shrink-0">{visibleIds.length}</span>

        <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
          <button onClick={() => setMenuOpen(v => !v)}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-surface-200/20 hover:bg-white/5 hover:text-surface-200 transition-all">
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
                      style={{ backgroundColor: c, outline: column.color === c ? `2px solid ${c}` : undefined, outlineOffset: 2 }} />
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

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-1 min-h-[40px]">
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 py-1">
            {visibleIds.map(id => (
              <SortableCard key={id} id={id} card={cards[id].data} labels={labels} onClick={() => onCardClick(id)} />
            ))}
          </div>
        </SortableContext>
      </div>

      {/* Add card */}
      <div className="px-2 pb-2 flex-shrink-0">
        {addingCard ? (
          <div className="space-y-1.5">
            <input ref={newCardRef} type="text" placeholder="Card title…" value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') { setAddingCard(false); setNewTitle('') } }}
              className="input text-sm w-full"
            />
            <div className="flex gap-1.5">
              <button onClick={submitAdd} className="btn-primary flex-1 py-1 text-xs">Add card</button>
              <button onClick={() => { setAddingCard(false); setNewTitle('') }} className="btn-ghost py-1 text-xs px-2">✕</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingCard(true)}
            className="flex w-full items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs text-surface-200/30 hover:bg-white/5 hover:text-surface-200/60 transition-all">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
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

  const submit = () => { if (name.trim()) { onAdd(name.trim()); setName('') } setOpen(false) }

  return (
    <div className="flex-shrink-0 w-64">
      {open ? (
        <div className="rounded-2xl bg-surface-800 border border-white/5 p-3 space-y-2">
          <input ref={inputRef} type="text" placeholder="Column name" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false) }}
            className="input text-sm" />
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary flex-1 py-1.5 text-xs">Add column</button>
            <button onClick={() => setOpen(false)} className="btn-ghost py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-surface-200/30 hover:border-white/20 hover:text-surface-200/60 transition-all">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          Add column
        </button>
      )}
    </div>
  )
}
