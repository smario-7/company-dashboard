import type { ReactNode, MouseEvent, CSSProperties } from 'react'

interface Props {
  x:        number
  y:        number
  children: ReactNode
}

export function CanvasFloatingToolbar({ x, y, children }: Props) {
  const style: CSSProperties = {
    left: x,
    top: y,
    transform: 'translate(-50%, -100%)',
  }
  return (
    <div
      className="absolute z-30 flex items-center gap-0.5 rounded-xl
                 bg-surface-850 border border-white/10 px-1 py-1 shadow-modal"
      style={style}
    >
      {children}
    </div>
  )
}

export function ToolbarIconBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title:    string
  onClick:  (e: MouseEvent) => void
  danger?:  boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors
        ${danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-surface-200/60 hover:bg-white/5 hover:text-surface-50'}`}
    >
      {children}
    </button>
  )
}
