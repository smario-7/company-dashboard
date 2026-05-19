import { createContext, useContext, type ReactNode } from 'react'
import type { CanvasNode } from '../../../lib/types'
import type { CanvasPathEntry } from '../../../lib/canvasPaths'

export interface CanvasFlowContextValue {
  availableFiles:  CanvasPathEntry[]
  availableAssets: CanvasPathEntry[]
  editingNodeId:   string | null
  setEditingNodeId:(id: string | null) => void
  updateNode:      (id: string, patch: Partial<CanvasNode>) => void
  fileOutsideCard: (file: string) => boolean
  resolveFilePath: (vaultPath: string) => string | null
  readFileText:    (repoPath: string) => Promise<string | null>
  rawFileUrl:      (repoPath: string) => string
}

const CanvasFlowContext = createContext<CanvasFlowContextValue | null>(null)

export function CanvasFlowProvider({
  value,
  children,
}: {
  value: CanvasFlowContextValue
  children: ReactNode
}) {
  return (
    <CanvasFlowContext.Provider value={value}>
      {children}
    </CanvasFlowContext.Provider>
  )
}

export function useCanvasFlow(): CanvasFlowContextValue {
  const ctx = useContext(CanvasFlowContext)
  if (!ctx) throw new Error('useCanvasFlow must be used within CanvasFlowProvider')
  return ctx
}
