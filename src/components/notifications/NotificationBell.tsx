import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { NotificationPanel } from './NotificationPanel'

const MD_BREAKPOINT = 768
const MARGIN = 8
const GAP = 8
const MOBILE_SIDE = 12
const MOBILE_BOTTOM_RESERVE = 80

function computePanelStyle(button: HTMLButtonElement): CSSProperties {
  const rect = button.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const isMobile = vw < MD_BREAKPOINT

  if (isMobile) {
    const top = rect.bottom + GAP
    const left = MOBILE_SIDE
    const width = vw - MOBILE_SIDE * 2
    const maxHeight = vh - top - MOBILE_BOTTOM_RESERVE - MARGIN
    return {
      position: 'fixed',
      top,
      left,
      width,
      maxHeight: Math.max(120, maxHeight),
    }
  }

  const width = Math.min(400, vw - 16)
  let left = rect.right - width
  left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN))
  const top = rect.bottom + GAP
  const maxHeight = vh - top - MARGIN
  return {
    position: 'fixed',
    top,
    left,
    width,
    maxHeight: Math.max(120, maxHeight),
  }
}

export function NotificationBell() {
  const { user, notifications } = useAuth()
  const [open, setOpen]           = useState(false)
  const [unread, setUnread]       = useState(0)
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null)
  const [isMobile, setIsMobile]   = useState(false)
  const containerRef              = useRef<HTMLDivElement>(null)
  const buttonRef                 = useRef<HTMLButtonElement>(null)
  const panelRef                  = useRef<HTMLDivElement>(null)

  const refreshCount = async () => {
    try {
      setUnread(await notifications.countUnread())
    } catch {
      setUnread(0)
    }
  }

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    setIsMobile(window.innerWidth < MD_BREAKPOINT)
    setPanelStyle(computePanelStyle(buttonRef.current))
  }, [])

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
    if (!open) {
      setPanelStyle(null)
      return
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!user) return null

  const portal =
    open && panelStyle
      ? createPortal(
          <>
            {isMobile && (
              <div
                className="fixed inset-0 z-[55] bg-black/40 animate-fade-in"
                aria-hidden
                onClick={() => setOpen(false)}
              />
            )}
            <div ref={panelRef}>
              <NotificationPanel
                style={panelStyle}
                onClose={() => setOpen(false)}
              />
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl
                   text-surface-200/50 hover:bg-white/5 hover:text-surface-50 transition-all"
        aria-label="Notifications"
        aria-expanded={open}
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
      {portal}
    </div>
  )
}
