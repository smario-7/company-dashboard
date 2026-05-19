import type { CSSProperties } from 'react'
import { CANVAS_COLORS } from '../canvasConstants'

export function resolveNodeColor(color?: string): string | undefined {
  if (!color || color === '0') return undefined
  return CANVAS_COLORS[color] ?? color
}

export function getNodeChrome(
  color: string | undefined,
  selected: boolean,
  options?: { dashed?: boolean; outside?: boolean; rounded?: string },
): { className: string; style: CSSProperties } {
  const c = resolveNodeColor(color)
  const rounded = options?.rounded ?? 'rounded-2xl'

  if (options?.outside) {
    return {
      className: `${rounded} border-2 bg-surface-800 transition-all
                  ${selected ? 'shadow-glow-sm ring-2 ring-brand-400/40' : ''}`,
      style: { borderColor: 'rgba(245, 158, 11, 0.5)' },
    }
  }

  const borderStyle = options?.dashed ? 'dashed' : 'solid'
  const borderWidth = options?.dashed ? '2px' : '2px'

  if (c) {
    return {
      className: `${rounded} bg-surface-800 transition-all
                  ${selected ? 'shadow-glow-sm' : 'hover:brightness-110'}`,
      style: {
        border: `${borderWidth} ${borderStyle} ${c}`,
        ...(selected ? { boxShadow: `0 0 0 1px ${c}55, 0 0 16px ${c}33` } : {}),
      },
    }
  }

  if (selected) {
    return {
      className: `${rounded} border-2 border-brand-400/70 bg-surface-800 shadow-glow-sm transition-all`,
      style: {},
    }
  }

  return {
    className: `${rounded} border border-white/8 bg-surface-800 hover:border-white/15 transition-all`,
    style: {},
  }
}
