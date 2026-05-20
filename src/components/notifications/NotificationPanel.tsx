import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { NotificationRow } from '../../lib/NotificationService'
import { formatRelativeTime } from '../../lib/utils'
import type { NotificationType } from '../../lib/types'

interface Props {
  onClose: () => void
}

function typeLabel(type: NotificationType): string {
  switch (type) {
    case 'card_assigned':      return 'Assignment'
    case 'comment_added':      return 'Comment'
    case 'mentioned':          return 'Mention'
    case 'due_date_reminder':  return 'Due date'
    case 'card_moved':         return 'Card moved'
    default:                   return 'Notification'
  }
}

function NotificationItem({
  row,
  onRead,
  onNavigate,
}: {
  row: NotificationRow
  onRead: (id: string) => void
  onNavigate: (row: NotificationRow) => void
}) {
  const actorName = row.actor?.display_name ?? row.actor?.github_login ?? 'Someone'
  const title = row.payload.card_title ?? 'Card'

  return (
    <button
      type="button"
      onClick={() => {
        if (!row.read) void onRead(row.id)
        onNavigate(row)
      }}
      className={`w-full text-left px-3 py-2.5 border-b border-white/5 transition-colors hover:bg-white/5 ${
        row.read ? 'opacity-60' : 'bg-brand-500/5'
      }`}
    >
      <div className="flex gap-2">
        {row.actor?.avatar_url && (
          <img src={row.actor.avatar_url} alt="" className="h-8 w-8 rounded-full flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-brand-400/80">
            {typeLabel(row.type)}
          </p>
          <p className="text-xs text-surface-50 line-clamp-2">
            <span className="font-medium">{actorName}</span>
            {' — '}
            {title}
          </p>
          <p className="text-[10px] text-surface-200/40 mt-0.5">
            {formatRelativeTime(row.created_at)}
          </p>
        </div>
        {!row.read && (
          <span className="h-2 w-2 rounded-full bg-brand-400 flex-shrink-0 mt-1" />
        )}
      </div>
    </button>
  )
}

export function NotificationPanel({ onClose }: Props) {
  const { notifications } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try {
      setItems(await notifications.list({ limit: 40 }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [notifications])

  const handleNavigate = (row: NotificationRow) => {
    const p = row.payload
    if (p.project && p.board && p.card_id) {
      navigate(`/projects/${p.project}/boards/${p.board}?card=${p.card_id}`)
    }
    onClose()
  }

  const today = new Date().toDateString()
  const todayItems = items.filter(i => new Date(i.created_at).toDateString() === today)
  const olderItems = items.filter(i => new Date(i.created_at).toDateString() !== today)

  return (
    <div className="absolute right-0 top-full mt-2 w-80 max-h-[min(24rem,70vh)]
                    rounded-2xl border border-white/10 bg-surface-800 shadow-modal
                    overflow-hidden z-50 flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <span className="text-sm font-semibold text-surface-50">Notifications</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => void notifications.markAllRead().then(refresh)}
            className="text-[10px] text-brand-400 hover:underline px-1"
          >
            Mark all read
          </button>
          <button type="button" onClick={onClose} className="text-surface-200/40 hover:text-surface-200 px-1">
            ✕
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {loading && (
          <p className="p-4 text-xs text-surface-200/40 text-center">Loading…</p>
        )}
        {!loading && items.length === 0 && (
          <p className="p-6 text-xs text-surface-200/40 text-center italic">No notifications</p>
        )}
        {todayItems.length > 0 && (
          <>
            <p className="px-3 py-1.5 text-[10px] font-medium text-surface-200/30 uppercase">Today</p>
            {todayItems.map(row => (
              <NotificationItem
                key={row.id}
                row={row}
                onRead={id => void notifications.markRead(id).then(refresh)}
                onNavigate={handleNavigate}
              />
            ))}
          </>
        )}
        {olderItems.length > 0 && (
          <>
            <p className="px-3 py-1.5 text-[10px] font-medium text-surface-200/30 uppercase">Earlier</p>
            {olderItems.map(row => (
              <NotificationItem
                key={row.id}
                row={row}
                onRead={id => void notifications.markRead(id).then(refresh)}
                onNavigate={handleNavigate}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
