import { useMemo } from 'react'
import { AttachmentPreview } from '../AttachmentPreview'
import { useCanvasFlow } from './CanvasFlowContext'

interface Props {
  vaultPath: string
}

export function FileNodePreview({ vaultPath }: Props) {
  const { resolveFilePath, readFileText, rawFileUrl } = useCanvasFlow()

  const repoPath = useMemo(() => resolveFilePath(vaultPath), [vaultPath, resolveFilePath])

  if (!repoPath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-3 gap-1 min-h-0 text-center">
        <p className="text-[10px] uppercase tracking-wide text-surface-200/35">Błąd</p>
        <p className="text-xs text-surface-200/50">Plik nie został znaleziony w tej karcie</p>
      </div>
    )
  }

  return (
    <AttachmentPreview
      repoPath={repoPath}
      readFileText={readFileText}
      rawFileUrl={rawFileUrl}
      unsupportedMessage={name =>
        name.endsWith('.canvas')
          ? 'Plik canvas — otwórz go w drzewie plików'
          : 'Ten format nie ma podglądu w węźle'
      }
    />
  )
}
