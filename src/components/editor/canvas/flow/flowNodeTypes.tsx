import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import type { CanvasRFNode } from '../canvasFlowAdapter'
import { useCanvasFlow } from '../CanvasFlowContext'
import { CanvasFlowNodeShell } from './CanvasFlowNodeShell'
import { getNodeChrome } from './nodeChrome'
import { FileNodePreview } from '../FileNodePreview'
import { fileBasename } from '../../../../lib/filePreview'

function TextFlowNode(props: NodeProps<CanvasRFNode>) {
  const { selected, data } = props
  if (data.kind !== 'known' || data.node.type !== 'text') return null
  const node = data.node
  const { editingNodeId, setEditingNodeId, updateNode } = useCanvasFlow()
  const editing = editingNodeId === node.id
  const chrome = getNodeChrome(node.color, !!selected)

  return (
    <CanvasFlowNodeShell {...props} selected={selected} className={chrome.className} style={chrome.style}>
      {editing ? (
        <textarea
          autoFocus
          value={node.text ?? ''}
          onChange={e => updateNode(node.id, { text: e.target.value })}
          onMouseDown={e => e.stopPropagation()}
          onBlur={() => setEditingNodeId(null)}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); setEditingNodeId(null) }
          }}
          className="absolute inset-0 w-full h-full resize-none bg-transparent
                     text-sm text-surface-50 p-3 outline-none font-sans leading-relaxed"
        />
      ) : (
        <div className="absolute inset-0 p-3 text-sm text-surface-50 leading-relaxed overflow-hidden whitespace-pre-wrap">
          {node.text || <span className="text-surface-200/30 italic">Empty note</span>}
        </div>
      )}
    </CanvasFlowNodeShell>
  )
}

function FileFlowNode(props: NodeProps<CanvasRFNode>) {
  const { selected, data } = props
  if (data.kind !== 'known' || data.node.type !== 'file') return null
  const node = data.node
  const { fileOutsideCard } = useCanvasFlow()
  const outside = fileOutsideCard(node.file)
  const chrome = getNodeChrome(node.color, !!selected, { outside })

  return (
    <CanvasFlowNodeShell {...props} selected={selected} className={`flex flex-col overflow-hidden ${chrome.className}`} style={chrome.style}>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 flex-shrink-0 min-h-[32px]">
        <span className="text-sm shrink-0">📄</span>
        <span className="text-xs font-semibold text-surface-100 truncate" title={node.file}>
          {node.file ? fileBasename(node.file) : 'Brak pliku'}
        </span>
        {node.subpath && (
          <span className="text-[10px] text-brand-400/70 truncate shrink-0">{node.subpath}</span>
        )}
      </div>
      {outside && (
        <p className="text-[10px] text-amber-400/70 px-3 py-0.5 border-b border-amber-500/20 shrink-0">
          Ścieżka poza tą kartą
        </p>
      )}
      {node.file ? (
        <FileNodePreview vaultPath={node.file} />
      ) : (
        <div className="flex flex-1 items-center justify-center p-3 min-h-0">
          <p className="text-xs text-surface-200/30 italic text-center">Brak powiązanego pliku</p>
        </div>
      )}
    </CanvasFlowNodeShell>
  )
}

function GroupFlowNode(props: NodeProps<CanvasRFNode>) {
  const { selected, data } = props
  if (data.kind !== 'known' || data.node.type !== 'group') return null
  const node = data.node
  const { editingNodeId, setEditingNodeId, updateNode } = useCanvasFlow()
  const editing = editingNodeId === node.id
  const chrome = getNodeChrome(node.color, !!selected, { dashed: true, rounded: 'rounded-xl' })

  return (
    <CanvasFlowNodeShell
      {...props}
      selected={selected}
      className={chrome.className}
      style={{
        ...chrome.style,
        background: node.background ?? 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="absolute -top-6 left-2 text-xs font-medium text-surface-200/50">
        {editing ? (
          <input
            autoFocus
            className="bg-surface-900 border border-white/10 rounded px-1 text-xs outline-none"
            value={node.label ?? ''}
            onChange={e => updateNode(node.id, { label: e.target.value })}
            onBlur={() => setEditingNodeId(null)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditingNodeId(null)
            }}
            onMouseDown={e => e.stopPropagation()}
          />
        ) : (
          node.label ?? 'Group'
        )}
      </div>
    </CanvasFlowNodeShell>
  )
}

function LinkFlowNode(props: NodeProps<CanvasRFNode>) {
  const { selected, data } = props
  if (data.kind !== 'known' || data.node.type !== 'link') return null
  const node = data.node
  const { editingNodeId, setEditingNodeId, updateNode } = useCanvasFlow()
  const editing = editingNodeId === node.id
  const chrome = getNodeChrome(node.color, !!selected)

  return (
    <CanvasFlowNodeShell {...props} selected={selected} className={`flex flex-col overflow-hidden ${chrome.className}`} style={chrome.style}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 flex-shrink-0">
        <span className="text-sm">🔗</span>
        {editing ? (
          <input
            autoFocus
            className="flex-1 min-w-0 bg-transparent border-b border-white/10 text-xs text-brand-400 outline-none"
            value={node.url}
            onChange={e => updateNode(node.id, { url: e.target.value })}
            onBlur={() => setEditingNodeId(null)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditingNodeId(null)
            }}
            onMouseDown={e => e.stopPropagation()}
          />
        ) : (
          <span className="text-xs text-brand-400 truncate">{node.url || 'No URL'}</span>
        )}
      </div>
    </CanvasFlowNodeShell>
  )
}

function UnknownFlowNode(props: NodeProps<CanvasRFNode>) {
  const { selected, data } = props
  const type = data.kind === 'preserved' && typeof data.raw.type === 'string'
    ? data.raw.type
    : 'unknown'
  const chrome = getNodeChrome(undefined, !!selected, { rounded: 'rounded-lg' })

  return (
    <CanvasFlowNodeShell
      {...props}
      selected={selected}
      className={`${chrome.className} border-dashed border-amber-500/40 bg-amber-500/5`}
      style={chrome.style}
    >
      <div className="p-2 text-[10px] text-amber-400/80 font-mono h-full">
        Unsupported: {type}
      </div>
    </CanvasFlowNodeShell>
  )
}

export const flowNodeTypes = {
  text:    memo(TextFlowNode),
  file:    memo(FileFlowNode),
  group:   memo(GroupFlowNode),
  link:    memo(LinkFlowNode),
  unknown: memo(UnknownFlowNode),
}
