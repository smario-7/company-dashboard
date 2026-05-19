import {
  useState, useEffect, useRef, useCallback, useMemo,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type OnConnect,
  type NodeTypes,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { CanvasNode, CanvasNodeColor, CanvasEdge } from '../../../lib/types'
import type { CanvasPathEntry } from '../../../lib/canvasPaths'
import { isKnownVaultPath } from '../../../lib/canvasPaths'
import { DocumentService } from '../../../lib/DocumentService'
import { resolveRepoPath } from '../../../lib/filePreview'
import {
  parseCanvasFile,
  serializeCanvasFile,
  cloneCanvasDocument,
  type CanvasDocument,
  type CanvasPathContext,
} from '../../../lib/canvasFormat'
import { CanvasToolbar } from './CanvasToolbar'
import { CanvasNodeToolbar } from './CanvasNodeToolbar'
import { CanvasEdgeToolbar } from './CanvasEdgeToolbar'
import { CanvasContextMenu } from './CanvasContextMenu'
import { CanvasFlowProvider } from './CanvasFlowContext'
import {
  documentToFlow,
  flowToDocument,
  snap,
  newFlowNodeId,
  pickDefaultSides,
  parsePortSide,
  type CanvasRFNode,
  GRID_SIZE,
  flowEdgeToCanvasEdge,
  canvasEdgeToFlowEdge,
} from './canvasFlowAdapter'
import { flowNodeTypes } from './flow/flowNodeTypes'
import { flowEdgeTypes } from './flow/CanvasFlowEdge'

interface Props {
  content:         string
  onChange:        (json: string) => void
  onSave:          () => void
  saving:          boolean
  filePath:        string
  availableFiles:  CanvasPathEntry[]
  availableAssets: CanvasPathEntry[]
  documentService: DocumentService
  cardScope:       { projectSlug: string; boardSlug: string; cardId: string }
  githubRaw:       { owner: string; repo: string }
}

const MIN_ZOOM = 0.15
const MAX_ZOOM = 2.5

interface ContextMenuState {
  screenX: number
  screenY: number
  canvasX: number
  canvasY: number
}

function CanvasFlowInner({
  content, onChange, onSave, saving, filePath,
  availableFiles, availableAssets,
  documentService, cardScope, githubRaw,
}: Props) {
  const pathCtx = useMemo<CanvasPathContext>(() => ({
    cardFiles: availableFiles,
    assets:    availableAssets,
  }), [availableFiles, availableAssets])

  const fileOutsideCheck = useCallback(
    (file: string) => !isKnownVaultPath(file, availableFiles, availableAssets),
    [availableFiles, availableAssets],
  )

  const parseDoc = useCallback(
    () => parseCanvasFile(content, pathCtx),
    [content, pathCtx],
  )

  const initialFlow = useMemo(() => {
    const doc = parseDoc()
    return documentToFlow(doc, fileOutsideCheck)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- only initial mount

  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges)
  const [history, setHistory]       = useState<CanvasDocument[]>([parseDoc()])
  const [historyIdx, setHistoryIdx] = useState(0)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const pathCtxRef     = useRef(pathCtx)
  const contentRef     = useRef(content)
  const filePathRef    = useRef(filePath)
  const skipCommitRef  = useRef(false)
  const connectStartRef = useRef<{ nodeId: string; handleId: string | null } | null>(null)

  const { screenToFlowPosition, flowToScreenPosition, fitView, getZoom, setViewport } = useReactFlow()

  pathCtxRef.current = pathCtx

  const loadFromDoc = useCallback((doc: CanvasDocument) => {
    skipCommitRef.current = true
    docRef.current = doc
    const flow = documentToFlow(doc, fileOutsideCheck)
    setNodes(flow.nodes)
    setEdges(flow.edges)
    window.setTimeout(() => { skipCommitRef.current = false }, 0)
  }, [fileOutsideCheck, setNodes, setEdges])

  const docRef = useRef(history[historyIdx])
  docRef.current = history[historyIdx]

  const commitFromFlow = useCallback((
    nextNodes: CanvasRFNode[],
    nextEdges: Edge[],
    addToHistory = true,
  ) => {
    if (skipCommitRef.current) return
    const doc  = flowToDocument(nextNodes, nextEdges, docRef.current)
    docRef.current = doc
    const json = serializeCanvasFile(doc, pathCtxRef.current, true)
    contentRef.current = json
    onChange(json)

    if (addToHistory) {
      const cloned = cloneCanvasDocument(doc)
      setHistory(h => {
        const next = h.slice(0, historyIdx + 1)
        next.push(cloned)
        if (next.length > 50) next.shift()
        return next
      })
      setHistoryIdx(i => Math.min(i + 1, 49))
    }
  }, [historyIdx, onChange])

  const commitDoc = useCallback((doc: CanvasDocument, addToHistory = true) => {
    loadFromDoc(doc)
    const json = serializeCanvasFile(doc, pathCtxRef.current, true)
    contentRef.current = json
    onChange(json)
    if (addToHistory) {
      const cloned = cloneCanvasDocument(doc)
      setHistory(h => {
        const next = h.slice(0, historyIdx + 1)
        next.push(cloned)
        if (next.length > 50) next.shift()
        return next
      })
      setHistoryIdx(i => Math.min(i + 1, 49))
    }
  }, [loadFromDoc, onChange, historyIdx])

  useEffect(() => {
    if (content === contentRef.current) return
    contentRef.current = content
    const doc = parseCanvasFile(content, pathCtx)
    loadFromDoc(doc)
    setHistory([doc])
    setHistoryIdx(0)
    setEditingNodeId(null)
    setSelectedEdgeId(null)
  }, [content, pathCtx, loadFromDoc])

  useEffect(() => {
    if (filePath === filePathRef.current) return
    filePathRef.current = filePath
    const doc = parseCanvasFile(contentRef.current, pathCtxRef.current)
    loadFromDoc(doc)
    setHistory([doc])
    setHistoryIdx(0)
    setEditingNodeId(null)
    setSelectedEdgeId(null)
    setViewport({ x: 0, y: 0, zoom: 1 })
  }, [filePath, loadFromDoc, setViewport])

  useEffect(() => {
    if (skipCommitRef.current) return
    commitFromFlow(nodes, edges, false)
  }, [nodes, edges]) // eslint-disable-line react-hooks/exhaustive-deps

  const pushHistory = useCallback(() => {
    if (skipCommitRef.current) return
    const doc = flowToDocument(nodes, edges, docRef.current)
    docRef.current = doc
    const cloned = cloneCanvasDocument(doc)
    setHistory(h => {
      const next = h.slice(0, historyIdx + 1)
      next.push(cloned)
      if (next.length > 50) next.shift()
      return next
    })
    setHistoryIdx(i => Math.min(i + 1, 49))
  }, [nodes, edges, historyIdx])

  const undo = useCallback(() => {
    if (historyIdx <= 0) return
    const newIdx = historyIdx - 1
    const data   = history[newIdx]
    setHistoryIdx(newIdx)
    commitDoc(data, false)
  }, [history, historyIdx, commitDoc])

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return
    const newIdx = historyIdx + 1
    const data   = history[newIdx]
    setHistoryIdx(newIdx)
    commitDoc(data, false)
  }, [history, historyIdx, commitDoc])

  const updateNode = useCallback((id: string, patch: Partial<CanvasNode>) => {
    setNodes(nds => nds.map(n => {
      if (n.id !== id || n.data.kind !== 'known') return n
      const merged = { ...n.data.node, ...patch } as CanvasNode
      return { ...n, data: { kind: 'known' as const, node: merged } }
    }))
  }, [setNodes])

  const addNode = useCallback((
    type: CanvasNode['type'],
    x: number,
    y: number,
    extra: Partial<CanvasNode> = {},
  ) => {
    const sizes: Record<string, { w: number; h: number }> = {
      text: { w: 250, h: 100 }, file: { w: 300, h: 200 },
      group: { w: 400, h: 300 }, link: { w: 280, h: 80 },
    }
    const { w, h } = sizes[type] ?? sizes.text
    const id = newFlowNodeId()
    const base = { id, x: snap(x), y: snap(y), width: w, height: h }

    let newNode: CanvasNode
    if (type === 'text') {
      newNode = { ...base, type: 'text', text: 'New note', ...extra } as CanvasNode
    } else if (type === 'file') {
      newNode = { ...base, type: 'file', file: (extra as CanvasNode & { file?: string }).file ?? '', ...extra } as CanvasNode
    } else if (type === 'group') {
      newNode = { ...base, type: 'group', label: 'Group', ...extra } as CanvasNode
    } else {
      newNode = { ...base, type: 'link', url: 'https://', ...extra } as CanvasNode
    }

    if (type === 'file' && newNode.type === 'file' && !newNode.file.trim()) return

    const rfNode: CanvasRFNode = {
      id,
      type,
      position: { x: snap(x), y: snap(y) },
      style:    { width: w, height: h },
      zIndex:   type === 'group' ? 0 : 1,
      data:     { kind: 'known', node: newNode },
    }

    setNodes(nds => [...nds, rfNode])
    setEditingNodeId(type === 'text' ? id : null)
    setSelectedEdgeId(null)
    window.setTimeout(pushHistory, 0)
  }, [setNodes, pushHistory])

  const deleteSelected = useCallback(() => {
    const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id))
    if (selectedIds.size === 0 && !selectedEdgeId) return

    const nextNodes = nodes.filter(n => !selectedIds.has(n.id))
    const nextEdges = edges.filter(
      e => !selectedIds.has(e.source) && !selectedIds.has(e.target) && e.id !== selectedEdgeId,
    )
    setNodes(nextNodes)
    setEdges(nextEdges)
    setSelectedEdgeId(null)
  }, [nodes, edges, selectedEdgeId, setNodes, setEdges])

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return

    const start = connectStartRef.current
    connectStartRef.current = null

    let fromId: string
    let toId: string
    let fromHandle: string | null | undefined
    let toHandle: string | null | undefined

    if (start?.nodeId) {
      fromId = start.nodeId
      const otherId = start.nodeId === connection.source
        ? connection.target
        : connection.source
      if (!otherId || otherId === fromId) return
      toId = otherId
      if (start.nodeId === connection.source) {
        fromHandle = connection.sourceHandle ?? start.handleId
        toHandle   = connection.targetHandle
      } else {
        fromHandle = connection.targetHandle ?? start.handleId
        toHandle   = connection.sourceHandle
      }
    } else {
      fromId     = connection.source
      toId       = connection.target
      fromHandle = connection.sourceHandle
      toHandle   = connection.targetHandle
    }

    const fallback = pickDefaultSides(fromId, toId, nodes)
    const fromSide = parsePortSide(fromHandle) ?? fallback.fromSide
    const toSide   = parsePortSide(toHandle) ?? fallback.toSide

    const canvasEdge: CanvasEdge = {
      id:       newFlowNodeId(),
      fromNode: fromId,
      toNode:   toId,
      fromSide,
      toSide,
      fromEnd:  'none',
      toEnd:    'arrow',
    }
    const newEdge = canvasEdgeToFlowEdge(canvasEdge)
    setEdges(eds => addEdge(newEdge, eds))
    window.setTimeout(pushHistory, 0)
  }, [nodes, setEdges, pushHistory])

  const fitViewAll = useCallback(() => {
    fitView({ padding: 0.2, duration: 200 })
  }, [fitView])

  const centerCanvasPoint = useCallback(() => {
    const el = document.querySelector('.react-flow')?.getBoundingClientRect()
    if (!el) return { x: 0, y: 0 }
    return screenToFlowPosition({
      x: el.left + el.width / 2,
      y: el.top + el.height / 2,
    })
  }, [screenToFlowPosition])

  const cardBase = useMemo(
    () => documentService.cardBasePath(cardScope.projectSlug, cardScope.boardSlug, cardScope.cardId),
    [documentService, cardScope],
  )

  const resolveFilePath = useCallback(
    (ref: string) => resolveRepoPath(ref, availableFiles, availableAssets, cardBase),
    [availableFiles, availableAssets, cardBase],
  )

  const readFileText = useCallback(async (repoPath: string) => {
    const result = await documentService.readFile(repoPath)
    return result?.content ?? null
  }, [documentService])

  const rawFileUrl = useCallback(
    (repoPath: string) => documentService.rawUrl(githubRaw.owner, githubRaw.repo, repoPath),
    [documentService, githubRaw],
  )

  const flowContextValue = useMemo(() => ({
    availableFiles,
    availableAssets,
    editingNodeId,
    setEditingNodeId,
    updateNode,
    fileOutsideCard: fileOutsideCheck,
    resolveFilePath,
    readFileText,
    rawFileUrl,
  }), [
    availableFiles, availableAssets, editingNodeId, updateNode, fileOutsideCheck,
    resolveFilePath, readFileText, rawFileUrl,
  ])

  const selectedNodes = nodes.filter(n => n.selected && n.data.kind === 'known')
    .map(n => (n.data as { kind: 'known'; node: CanvasNode }).node)

  const flowPaneOffset = () => {
    const el = document.querySelector('.react-flow')?.getBoundingClientRect()
    return { left: el?.left ?? 0, top: el?.top ?? 0 }
  }

  const toToolbarCoords = (flowX: number, flowY: number) => {
    const off = flowPaneOffset()
    const s = flowToScreenPosition({ x: flowX, y: flowY })
    return { x: s.x - off.left, y: s.y - off.top }
  }

  const firstSelected = nodes.find(n => n.selected)
  const nodeToolbarScreen = firstSelected
    ? toToolbarCoords(
        firstSelected.position.x + (Number(firstSelected.style?.width) || 200) / 2,
        firstSelected.position.y,
      )
    : null

  const selectedEdge = selectedEdgeId
    ? edges.find(e => e.id === selectedEdgeId)
    : edges.find(e => e.selected)

  const onPaneContextMenu = useCallback((e: MouseEvent | ReactMouseEvent) => {
    e.preventDefault()
    const pt = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setContextMenu({
      screenX: e.clientX - rect.left,
      screenY: e.clientY - rect.top,
      canvasX: pt.x,
      canvasY: pt.y,
    })
  }, [screenToFlowPosition])

  const onNodeDoubleClick = useCallback((_: ReactMouseEvent, node: CanvasRFNode) => {
    if (node.data.kind !== 'known') return
    const t = node.data.node.type
    if (t === 'text' || t === 'link' || t === 'group') {
      setEditingNodeId(node.id)
    }
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); onSave() }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (nodes.some(n => n.selected) || selectedEdgeId || edges.some(ed => ed.selected)) {
          e.preventDefault()
          deleteSelected()
        }
      }
      if (e.key === 'Escape') {
        setContextMenu(null)
        setEditingNodeId(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [undo, redo, onSave, deleteSelected, nodes, edges, selectedEdgeId])

  const isEmpty = nodes.length === 0

  return (
    <CanvasFlowProvider value={flowContextValue}>
      <div className="flex flex-col h-full">
        <CanvasToolbar
          onAddText={() => {
            const { x, y } = centerCanvasPoint()
            addNode('text', snap(x - 125), snap(y - 50))
          }}
          onAddFile={vaultPath => {
            const { x, y } = centerCanvasPoint()
            addNode('file', snap(x - 150), snap(y - 100), { type: 'file', file: vaultPath })
          }}
          onAddGroup={() => {
            const { x, y } = centerCanvasPoint()
            addNode('group', snap(x - 200), snap(y - 150))
          }}
          onFitView={fitViewAll}
          onSave={onSave}
          onUndo={undo}
          onRedo={redo}
          canUndo={historyIdx > 0}
          canRedo={historyIdx < history.length - 1}
          saving={saving}
          zoom={getZoom()}
          onZoomChange={z => setViewport({ x: 0, y: 0, zoom: z })}
          availableFiles={availableFiles}
        />

        <div className="flex-1 relative min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={(_, { nodeId, handleId }) => {
              if (nodeId) {
                connectStartRef.current = { nodeId, handleId: handleId ?? null }
              }
            }}
            onConnectEnd={() => {
              connectStartRef.current = null
            }}
            onNodeDragStop={pushHistory}
            onNodesDelete={pushHistory}
            onEdgesDelete={pushHistory}
            nodeTypes={flowNodeTypes as NodeTypes}
            edgeTypes={flowEdgeTypes}
            onPaneContextMenu={onPaneContextMenu}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id)
            }}
            onPaneClick={() => {
              setContextMenu(null)
              setSelectedEdgeId(null)
            }}
            snapToGrid
            snapGrid={[GRID_SIZE, GRID_SIZE]}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            className="bg-surface-900"
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={GRID_SIZE}
              size={1.5}
              color="rgba(255,255,255,0.08)"
            />

            <Panel position="bottom-right" className="text-xs font-mono text-surface-200/30 pointer-events-none">
              {Math.round(getZoom() * 100)}%
            </Panel>

            {isEmpty && (
              <Panel position="top-center" className="pointer-events-none mt-[40vh]">
                <div className="text-center">
                  <p className="text-surface-200/20 text-sm">Double-click to add a text node</p>
                  <p className="text-surface-200/15 text-xs mt-1">or right-click / use toolbar</p>
                </div>
              </Panel>
            )}
          </ReactFlow>

          {contextMenu && (
            <CanvasContextMenu
              x={contextMenu.screenX}
              y={contextMenu.screenY}
              availableFiles={availableFiles}
              availableAssets={availableAssets}
              onAddText={() => addNode('text', snap(contextMenu.canvasX - 125), snap(contextMenu.canvasY - 50))}
              onAddFile={path => addNode('file', snap(contextMenu.canvasX - 150), snap(contextMenu.canvasY - 100), { type: 'file', file: path })}
              onAddGroup={() => addNode('group', snap(contextMenu.canvasX - 200), snap(contextMenu.canvasY - 150))}
              onAddLink={() => addNode('link', snap(contextMenu.canvasX - 140), snap(contextMenu.canvasY - 40))}
              onClose={() => setContextMenu(null)}
            />
          )}

          {selectedNodes.length > 0 && nodeToolbarScreen && (
            <CanvasNodeToolbar
              x={nodeToolbarScreen.x}
              y={nodeToolbarScreen.y}
              nodes={selectedNodes}
              onColor={(color: CanvasNodeColor) => {
                for (const n of selectedNodes) updateNode(n.id, { color })
              }}
              onDelete={deleteSelected}
              onEdit={() => {
                const first = selectedNodes.find(n => n.type === 'text' || n.type === 'group')
                if (first) setEditingNodeId(first.id)
              }}
            />
          )}

          {selectedEdge && (() => {
            const canvasEdge = flowEdgeToCanvasEdge(selectedEdge)
            if (!canvasEdge) return null
            const from = nodes.find(n => n.id === selectedEdge.source)
            const to   = nodes.find(n => n.id === selectedEdge.target)
            let edgeX = 0
            let edgeY = 0
            if (from && to) {
              const p = toToolbarCoords(
                (from.position.x + (Number(from.style?.width) || 0) / 2 + to.position.x + (Number(to.style?.width) || 0) / 2) / 2,
                (from.position.y + (Number(from.style?.height) || 0) / 2 + to.position.y + (Number(to.style?.height) || 0) / 2) / 2,
              )
              edgeX = p.x
              edgeY = p.y
            }
            return (
              <CanvasEdgeToolbar
                x={edgeX}
                y={edgeY}
                edge={canvasEdge}
                onLabel={label => {
                  setEdges(eds => eds.map(e =>
                    e.id === selectedEdge.id ? { ...e, label } : e,
                  ))
                }}
                onColor={color => {
                  setEdges(eds => eds.map(e => {
                    if (e.id !== selectedEdge.id) return e
                    const ce = flowEdgeToCanvasEdge(e)
                    if (!ce) return e
                    return canvasEdgeToFlowEdge({ ...ce, color })
                  }))
                }}
                onDelete={() => {
                  setEdges(eds => eds.filter(e => e.id !== selectedEdge.id))
                  setSelectedEdgeId(null)
                }}
              />
            )
          })()}
        </div>
      </div>
    </CanvasFlowProvider>
  )
}

export function CanvasEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasFlowInner {...props} />
    </ReactFlowProvider>
  )
}
