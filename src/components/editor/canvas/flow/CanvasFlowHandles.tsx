import { Handle, Position } from '@xyflow/react'
import type { PortSide } from '../../../../lib/types'

const SIDES: { side: PortSide; position: Position }[] = [
  { side: 'top',    position: Position.Top },
  { side: 'right',  position: Position.Right },
  { side: 'bottom', position: Position.Bottom },
  { side: 'left',   position: Position.Left },
]

export function CanvasFlowHandles({ visible }: { visible: boolean }) {
  return (
    <>
      {SIDES.map(({ side, position }) => (
        <span key={side}>
          <Handle
            type="source"
            position={position}
            id={side}
            className={`!w-3 !h-3 !bg-brand-400 !border-2 !border-surface-900
                        transition-opacity ${visible ? '!opacity-100' : '!opacity-0 group-hover:!opacity-100'}`}
          />
          <Handle
            type="target"
            position={position}
            id={`${side}-target`}
            className={`!w-3 !h-3 !bg-brand-400 !border-2 !border-surface-900
                        transition-opacity ${visible ? '!opacity-100' : '!opacity-0 group-hover:!opacity-100'}`}
          />
        </span>
      ))}
    </>
  )
}
