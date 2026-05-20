import type { CSSProperties } from 'react'

const BASE = { column: '#1a1d27', card: '#151720' } as const
const MIX = { column: '16%', card: '10%' } as const
const BORDER_ALPHA = { column: 0.22, card: 0.14 } as const

const HEX_RE = /^#([0-9A-Fa-f]{6})$/

export function hexToRgba(hex: string, alpha: number): string | undefined {
  const m = HEX_RE.exec(hex)
  if (!m) return undefined
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function boardTintStyle(
  hex: string | undefined,
  variant: 'column' | 'card',
): CSSProperties {
  if (!hex || !HEX_RE.test(hex)) return {}

  const base = BASE[variant]
  const mix = MIX[variant]
  const border = hexToRgba(hex, BORDER_ALPHA[variant])

  return {
    backgroundColor: `color-mix(in srgb, ${hex} ${mix}, ${base})`,
    ...(border ? { borderColor: border } : {}),
  }
}
