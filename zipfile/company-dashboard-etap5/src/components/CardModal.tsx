/**
 * CardModal.tsx — Etap 5
 *
 * - All fields are LOCAL STATE — no auto-save on blur/change
 * - Explicit "Save card" button → single commit to meta.json
 * - Close → discard unsaved changes (no prompt)
 * - CardEditorPanel integrated at the bottom
 */

import { useState, useEffect } from 'react'
import { CardEditorPanel } from './editor/CardEditorPanel'
import type { CardMeta, Label } from '../lib/types'
import type { GitHubStorage } from '../lib/GitHubStorage'
import { generateId } from '../lib/utils'

interface Props {
  card:         CardMeta
  sha:          string
  labels:       Label[]
  members:      string[]
  projectSlug:  string
  boardSlug:    string
  storage:      GitHubStorage
  onSave:       (updates: Partial<CardMeta>, sha: string) => Promise<{ sha: string }>
  onArchive:    (sha: string) => Promise<void>
  onClose:      () => void
}

const PRIORITY_OPTIONS = [
  { value: 'none',   label: 'None',   color: 'text-surface-200/40' },
  { value: 'low',    label: 'Low',    color: 'text-accent-cyan' },
  { value: 'medium', label: 'Medium', color: 'text-accent-amber' },
  { value: 'high',   label: 'High',   color: 'text-accent-red' },
] as const

