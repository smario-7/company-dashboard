/**
 * JSON Canvas 1.0 — parse/serialize for Obsidian-compatible .canvas files.
 * Spec: https://github.com/obsidianmd/jsoncanvas/blob/main/spec/1.0.md
 */

import type {
  CanvasNode,
  CanvasEdge,
  CanvasTextNode,
  CanvasFileNode,
  CanvasGroupNode,
  CanvasLinkNode,
  JsonCanvasNode,
  CanvasNodeColor,
  PortSide,
  GroupBackgroundStyle,
} from './types'
import {
  normalizeFilePathOnImport,
  toVaultFilePath,
  type CanvasPathEntry,
} from './canvasPaths'

export interface CanvasPathContext {
  cardFiles: CanvasPathEntry[]
  assets?:   CanvasPathEntry[]
}

export interface CanvasDocument {
  nodes:          CanvasNode[]
  edges:          CanvasEdge[]
  preservedNodes: Map<string, JsonCanvasNode>
  nodeOrder:      string[]
}

const PRESET_COLORS = new Set(['0', '1', '2', '3', '4', '5', '6'])

export function generateCanvasId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function roundGeom(n: number): number {
  return Math.round(n)
}

function parseColor(raw: unknown): CanvasNodeColor | undefined {
  if (typeof raw !== 'string') return undefined
  if (PRESET_COLORS.has(raw)) return raw as CanvasNodeColor
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw
  return undefined
}

function serializeColor(color?: CanvasNodeColor): string | undefined {
  if (color === undefined || color === '') return undefined
  if (PRESET_COLORS.has(color)) return color
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color
  return undefined
}

function normalizeSubpath(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  return raw.startsWith('#') ? raw : `#${raw}`
}

interface ParsedNodeBase {
  id:     string
  x:      number
  y:      number
  width:  number
  height: number
  color?: CanvasNodeColor
}

function baseFromRaw(raw: Record<string, unknown>): ParsedNodeBase | null {
  const id = raw.id
  if (typeof id !== 'string') return null
  const x = raw.x
  const y = raw.y
  const w = raw.width
  const h = raw.height
  if (typeof x !== 'number' || typeof y !== 'number' ||
      typeof w !== 'number' || typeof h !== 'number') {
    return null
  }
  return {
    id,
    x: roundGeom(x),
    y: roundGeom(y),
    width:  roundGeom(w),
    height: roundGeom(h),
    color: parseColor(raw.color),
  }
}

function tryParseKnownNode(
  raw: Record<string, unknown>,
  ctx?: CanvasPathContext,
): CanvasNode | null {
  const base = baseFromRaw(raw)
  if (!base) return null

  const type = raw.type
  const cardFiles = ctx?.cardFiles ?? []
  const assets = ctx?.assets ?? []

  if (type === 'text') {
    if (typeof raw.text !== 'string') return null
    return { ...base, type: 'text', text: raw.text } satisfies CanvasTextNode
  }
  if (type === 'file') {
    if (typeof raw.file !== 'string' || !raw.file.trim()) return null
    const file = normalizeFilePathOnImport(raw.file, cardFiles, assets)
    const node: CanvasFileNode = { ...base, type: 'file', file }
    if (typeof raw.subpath === 'string') node.subpath = normalizeSubpath(raw.subpath)
    return node
  }
  if (type === 'group') {
    const node: CanvasGroupNode = { ...base, type: 'group' }
    if (typeof raw.label === 'string') node.label = raw.label
    if (typeof raw.background === 'string') {
      node.background = normalizeFilePathOnImport(raw.background, cardFiles, assets)
    }
    const bs = raw.backgroundStyle
    if (bs === 'cover' || bs === 'ratio' || bs === 'repeat') {
      node.backgroundStyle = bs as GroupBackgroundStyle
    }
    return node
  }
  if (type === 'link') {
    if (typeof raw.url !== 'string' || !raw.url.trim()) return null
    return { ...base, type: 'link', url: raw.url } satisfies CanvasLinkNode
  }
  return null
}

function parseEdge(raw: unknown): CanvasEdge | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.fromNode !== 'string' ||
      typeof o.toNode !== 'string') {
    return null
  }
  const edge: CanvasEdge = {
    id:       o.id,
    fromNode: o.fromNode,
    toNode:   o.toNode,
    fromEnd:  'none',
    toEnd:    'arrow',
  }
  const side = (v: unknown): PortSide | undefined =>
    v === 'top' || v === 'right' || v === 'bottom' || v === 'left' ? v : undefined
  edge.fromSide = side(o.fromSide)
  edge.toSide   = side(o.toSide)
  if (o.fromEnd === 'none' || o.fromEnd === 'arrow') edge.fromEnd = o.fromEnd
  if (o.toEnd === 'none' || o.toEnd === 'arrow') edge.toEnd = o.toEnd
  if (typeof o.label === 'string' && o.label) edge.label = o.label
  edge.color = parseColor(o.color)
  return edge
}

