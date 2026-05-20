import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { NotificationPanel } from './NotificationPanel'
export function NotificationBell() {
  const { user, notifications } = useAuth()
  const [open, setOpen]       = useState(false)
  const [unread, setUnread]   = useState(0)
  const containerRef          = useRef<HTMLDivElement>(null)

  const refreshCount = async () => {
    try {
      setUnread(await notifications.countUnread())
    } catch {
      setUnread(0)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    void refreshCount()

    let channel: ReturnType<typeof notifications.subscribe> | null = null
    try {
      channel = notifications.subscribe(user.id, () => {
        void refreshCount()
      })
    } catch {
      // Realtime optional — polling still updates the badge
    }

    const poll = window.setInterval(() => void refreshCount(), 60_000)

    return () => {
      if (channel) notifications.unsubscribe(channel)
      window.clearInterval(poll)
    }
  }, [user?.id, notifications])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!user) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl
                   text-surface-200/50 hover:bg-white/5 hover:text-surface-50 transition-all"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
          <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full
                           bg-brand-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  )
}
