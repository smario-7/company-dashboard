import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { ActivityEntry } from '../lib/ActivityService'
import { formatRelativeTime } from '../lib/utils'

interface Props {
  cardId: string
}

function describeActivity(entry: ActivityEntry): string {
  const who = entry.actor?.display_name ?? entry.actor?.github_login ?? 'Someone'

  switch (entry.action) {
    case 'card_created':
      return `${who} created this card`
    case 'card_moved':
      return `${who} moved the card`
    case 'assignee_added':
      return `${who} assigned someone`
    case 'comment_added':
      return `${who} commented`
    default:
      return `${who} updated the card`
  }
}

export function CardActivity({ cardId }: Props) {
  const { activity } = useAuth()
  const [items, setItems]     = useState<ActivityEntry[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!expanded) return
    setLoading(true)
    void activity.listForCard(cardId).then(setItems).finally(() => setLoading(false))
  }, [cardId, expanded, activity])

  return (
    <div className="border-t border-white/5 pt-3">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="text-xs font-medium text-surface-200/40 hover:text-surface-200 transition-colors w-full text-left"
      >
        {expanded ? '▼' : '▶'} Activity
      </button>

      {expanded && (
        <ul className="mt-2 space-y-2 max-h-36 overflow-y-auto">
          {loading && <li className="text-xs text-surface-200/30">Loading…</li>}
          {!loading && items.length === 0 && (
            <li className="text-xs text-surface-200/30 italic">No activity yet</li>
          )}
          {items.map(e => (
            <li key={e.id} className="text-xs text-surface-200/50">
              <span className="text-surface-100">{describeActivity(e)}</span>
              {' · '}
              {formatRelativeTime(e.created_at)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
