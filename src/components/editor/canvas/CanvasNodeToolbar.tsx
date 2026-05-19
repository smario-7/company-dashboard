import { useState } from 'react'
import type { CanvasNode, CanvasNodeColor } from '../../../lib/types'
import { CanvasFloatingToolbar, ToolbarIconBtn } from './CanvasFloatingToolbar'
import { CANVAS_COLORS, CANVAS_COLOR_KEYS } from './canvasConstants'

interface Props {
  x:        number
  y:        number
  nodes:    CanvasNode[]
  onColor:  (color: CanvasNodeColor) => void
  onDelete: () => void
  onEdit?:  () => void
}

export function CanvasNodeToolbar({ x, y, nodes, onColor, onDelete, onEdit }: Props) {
  const [colorOpen, setColorOpen] = useState(false)
  const canEdit = nodes.some(n => n.type === 'text' || n.type === 'group')

  return (
    <CanvasFloatingToolbar x={x} y={y - 12}>
      <div className="relative">
        <ToolbarIconBtn title="Color" onClick={() => setColorOpen(v => !v)}>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 0 20 4V2"/>
          </svg>
        </ToolbarIconBtn>
        {colorOpen && (
          <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 flex gap-1.5
                          rounded-xl bg-surface-850 border border-white/10 p-2 shadow-modal">
            {CANVAS_COLOR_KEYS.map(key => (
              <button
                key={key}
                type="button"
                title={`Color ${key}`}
                onClick={() => { onColor(key); setColorOpen(false) }}
                className="h-5 w-5 rounded-full hover:scale-110 transition-transform"
                style={{ backgroundColor: CANVAS_COLORS[key] }}
              />
            ))}
            <button
              type="button"
              title="Clear color"
              onClick={() => { onColor('0'); setColorOpen(false) }}
              className="h-5 w-5 rounded-full border border-white/20 text-[8px] text-surface-200/40"
            >
              ×
            </button>
            <div className="fixed inset-0 -z-10" onClick={() => setColorOpen(false)} />
          </div>
        )}
      </div>

      {canEdit && onEdit && (
        <ToolbarIconBtn title="Edit" onClick={onEdit}>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </ToolbarIconBtn>
      )}

      <ToolbarIconBtn title="Delete" onClick={onDelete} danger>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </ToolbarIconBtn>
    </CanvasFloatingToolbar>
  )
}