export function parseCanvasFile(
  json: string,
  ctx?: CanvasPathContext,
): CanvasDocument {
  const empty: CanvasDocument = {
    nodes: [],
    edges: [],
    preservedNodes: new Map(),
    nodeOrder: [],
  }
  try {
    const data = JSON.parse(json) as Record<string, unknown>
    const rawNodes = Array.isArray(data.nodes) ? data.nodes : []
    const rawEdges = Array.isArray(data.edges) ? data.edges : []

    const nodes: CanvasNode[] = []
    const preservedNodes = new Map<string, JsonCanvasNode>()
    const nodeOrder: string[] = []

    for (const item of rawNodes) {
      if (!item || typeof item !== 'object') continue
      const raw = item as Record<string, unknown>
      const id = typeof raw.id === 'string' ? raw.id : null
      const parsed = tryParseKnownNode(raw, ctx)
      if (parsed) {
        nodes.push(parsed)
        if (id) nodeOrder.push(id)
      } else if (id) {
        preservedNodes.set(id, { ...raw })
        nodeOrder.push(id)
      }
    }

    const edges = rawEdges
      .map(parseEdge)
      .filter((e): e is CanvasEdge => e !== null)

    return { nodes, edges, preservedNodes, nodeOrder }
  } catch {
    return empty
  }
}

function serializeNodeBase(node: CanvasNode): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id:     node.id,
    type:   node.type,
    x:      roundGeom(node.x),
    y:      roundGeom(node.y),
    width:  roundGeom(node.width),
    height: roundGeom(node.height),
  }
  const color = serializeColor(node.color)
  if (color !== undefined) out.color = color
  return out
}

function serializeNode(
  node: CanvasNode,
  ctx?: CanvasPathContext,
): Record<string, unknown> | null {
  const cardFiles = ctx?.cardFiles ?? []
  const assets = ctx?.assets ?? []

  const out = serializeNodeBase(node)
  switch (node.type) {
    case 'text':
      out.text = node.text
      break
    case 'file': {
      const file = toVaultFilePath(node.file, cardFiles, assets)
      if (!file.trim()) return null
      out.file = file
      const sub = normalizeSubpath(node.subpath)
      if (sub) out.subpath = sub
      break
    }
    case 'group':
      if (node.label) out.label = node.label
      if (node.background) {
        out.background = toVaultFilePath(node.background, cardFiles, assets)
      }
      if (node.backgroundStyle) out.backgroundStyle = node.backgroundStyle
      break
    case 'link':
      if (!node.url.trim()) return null
      out.url = node.url
      break
  }
  return out
}

function serializeEdge(edge: CanvasEdge): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id:       edge.id,
    fromNode: edge.fromNode,
    toNode:   edge.toNode,
    fromEnd:  edge.fromEnd ?? 'none',
    toEnd:    edge.toEnd ?? 'arrow',
  }
  if (edge.fromSide) out.fromSide = edge.fromSide
  if (edge.toSide) out.toSide = edge.toSide
  if (edge.label) out.label = edge.label
  const color = serializeColor(edge.color)
  if (color !== undefined) out.color = color
  return out
}

export function serializeCanvasFile(
  doc: CanvasDocument,
  ctx?: CanvasPathContext,
  pretty = false,
): string {
  const nodeById = new Map<string, CanvasNode>()
  for (const n of doc.nodes) nodeById.set(n.id, n)

  const serializedNodes: Record<string, unknown>[] = []
  for (const id of doc.nodeOrder) {
    const known = nodeById.get(id)
    if (known) {
      const s = serializeNode(known, ctx)
      if (s) serializedNodes.push(s)
      continue
    }
    const preserved = doc.preservedNodes.get(id)
    if (preserved) serializedNodes.push(preserved)
  }

  for (const n of doc.nodes) {
    if (!doc.nodeOrder.includes(n.id)) {
      const s = serializeNode(n, ctx)
      if (s) serializedNodes.push(s)
    }
  }

  for (const [id, raw] of doc.preservedNodes) {
    if (!doc.nodeOrder.includes(id)) {
      serializedNodes.push(raw)
    }
  }

  const payload = {
    nodes: serializedNodes,
    edges: doc.edges.map(serializeEdge),
  }

  return pretty
    ? JSON.stringify(payload, null, 2)
    : JSON.stringify(payload)
}

export function emptyCanvasDocument(): CanvasDocument {
  return {
    nodes: [],
    edges: [],
    preservedNodes: new Map(),
    nodeOrder: [],
  }
}

export function cloneCanvasDocument(doc: CanvasDocument): CanvasDocument {
  return {
    nodes: doc.nodes.map(n => ({ ...n })),
    edges: doc.edges.map(e => ({ ...e })),
    preservedNodes: new Map(
      [...doc.preservedNodes.entries()].map(([k, v]) => [k, { ...v }]),
    ),
    nodeOrder: [...doc.nodeOrder],
  }
}

export function nodesInZOrder(doc: CanvasDocument): CanvasNode[] {
  const byId = new Map(doc.nodes.map(n => [n.id, n]))
  const ordered: CanvasNode[] = []
  const seen = new Set<string>()
  for (const id of doc.nodeOrder) {
    const n = byId.get(id)
    if (n) {
      ordered.push(n)
      seen.add(id)
    }
  }
  for (const n of doc.nodes) {
    if (!seen.has(n.id)) ordered.push(n)
  }
  return ordered
}

export function nodesForRender(doc: CanvasDocument): CanvasNode[] {
  const ordered = nodesInZOrder(doc)
  return [
    ...ordered.filter(n => n.type === 'group'),
    ...ordered.filter(n => n.type !== 'group'),
  ]
}

export function preservedNodesInOrder(doc: CanvasDocument): JsonCanvasNode[] {
  const result: JsonCanvasNode[] = []
  const seen = new Set<string>()
  for (const id of doc.nodeOrder) {
    const raw = doc.preservedNodes.get(id)
    if (raw) {
      result.push(raw)
      seen.add(id)
    }
  }
  for (const [id, raw] of doc.preservedNodes) {
    if (!seen.has(id)) result.push(raw)
  }
  return result
}
