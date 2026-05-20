import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { generateId } from '../lib/utils'
import type { Label } from '../lib/types'

const PRESET_COLORS = [
  '#ef4444','#f97316','#f59e0b','#84cc16',
  '#22c55e','#14b8a6','#3b82f6','#8b5cf6',
  '#ec4899','#64748b',
]

interface Props {
  open:     boolean
  onClose:  () => void
  labels:   Label[]
  onSave:   (labels: Label[]) => Promise<void>
}

export function LabelManager({ open, onClose, labels, onSave }: Props) {
  const [local,   setLocal]   = useState<Label[]>(labels)
  const [newName, setNewName] = useState('')
  const [newColor,setNewColor]= useState(PRESET_COLORS[6])
  const [editId,  setEditId]  = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (!open) return
    setLocal(labels)
    setEditId(null)
    setNewName('')
    setNewColor(PRESET_COLORS[6])
  }, [open, labels])

  const addLabel = () => {
    if (!newName.trim()) return
    setLocal(prev => [...prev, { id: generateId(), name: newName.trim(), color: newColor }])
    setNewName(''); setNewColor(PRESET_COLORS[6])
  }

  const updateLabel = (id: string, patch: Partial<Label>) =>
    setLocal(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))

  const removeLabel = (id: string) =>
    setLocal(prev => prev.filter(l => l.id !== id))

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(local); onClose() }
    finally { setSaving(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Labels"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={saving}>Cancel</button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div>
        {/* Existing labels */}
        {local.length > 0 && (
          <ul className="space-y-2 mb-4">
            {local.map(label => (
              <li key={label.id} className="flex items-center gap-2">
                {editId === label.id ? (
                  <>
                    <input
                      type="text"
                      value={label.name}
                      onChange={e => updateLabel(label.id, { name: e.target.value })}
                      className="input flex-1 py-1"
                      autoFocus
                      onBlur={() => setEditId(null)}
                      onKeyDown={e => e.key === 'Enter' && setEditId(null)}
                    />
                    <ColorDot
                      color={label.color}
                      onChange={c => updateLabel(label.id, { color: c })}
                    />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditId(label.id)}
                      className="flex flex-1 items-center gap-2 rounded-xl px-2 py-1
                                 hover:bg-white/5 text-left transition-colors group"
                    >
                      <span
                        className="h-4 w-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="text-sm text-surface-50 flex-1">{label.name}</span>
                      <svg className="h-3.5 w-3.5 text-surface-200/20 group-hover:text-surface-200/50 transition-colors"
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => removeLabel(label.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg
                                 text-surface-200/20 hover:bg-accent-red/10 hover:text-accent-red transition-all"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Add new label */}
        <div className="flex items-center gap-2 border-t border-white/5 pt-4">
          <ColorDot color={newColor} onChange={setNewColor} />
          <input
            type="text"
            placeholder="Label name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addLabel()}
            className="input flex-1 py-1"
          />
          <button
            onClick={addLabel}
            disabled={!newName.trim()}
            className="btn-primary py-1 px-3 text-xs flex-shrink-0"
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Color picker dot with popover. */
function ColorDot({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="h-6 w-6 rounded-full transition-transform hover:scale-110"
        style={{ backgroundColor: color }}
      />
      {open && (
        <div className="absolute left-0 top-8 z-30 flex flex-wrap gap-1.5 w-36
                        rounded-xl bg-surface-850 border border-white/5 p-2 shadow-modal">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false) }}
              className="h-5 w-5 rounded-full transition-transform hover:scale-125"
              style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : undefined, outlineOffset: 2 }}
            />
          ))}
          <div className="fixed inset-0 -z-10" onClick={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
