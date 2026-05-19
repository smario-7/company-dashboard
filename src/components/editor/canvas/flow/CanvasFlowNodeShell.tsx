import { memo, type CSSProperties, type ReactNode } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { CanvasRFNode } from '../canvasFlowAdapter'
import { CanvasFlowHandles } from './CanvasFlowHandles'

const MIN_W = 100
const MIN_H = 60

export const CanvasFlowNodeShell = memo(function CanvasFlowNodeShell({
  selected,
  children,
  className = '',
  style,
}: NodeProps<CanvasRFNode> & {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={`group relative w-full h-full box-border ${className}`} style={style}>
      {selected && (
        <NodeResizer
          minWidth={MIN_W}
          minHeight={MIN_H}
          handleClassName="!w-2.5 !h-2.5 !rounded-full !bg-brand-400 !border-2 !border-surface-800"
        />
      )}
      {children}
      <CanvasFlowHandles visible={!!selected} />
    </div>
  )
})
