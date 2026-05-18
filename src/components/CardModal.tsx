/**
 * CardModal.tsx
 *
 * Full card editor. No comments/activity (Etap 5).
 * Sections: title, description, labels, assignees, due date, priority, checklist.
 */

import { useState, useEffect, useRef } from 'react'
import type { CardMeta, Label } from '../lib/types'
import { generateId } from '../lib/utils'

interface Props {
  card:      CardMeta
  sha:       string
  labels:    Label[]                // board-level labels
  members:   string[]               // github logins of workspace members
  onSave:    (updates: Partial<CardMeta>, sha: string) => Promise<{ sha: string }>
  onArchive: (sha: string) => Promise<void>
  onClose:   () => void
}

const PRIORITY_OPTIONS = [
  { value: 'none',   label: 'None',   color: 'text-surface-200/40' },
  { value: 'low',    label: 'Low',    color: 'text-accent-cyan' },
  { value: 'medium', label: 'Medium', color: 'text-accent-amber' },
  { value: 'high',   label: 'High',   color: 'text-accent-red' },
] as const

export function CardModal({ card, sha: initialSha, labels, members, onSave, onArchive, onClose }: Props) {
  const [title,       setTitle]       = useState(card.title)
  const [description, setDescription] = useState(card.description)
  const [labelIds,    setLabelIds]    = useState<string[]>(card.label_ids)
  const [assignees,   setAssignees]   = useState<string[]>(card.assignees)
  const [dueDate,     setDueDate]     = useState(card.due_date ?? '')
  const [priority,    setPriority]    = useState(card.priority)
  const [checklist,   setChecklist]   = useState(card.checklist)
  const [newCheckItem,setNewCheckItem]= useState('')
  const [currentSha,  setCurrentSha]  = useState(initialSha)
  const [saving,      setSaving]      = useState(false)
  const [archiving,   setArchiving]   = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize title textarea
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [title])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleSaveAndClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [title, description, labelIds, assignees, dueDate, priority, checklist, currentSha]) // eslint-disable-line

  const save = async (patch: Partial<CardMeta> = {}) => {
    const updates: Partial<CardMeta> = {
      title:       title.trim() || card.title,
      description, label_ids: labelIds,
      assignees,   due_date: dueDate || null,
      priority,    checklist,
      ...patch,
    }
    setSaving(true)
    try {
      const result = await onSave(updates, currentSha)
      setCurrentSha(result.sha)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndClose = async () => {
    await save()
    onClose()
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
    if (!newCheckItem.trim()) return
    setChecklist(prev => [...prev, { id: generateId(), text: newCheckItem.trim(), done: false }])
    setNewCheckItem('')
  }

  const toggleCheckItem = (id: string) =>
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i))

  const removeCheckItem = (id: string) =>
    setChecklist(prev => prev.filter(i => i.id !== id))

  const checkedCount = checklist.filter(i => i.done).length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[5vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSaveAndClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl rounded-3xl bg-surface-800 border border-white/5
                      shadow-modal animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col md:flex-row gap-0">

          {/* ── Left: main content ────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 p-6 space-y-5">
            {/* Title */}
            <textarea
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => save()}
              className="w-full resize-none bg-transparent font-display text-lg font-bold
                         text-surface-50 outline-none placeholder:text-surface-200/30
                         leading-snug overflow-hidden"
              rows={1}
              placeholder="Card title"
            />

            {/* Labels */}
            {labels.length > 0 && (
              <div>
                <p className="text-xs font-medium text-surface-200/40 mb-2">Labels</p>
                <div className="flex flex-wrap gap-2">
                  {labels.map(l => {
                    const active = labelIds.includes(l.id)
                    return (
                      <button
                        key={l.id}
                        onClick={() => { toggleLabel(l.id); save({ label_ids: labelIds.includes(l.id) ? labelIds.filter(x=>x!==l.id) : [...labelIds,l.id] }) }}
                        className={`badge transition-all ${active ? 'ring-2 ring-inset' : 'opacity-50 hover:opacity-80'}`}
                        style={{
                          backgroundColor: l.color + '25',
                          color: l.color,
                        }}
                      >
                        {l.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <p className="text-xs font-medium text-surface-200/40 mb-2">Description</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={() => save()}
                placeholder="Add a description…"
                rows={3}
                className="input resize-none text-sm"
              />
            </div>

            {/* Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-surface-200/40">
                  Checklist
                  {checklist.length > 0 && (
                    <span className="ml-2 text-surface-200/30">{checkedCount}/{checklist.length}</span>
                  )}
                </p>
              </div>

              {checklist.length > 0 && (
                <div className="space-y-1 mb-3">
                  {/* Progress bar */}
                  <div className="h-1 w-full rounded-full bg-surface-850 mb-3">
                    <div
                      className="h-1 rounded-full bg-accent-green transition-all"
                      style={{ width: checklist.length ? `${(checkedCount/checklist.length)*100}%` : '0%' }}
                    />
                  </div>
                  {checklist.map(item => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => { toggleCheckItem(item.id); save({ checklist: checklist.map(i => i.id===item.id ? {...i,done:!i.done} : i) }) }}
                        className={`flex-shrink-0 h-4 w-4 rounded border transition-all
                                   ${item.done
                                     ? 'bg-accent-green border-accent-green'
                                     : 'border-white/20 hover:border-white/40'}`}
                      >
                        {item.done && (
                          <svg className="h-3 w-3 text-white m-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                      <span className={`text-sm flex-1 ${item.done ? 'line-through text-surface-200/30' : 'text-surface-50'}`}>
                        {item.text}
                      </span>
                      <button
                        onClick={() => { removeCheckItem(item.id); save({ checklist: checklist.filter(i=>i.id!==item.id) }) }}
                        className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center
                                   rounded text-surface-200/30 hover:text-accent-red transition-all"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add item…"
                  value={newCheckItem}
                  onChange={e => setNewCheckItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCheckItem()}
                  className="input text-sm flex-1"
                />
                <button onClick={addCheckItem} disabled={!newCheckItem.trim()} className="btn-ghost text-xs px-3">
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────────── */}
          <div className="md:w-52 flex-shrink-0 border-t md:border-t-0 md:border-l border-white/5 p-5 space-y-4">
            {/* Close */}
            <div className="flex justify-end md:hidden">
              <button onClick={handleSaveAndClose} className="btn-ghost text-xs">Done</button>
            </div>

            {/* Assignees */}
            <div>
              <p className="text-xs font-medium text-surface-200/40 mb-2">Assignees</p>
              {members.length > 0 ? (
                <div className="space-y-1">
                  {members.map(login => {
                    const active = assignees.includes(login)
                    return (
                      <button
                        key={login}
                        onClick={() => { toggleAssignee(login); save({ assignees: assignees.includes(login) ? assignees.filter(x=>x!==login) : [...assignees,login] }) }}
                        className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 transition-all
                                   ${active ? 'bg-brand-500/10 text-brand-400' : 'hover:bg-white/5 text-surface-200/60'}`}
                      >
                        <img src={`https://github.com/${login}.png?size=32`} alt={login}
                          className="h-5 w-5 rounded-full flex-shrink-0" />
                        <span className="text-xs truncate">@{login}</span>
                        {active && (
                          <svg className="h-3 w-3 ml-auto flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-surface-200/30">No members yet</p>
              )}
            </div>

            {/* Due date */}
            <div>
              <p className="text-xs font-medium text-surface-200/40 mb-2">Due date</p>
              <input
                type="date"
                value={dueDate ? dueDate.substring(0, 10) : ''}
                onChange={e => {
                  const v = e.target.value
                  setDueDate(v)
                  save({ due_date: v ? new Date(v).toISOString() : null })
                }}
                className="input text-xs py-1.5 w-full"
                style={{ colorScheme: 'dark' }}
              />
              {dueDate && (
                <button
                  onClick={() => { setDueDate(''); save({ due_date: null }) }}
                  className="mt-1 text-xs text-surface-200/30 hover:text-accent-red transition-colors"
                >
                  Clear date
                </button>
              )}
            </div>

            {/* Priority */}
            <div>
              <p className="text-xs font-medium text-surface-200/40 mb-2">Priority</p>
              <div className="grid grid-cols-2 gap-1">
                {PRIORITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setPriority(opt.value); save({ priority: opt.value }) }}
                    className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-all
                               ${priority === opt.value
                                 ? `bg-white/10 ${opt.color}`
                                 : 'text-surface-200/30 hover:bg-white/5'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="divider" />

            {/* Save status */}
            {saving && (
              <p className="text-xs text-surface-200/30 flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border border-surface-200/20 border-t-surface-200/60" />
                Saving…
              </p>
            )}

            {/* Archive */}
            <button
              onClick={handleArchive}
              disabled={archiving}
              className={card.archived ? 'btn-ghost text-xs w-full' : 'btn-danger text-xs w-full'}
            >
              {archiving ? 'Working…' : card.archived ? 'Restore card' : 'Archive card'}
            </button>

            {/* Close (desktop) */}
            <button onClick={handleSaveAndClose} className="btn-ghost text-xs w-full hidden md:flex">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
