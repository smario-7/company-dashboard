import {
  BaseEdge, EdgeLabelRenderer, getBezierPath, Position, type EdgeProps,
} from '@xyflow/react'
import { CANVAS_COLORS } from '../canvasConstants'
import type { CanvasEdge } from '../../../../lib/types'

function arrowAngleAtTarget(position: Position): number {
  switch (position) {
    case Position.Top:    return 90
    case Position.Right:  return 180
    case Position.Bottom: return -90
    case Position.Left:   return 0
    default:              return 180
  }
}

function ArrowHead({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  const size = 9
  return (
    <polygon
      points={`0,0 ${-size},${size / 2} ${-size},${-size / 2}`}
      fill={color}
      transform={`translate(${x},${y}) rotate(${angle})`}
      style={{ pointerEvents: 'none' }}
    />
  )
}

export function CanvasFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  label,
  style,
  data,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const canvasEdge = data?.canvasEdge as CanvasEdge | undefined
  const colorKey = canvasEdge?.color
  const stroke = selected
    ? '#4f8ef7'
    : (colorKey ? (CANVAS_COLORS[colorKey] ?? colorKey) : (style?.stroke as string) ?? 'rgba(255,255,255,0.35)')

  const showArrow = (canvasEdge?.toEnd ?? 'arrow') !== 'none'

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ ...style, stroke, strokeWidth: selected ? 2.5 : 2 }}
        interactionWidth={16}
      />
      {showArrow && (
        <ArrowHead
          x={targetX}
          y={targetY}
          angle={arrowAngleAtTarget(targetPosition)}
          color={stroke}
        />
      )}
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-[11px] text-surface-200/50 pointer-events-none nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 8}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const flowEdgeTypes = {
  canvas: CanvasFlowEdge,
}