export function CardModal({
  card, sha: initialSha, labels, members,
  projectSlug, boardSlug, storage,
  onSave, onArchive, onClose,
}: Props) {
  // ── Local state (no auto-save) ──────────────────────────────────────────
  const [title,       setTitle]       = useState(card.title)
  const [description, setDescription] = useState(card.description)
  const [labelIds,    setLabelIds]    = useState<string[]>(card.label_ids)
  const [assignees,   setAssignees]   = useState<string[]>(card.assignees)
  const [dueDate,     setDueDate]     = useState(card.due_date ?? '')
  const [priority,    setPriority]    = useState(card.priority)
  const [checklist,   setChecklist]   = useState(card.checklist)
  const [newItem,     setNewItem]     = useState('')
  const [saving,      setSaving]      = useState(false)
  const [archiving,   setArchiving]   = useState(false)
  const [currentSha,  setCurrentSha]  = useState(initialSha)
  const [hasChanges,  setHasChanges]  = useState(false)

  // Track changes
  useEffect(() => { setHasChanges(true) }, [title, description, labelIds, assignees, dueDate, priority, checklist])

  // Close on Escape (discard)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // ── Save (explicit) ─────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await onSave({
        title:       title.trim() || card.title,
        description, label_ids: labelIds,
        assignees,   due_date: dueDate || null,
        priority,    checklist,
      }, currentSha)
      setCurrentSha(result.sha)
      setHasChanges(false)
    } finally { setSaving(false) }
  }

  const handleArchive = async () => {
    setArchiving(true)
    try { await onArchive(currentSha); onClose() }
    finally { setArchiving(false) }
  }

  const toggleLabel = (id: string) =>
    setLabelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleAssignee = (login: string) =>
    setAssignees(prev => prev.includes(login) ? prev.filter(x => x !== login) : [...prev, login])

  const addCheckItem = () => {
    if (!newItem.trim()) return
    setChecklist(prev => [...prev, { id: generateId(), text: newItem.trim(), done: false }])
    setNewItem('')
  }

  const toggleCheck = (id: string) =>
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i))

  const removeCheck = (id: string) =>
    setChecklist(prev => prev.filter(i => i.id !== id))

  const checkedCount = checklist.filter(i => i.done).length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-[3vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — large */}
      <div className="relative w-full max-w-5xl bg-surface-800 border border-white/5
                      shadow-modal animate-slide-up rounded-3xl flex flex-col
                      h-[94vh] overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-white/5 flex-shrink-0">
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="flex-1 resize-none bg-transparent font-display text-lg font-bold
                       text-surface-50 outline-none leading-snug overflow-hidden"
            rows={1}
            placeholder="Card title"
            onInput={e => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = t.scrollHeight + 'px'
            }}
          />
          <button onClick={onClose}
            className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg
                       text-surface-200/30 hover:bg-white/5 hover:text-surface-200 transition-all mt-0.5">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* ── Body: metadata + editor ──────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">

          {/* Left: metadata ─────────────────────────────────────────────── */}
          <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-white/5
                          overflow-y-auto flex flex-col">
            <div className="flex-1 p-4 space-y-4">

              {/* Description */}
              <div>
                <p className="text-xs font-medium text-surface-200/40 mb-1.5">Description</p>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add a description…"
                  rows={3}
                  className="input resize-none text-sm w-full"
                />
              </div>

              {/* Labels */}
              {labels.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-surface-200/40 mb-1.5">Labels</p>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map(l => {
                      const active = labelIds.includes(l.id)
                      return (
                        <button key={l.id} onClick={() => toggleLabel(l.id)}
                          className={`badge transition-all border ${active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                          style={{ backgroundColor: l.color + '25', color: l.color, borderColor: active ? l.color + '60' : 'transparent' }}>
                          {l.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Assignees */}
              <div>
                <p className="text-xs font-medium text-surface-200/40 mb-1.5">Assignees</p>
                {members.length > 0 ? (
                  <div className="space-y-1">
                    {members.map(login => {
                      const active = assignees.includes(login)
                      return (
                        <button key={login} onClick={() => toggleAssignee(login)}
                          className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 transition-all
                                     ${active ? 'bg-brand-500/10 text-brand-400' : 'hover:bg-white/5 text-surface-200/60'}`}>
                          <img src={`https://github.com/${login}.png?size=32`} alt={login}
                            className="h-5 w-5 rounded-full flex-shrink-0" />
                          <span className="text-xs truncate flex-1 text-left">@{login}</span>
                          {active && (
                            <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ) : <p className="text-xs text-surface-200/30">No members</p>}
              </div>

              {/* Due date */}
              <div>
                <p className="text-xs font-medium text-surface-200/40 mb-1.5">Due date</p>
                <input type="date"
                  value={dueDate ? dueDate.substring(0, 10) : ''}
                  onChange={e => setDueDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className="input text-xs py-1.5 w-full" style={{ colorScheme: 'dark' }}
                />
                {dueDate && (
                  <button onClick={() => setDueDate('')}
                    className="mt-1 text-xs text-surface-200/30 hover:text-accent-red transition-colors">
                    Clear date
                  </button>
                )}
              </div>

              {/* Priority */}
              <div>
                <p className="text-xs font-medium text-surface-200/40 mb-1.5">Priority</p>
                <div className="grid grid-cols-2 gap-1">
                  {PRIORITY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setPriority(opt.value)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-all
                                 ${priority === opt.value ? `bg-white/10 ${opt.color}` : 'text-surface-200/30 hover:bg-white/5'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div>
                <p className="text-xs font-medium text-surface-200/40 mb-1.5">
                  Checklist
                  {checklist.length > 0 && <span className="ml-1.5 text-surface-200/30">{checkedCount}/{checklist.length}</span>}
                </p>

                {checklist.length > 0 && (
                  <>
                    <div className="h-1 w-full rounded-full bg-surface-850 mb-2">
                      <div className="h-1 rounded-full bg-accent-green transition-all"
                        style={{ width: checklist.length ? `${(checkedCount / checklist.length) * 100}%` : '0%' }} />
                    </div>
                    <div className="space-y-1 mb-2">
                      {checklist.map(item => (
                        <div key={item.id} className="flex items-center gap-2 group">
                          <button onClick={() => toggleCheck(item.id)}
                            className={`flex-shrink-0 h-4 w-4 rounded border transition-all
                                       ${item.done ? 'bg-accent-green border-accent-green' : 'border-white/20 hover:border-white/40'}`}>
                            {item.done && (
                              <svg className="h-3 w-3 text-white m-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            )}
                          </button>
                          <span className={`text-xs flex-1 ${item.done ? 'line-through text-surface-200/30' : 'text-surface-50'}`}>
                            {item.text}
                          </span>
                          <button onClick={() => removeCheck(item.id)}
                            className="opacity-0 group-hover:opacity-100 h-4 w-4 flex items-center justify-center
                                       rounded text-surface-200/20 hover:text-accent-red transition-all">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6 6 18M6 6l12 12"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex gap-1.5">
                  <input type="text" placeholder="Add item…" value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCheckItem()}
                    className="input text-xs flex-1 py-1" />
                  <button onClick={addCheckItem} disabled={!newItem.trim()} className="btn-ghost py-1 text-xs px-2">Add</button>
                </div>
              </div>
            </div>

            {/* Save + archive */}
            <div className="border-t border-white/5 p-4 space-y-2 flex-shrink-0">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`btn-primary w-full ${!hasChanges && !saving ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white" />
                    Saving…
                  </span>
                ) : hasChanges ? '● Save card' : 'Saved ✓'}
              </button>

              <button onClick={handleArchive} disabled={archiving}
                className={`w-full text-xs py-1.5 rounded-xl transition-colors
                           ${card.archived
                             ? 'text-accent-green/70 hover:text-accent-green hover:bg-accent-green/5'
                             : 'text-surface-200/30 hover:text-accent-red hover:bg-accent-red/5'}`}>
                {archiving ? 'Working…' : card.archived ? 'Restore card' : 'Archive card'}
              </button>
            </div>
          </div>

          {/* Right: editor panel ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <CardEditorPanel
              projectSlug={projectSlug}
              boardSlug={boardSlug}
              cardId={card.id}
              cardTitle={card.title}
              storage={storage}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
