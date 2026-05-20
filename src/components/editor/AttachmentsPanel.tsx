import { useState, useCallback, useEffect } from 'react'
import { AttachmentsSidebar } from './AttachmentsSidebar'
import { AttachmentPreview } from './AttachmentPreview'
import type { CardFile, DocumentService } from '../../lib/DocumentService'

interface Props {
  projectSlug: string
  boardSlug:   string
  cardId:      string
  files:       CardFile[]
  loading:     boolean
  owner:       string
  repo:        string
  svc:         DocumentService
  onUpload:    (fileName: string, base64: string) => Promise<CardFile>
  onDelete:    (file: CardFile) => Promise<void>
}

export function AttachmentsPanel({
  projectSlug, boardSlug, cardId,
  files, loading, owner, repo, svc,
  onUpload, onDelete,
}: Props) {
  const [activeFile, setActiveFile] = useState<CardFile | null>(null)
  const [uploading,  setUploading]  = useState(false)

  const assetsPrefix = `${svc.cardBasePath(projectSlug, boardSlug, cardId)}/assets/`

  const readFileText = useCallback(
    async (path: string) => {
      const result = await svc.readFile(path)
      return result?.content ?? null
    },
    [svc],
  )

  const rawFileUrl = useCallback(
    (path: string) => svc.rawUrl(owner, repo, path),
    [svc, owner, repo],
  )

  const handleUpload = async (fileName: string, base64: string) => {
    setUploading(true)
    try {
      const newFile = await onUpload(fileName, base64)
      setActiveFile(newFile)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (file: CardFile) => {
    await onDelete(file)
    if (activeFile?.path === file.path) setActiveFile(null)
  }

  useEffect(() => {
    if (files.length === 0) {
      setActiveFile(null)
      return
    }
    if (!activeFile || !files.some(f => f.path === activeFile.path)) {
      setActiveFile(files[0])
    }
  }, [files, activeFile])

  return (
    <div className="flex flex-1 min-h-0 w-full">
      <AttachmentsSidebar
        files={files}
        activeFile={activeFile}
        assetsPrefix={assetsPrefix}
        owner={owner}
        repo={repo}
        loading={loading}
        uploading={uploading}
        onSelect={setActiveFile}
        onDelete={handleDelete}
        onUpload={handleUpload}
      />

      <div className="flex-1 min-w-0 flex flex-col min-h-0 border-l border-white/5">
        {activeFile ? (
          <AttachmentPreview
            repoPath={activeFile.path}
            readFileText={readFileText}
            rawFileUrl={rawFileUrl}
          />
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <p className="text-sm text-surface-200/30">Select a file to preview</p>
          </div>
        )}
      </div>
    </div>
  )
}
