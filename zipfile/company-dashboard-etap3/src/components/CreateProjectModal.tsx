import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { PROJECT_COLORS } from '../lib/utils'
import type { Project } from '../lib/types'

interface Props {
  open:      boolean
  onClose:   () => void
  onSubmit:  (data: Pick<Project, 'name' | 'description' | 'color' | 'emoji'>) => Promise<void>
  initial?:  Partial<Project>
  title?:    string
}

export function CreateProjectModal({ open, onClose, onSubmit, initial, title }: Props) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [color,       setColor]       = useState<string>(PROJECT_COLORS[6])   // blue default
  const [emoji,       setEmoji]       = useState('📋')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  // Populate form when editing
  useEffect(() => {
    if (open) {
      setName(initial?.name        ?? '')
      setDescription(initial?.description ?? '')
      setColor(initial?.color      ?? PROJECT_COLORS[6])
      setEmoji(initial?.emoji      ?? '📋')
      setError('')
    }
  }, [open, initial])

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Project name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), color, emoji })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? 'New project'}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={saving}>Cancel</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : (title ? 'Save changes' : 'Create project')}
          </button>
        </>
      }
    >
      {error && (
        <p className="rounded-xl bg-accent-red/10 px-3 py-2 text-xs text-accent-red">{error}</p>
      )}

      {/* Emoji + Name row */}
      <div className="flex gap-3">
        <div className="relative">
          <input
            type="text"
            value={emoji}
            onChange={e => setEmoji(e.target.value)}
            className="input w-14 text-center text-xl"
            maxLength={2}
            title="Project emoji"
          />
        </div>
        <input
          type="text"
          placeholder="Project name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="input flex-1"
          autoFocus
        />
      </div>

      {/* Description */}
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="input min-h-[72px] resize-none"
        rows={3}
      />

      {/* Color picker */}
      <div>
        <p className="mb-2 text-xs text-surface-200/40">Accent color</p>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full ring-offset-2 ring-offset-surface-800 transition-all"
              style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div
        className="flex items-center gap-3 rounded-2xl border border-white/5 p-3"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        <span className="text-xl">{emoji || '📋'}</span>
        <div>
          <p className="text-sm font-medium text-surface-50">{name || 'Project name'}</p>
          <p className="text-xs text-surface-200/40">{description || 'No description'}</p>
        </div>
      </div>
    </Modal>
  )
}
