import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import type { Board } from '../lib/types'

interface Props {
  open:     boolean
  onClose:  () => void
  onSubmit: (data: Pick<Board, 'name' | 'description'>) => Promise<void>
  initial?: Partial<Board>
  title?:   string
}

export function CreateBoardModal({ open, onClose, onSubmit, initial, title }: Props) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setDescription(initial?.description ?? '')
      setError('')
    }
  }, [open, initial])

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Board name is required'); return }
    setSaving(true); setError('')
    try {
      await onSubmit({ name: name.trim(), description: description.trim() })
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
      title={title ?? 'New board'}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={saving}>Cancel</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : (title ? 'Save' : 'Create board')}
          </button>
        </>
      }
    >
      {error && (
        <p className="rounded-xl bg-accent-red/10 px-3 py-2 text-xs text-accent-red">{error}</p>
      )}
      <input
        type="text"
        placeholder="Board name"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        className="input"
        autoFocus
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="input resize-none"
        rows={2}
      />
    </Modal>
  )
}
