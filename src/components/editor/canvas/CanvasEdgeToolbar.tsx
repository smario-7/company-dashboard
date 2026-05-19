import { useState } from 'react'
import type { CanvasEdge, CanvasNodeColor } from '../../../lib/types'
import { CanvasFloatingToolbar, ToolbarIconBtn } from './CanvasFloatingToolbar'
import { CANVAS_COLORS, CANVAS_COLOR_KEYS } from './canvasConstants'

interface Props {
  x:        number
  y:        number
  edge:     CanvasEdge
  onLabel:  (label: string) => void
  onColor:  (color: CanvasNodeColor) => void
  onDelete: () => void
}

export function CanvasEdgeToolbar({ x, y, edge, onLabel, onColor, onDelete }: Props) {
  const [colorOpen, setColorOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [labelDraft, setLabelDraft] = useState(edge.label ?? '')

  const commitLabel = () => {
    onLabel(labelDraft.trim())
    setLabelOpen(false)
  }

  return (
    <CanvasFloatingToolbar x={x} y={y}>
      <div className="relative">
        <ToolbarIconBtn title="Label" onClick={() => { setLabelDraft(edge.label ?? ''); setLabelOpen(v => !v) }}>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
          </svg>
        </ToolbarIconBtn>
        {labelOpen && (
          <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 flex gap-1
                          rounded-xl bg-surface-850 border border-white/10 p-2 shadow-modal">
            <input
              autoFocus
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitLabel()
                if (e.key === 'Escape') setLabelOpen(false)
              }}
              placeholder="Label"
              className="w-28 rounded-lg bg-surface-900 border border-white/10 px-2 py-1
                         text-xs text-surface-50 outline-none focus:border-brand-400/50"
            />
            <button
              type="button"
              onClick={commitLabel}
              className="rounded-lg px-2 text-xs text-brand-400 hover:bg-brand-500/10"
            >
              OK
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <ToolbarIconBtn title="Color" onClick={() => setColorOpen(v => !v)}>
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        </ToolbarIconBtn>
        {colorOpen && (
          <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 flex gap-1.5
                          rounded-xl bg-surface-850 border border-white/10 p-2 shadow-modal">
            {CANVAS_COLOR_KEYS.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => { onColor(key); setColorOpen(false) }}
                className="h-5 w-5 rounded-full hover:scale-110 transition-transform"
                style={{ backgroundColor: CANVAS_COLORS[key] }}
              />
            ))}
            <div className="fixed inset-0 -z-10" onClick={() => setColorOpen(false)} />
          </div>
        )}
      </div>

      <ToolbarIconBtn title="Delete edge" onClick={onDelete} danger>
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </ToolbarIconBtn>
    </CanvasFloatingToolbar>
  )
}
