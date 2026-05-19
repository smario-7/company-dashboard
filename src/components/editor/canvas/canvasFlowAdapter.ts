import type { Node, Edge } from '@xyflow/react'
import { MarkerType } from '@xyflow/react'
import type { CanvasEdge, CanvasNode, JsonCanvasNode, PortSide } from '../../../lib/types'
import type { CanvasDocument } from '../../../lib/canvasFormat'
import { nodesForRender, preservedNodesInOrder, generateCanvasId } from '../../../lib/canvasFormat'
import { CANVAS_COLORS } from './canvasConstants'

export const GRID_SIZE = 20

export type CanvasFlowNodeData = {
  kind:     'known'
  node:     CanvasNode
} | {
  kind:     'preserved'
  raw:      JsonCanvasNode
}

export type CanvasRFNode = Node<CanvasFlowNodeData>

export function snap(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE
}

function nodeStyle(width: number, height: number): { width: number; height: number } {
  return { width, height }
}

function zIndexFor(node: CanvasNode): number {
  return node.type === 'group' ? 0 : 1
}

export function canvasNodeToFlowNode(
  node: CanvasNode,
  fileOutsideCard = false,
): CanvasRFNode {
  return {
    id:       node.id,
    type:     node.type,
    position: { x: node.x, y: node.y },
    style:    nodeStyle(node.width, node.height),
    zIndex:   zIndexFor(node),
    data:     { kind: 'known', node },
    ...(fileOutsideCard ? {} : {}),
  }
}

export function preservedToFlowNode(raw: JsonCanvasNode): CanvasRFNode | null {
  const id = typeof raw.id === 'string' ? raw.id : null
  const x = typeof raw.x === 'number' ? raw.x : null
  const y = typeof raw.y === 'number' ? raw.y : null
  const w = typeof raw.width === 'number' ? raw.width : null
  const h = typeof raw.height === 'number' ? raw.height : null
  if (!id || x === null || y === null || w === null || h === null) return null
  return {
    id,
    type:     'unknown',
    position: { x, y },
    style:    nodeStyle(w, h),
    zIndex:   1,
    data:     { kind: 'preserved', raw },
  }
}

export function canvasEdgeToFlowEdge(edge: CanvasEdge): Edge {
  const color = edge.color
    ? (CANVAS_COLORS[edge.color] ?? edge.color)
    : 'rgba(255,255,255,0.35)'

  return {
    id:            edge.id,
    source:        edge.fromNode,
    target:        edge.toNode,
    sourceHandle:  edge.fromSide ?? 'right',
    targetHandle:  targetHandleId(edge.toSide ?? 'left'),
    type:          'canvas',
    label:         edge.label,
    markerEnd:     (edge.toEnd ?? 'arrow') === 'none'
      ? undefined
      : { type: MarkerType.ArrowClosed, color },
    style:         { stroke: color, strokeWidth: 2 },
    data:          { canvasEdge: edge } as Record<string, unknown>,
  }
}

function targetHandleId(side: PortSide): string {
  return `${side}-target`
}

export function flowEdgeToCanvasEdge(edge: Edge): CanvasEdge | null {
  const source = edge.source
  const target = edge.target
  if (!source || !target) return null

  const fromSide = parseSourceHandle(edge.sourceHandle)
  const toSide   = parseTargetHandle(edge.targetHandle)
  const existing = edge.data?.canvasEdge as CanvasEdge | undefined

  return {
    id:       edge.id,
    fromNode: source,
    toNode:   target,
    fromSide,
    toSide,
    fromEnd:  existing?.fromEnd ?? 'none',
    toEnd:    existing?.toEnd ?? 'arrow',
    label:    typeof edge.label === 'string' ? edge.label : existing?.label,
    color:    existing?.color,
  }
}

export function parsePortSide(handle: string | null | undefined): PortSide | undefined {
  if (!handle) return undefined
  const side = handle.replace(/-target$/, '')
  if (side === 'top' || side === 'right' || side === 'bottom' || side === 'left') {
    return side
  }
  return undefined
}

function parseSourceHandle(handle: string | null | undefined): PortSide {
  return parsePortSide(handle) ?? 'right'
}

function parseTargetHandle(handle: string | null | undefined): PortSide {
  return parsePortSide(handle) ?? 'left'
}

export function documentToFlow(
  doc: CanvasDocument,
  fileOutsideCheck: (file: string) => boolean,
): { nodes: CanvasRFNode[]; edges: Edge[] } {
  const nodes: CanvasRFNode[] = []

  for (const node of nodesForRender(doc)) {
    const outside = node.type === 'file' && fileOutsideCheck(node.file)
    nodes.push(canvasNodeToFlowNode(node, outside))
  }

  for (const raw of preservedNodesInOrder(doc)) {
    const n = preservedToFlowNode(raw)
    if (n) nodes.push(n)
  }

  return {
    nodes,
    edges: doc.edges.map(canvasEdgeToFlowEdge),
  }
}

function readNodeSize(rf: CanvasRFNode): { width: number; height: number } {
  const w = typeof rf.style?.width === 'number' ? rf.style.width : 200
  const h = typeof rf.style?.height === 'number' ? rf.style.height : 100
  const measured = rf.measured
  return {
    width:  snap(measured?.width ?? w),
    height: snap(measured?.height ?? h),
  }
}

export function flowToDocument(
  nodes: CanvasRFNode[],
  edges: Edge[],
  prev: CanvasDocument,
): CanvasDocument {
  const knownNodes: CanvasNode[] = []
  const preservedNodes = new Map<string, JsonCanvasNode>()
  const nodeOrder = nodes.map(n => n.id)

  for (const rf of nodes) {
    const { width, height } = readNodeSize(rf)
    const x = snap(rf.position.x)
    const y = snap(rf.position.y)

    if (rf.data.kind === 'preserved') {
      preservedNodes.set(rf.id, {
        ...rf.data.raw,
        id: rf.id,
        x,
        y,
        width,
        height,
      })
      continue
    }

    const base = rf.data.node
    knownNodes.push({
      ...base,
      x,
      y,
      width,
      height,
    })
  }

  const canvasEdges = edges
    .map(flowEdgeToCanvasEdge)
    .filter((e): e is CanvasEdge => e !== null)

  return {
    nodes: knownNodes,
    edges: canvasEdges,
    preservedNodes,
    nodeOrder,
  }
}

export function newFlowNodeId(): string {
  return generateCanvasId()
}

export function pickDefaultSides(
  fromId: string,
  toId: string,
  nodes: CanvasRFNode[],
): { fromSide: PortSide; toSide: PortSide } {
  const from = nodes.find(n => n.id === fromId)?.data
  const to   = nodes.find(n => n.id === toId)?.data
  const fromNode = from?.kind === 'known' ? from.node : null
  const toNode   = to?.kind === 'known' ? to.node : null
  if (!fromNode || !toNode) {
    return { fromSide: 'right', toSide: 'left' }
  }
  const fx = fromNode.x + fromNode.width / 2
  const fy = fromNode.y + fromNode.height / 2
  const tx = toNode.x + toNode.width / 2
  const ty = toNode.y + toNode.height / 2
  const dx = tx - fx
  const dy = ty - fy
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { fromSide: 'right', toSide: 'left' }
      : { fromSide: 'left', toSide: 'right' }
  }
  return dy >= 0
    ? { fromSide: 'bottom', toSide: 'top' }
    : { fromSide: 'top', toSide: 'bottom' }
}
