/**
 * CardEditorPanel.tsx
 *
 * The document editor inside a card modal.
 * Layout:
 *   ┌──────────┬──────────────────────────────────┐
 *   │ FileTree │  MarkdownEditor / AttachmentsPanel │
 *   └──────────┴──────────────────────────────────┘
 */

import { useState, useEffect, useCallback } from 'react'
import { FileTree } from './FileTree'
import { MarkdownEditor } from './MarkdownEditor'
import { CanvasEditor } from './canvas/CanvasEditor'
import { AttachmentsPanel } from './AttachmentsPanel'
import { DocumentService, type CardFile } from '../../lib/DocumentService'
import type { GitHubStorage } from '../../lib/GitHubStorage'

interface Props {
  projectSlug: string
  boardSlug:   string
  cardId:      string
  cardTitle:   string
  storage:     GitHubStorage
}

const OWNER = import.meta.env.VITE_GITHUB_OWNER as string
const REPO  = import.meta.env.VITE_GITHUB_REPO  as string

export function CardEditorPanel({ projectSlug, boardSlug, cardId, cardTitle, storage }: Props) {
  const svc = new DocumentService(storage)

  const [files,       setFiles]       = useState<CardFile[]>([])
  const [assets,      setAssets]      = useState<CardFile[]>([])
  const [activeFile,  setActiveFile]  = useState<CardFile | null>(null)
  const [content,     setContent]     = useState('')
  const [contentSha,  setContentSha]  = useState('')
  const [filesLoading,setFilesLoading]= useState(true)
  const [fileSaving,  setFileSaving]  = useState(false)
  const [tab,         setTab]         = useState<'docs' | 'assets'>('docs')

  // ─── Load files ─────────────────────────────────────────────────────────

  const loadFiles = useCallback(async () => {
    setFilesLoading(true)
    try {
      // Ensure README.md exists
      await svc.ensureReadme(projectSlug, boardSlug, cardId, cardTitle)

      const [docFiles, assetFiles] = await Promise.all([
        svc.listFiles(projectSlug, boardSlug, cardId),
        svc.listAttachments(projectSlug, boardSlug, cardId),
      ])

      setFiles(docFiles)
      setAssets(assetFiles)

      // Auto-open README.md
      if (!activeFile && docFiles.length > 0) {
        await openFile(docFiles[0])
      }
    } finally {
      setFilesLoading(false)
    }
  }, [projectSlug, boardSlug, cardId]) // eslint-disable-line

  useEffect(() => { loadFiles() }, [loadFiles])

  // ─── Open file ──────────────────────────────────────────────────────────

  const openFile = async (file: CardFile) => {
    const result = await svc.readFile(file.path)
    if (!result) return
    setActiveFile(file)
    setContent(result.content)
    setContentSha(result.sha)
  }

  // ─── Save file ──────────────────────────────────────────────────────────

  const saveFile = async () => {
    if (!activeFile) return
    setFileSaving(true)
    try {
      const result = await svc.writeFile(activeFile.path, content, contentSha)
      setContentSha(result.sha)
      // Update SHA in file list
      setFiles(prev => prev.map(f =>
        f.path === activeFile.path ? { ...f, sha: result.sha } : f
      ))
    } finally {
      setFileSaving(false)
    }
  }

  // ─── New file ────────────────────────────────────────────────────────────

  const createFile = async (name: string) => {
    const isCanvas   = name.endsWith('.canvas')
    const initial    = isCanvas
      ? JSON.stringify({ nodes: [], edges: [] }, null, 2)
      : `# ${name.replace(/\.md$/, '')}\n\n`

    const result = await svc.createFile(projectSlug, boardSlug, cardId, name, initial)

    const newFile: CardFile = {
      name,
      path: result.path,
      sha:  result.sha,
      size: initial.length,
      type: isCanvas ? 'canvas' : 'md',
    }

    setFiles(prev => {
      // README always first
      if (name === 'README.md') return [newFile, ...prev]
      return [...prev.filter(f => f.name !== name), newFile]
    })

    setActiveFile(newFile)
    setContent(initial)
    setContentSha(result.sha)
  }

  // ─── Delete file ─────────────────────────────────────────────────────────

  const deleteFile = async (file: CardFile) => {
    await svc.deleteFile(file.path, file.sha)
    setFiles(prev => prev.filter(f => f.path !== file.path))
    if (activeFile?.path === file.path) {
      setActiveFile(null)
      setContent('')
      setContentSha('')
    }
  }

  // ─── Upload asset ────────────────────────────────────────────────────────

  const uploadAsset = async (fileName: string, base64: string): Promise<CardFile> => {
    const result = await svc.uploadAsset(projectSlug, boardSlug, cardId, fileName, base64)
    const newAsset: CardFile = {
      name: fileName,
      path: result.path,
      sha:  result.sha,
      size: Math.floor(base64.length * 0.75),
      type: 'asset',
    }
    setAssets(prev => [...prev, newAsset].sort((a, b) => a.name.localeCompare(b.name)))
    return newAsset
  }

  const deleteAsset = async (file: CardFile) => {
    await svc.deleteFile(file.path, file.sha)
    setAssets(prev => prev.filter(f => f.path !== file.path))
  }

  return (
    <div className="flex flex-col h-full border-t border-white/5">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5 flex-shrink-0">
        <button
          onClick={() => setTab('docs')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all
                     ${tab === 'docs' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-200/40 hover:text-surface-200'}`}
        >
          📄 Documents
        </button>
        <button
          onClick={() => setTab('assets')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all
                     ${tab === 'assets' ? 'bg-brand-500/15 text-brand-400' : 'text-surface-200/40 hover:text-surface-200'}`}
        >
          📎 Attachments
          {assets.length > 0 && (
            <span className="ml-1.5 badge bg-surface-800 text-surface-200/50 text-[10px]">
              {assets.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {tab === 'docs' ? (
          <>
            {/* File tree sidebar */}
            <div className="w-56 flex-shrink-0">
              <FileTree
                files={files}
                activeFile={activeFile}
                onSelect={openFile}
                onNewFile={createFile}
                onDeleteFile={deleteFile}
                loading={filesLoading}
              />
            </div>

            {/* Editor main area */}
            <div className="flex-1 min-w-0">
              {activeFile ? (
                activeFile.type === 'canvas' ? (
                  <CanvasEditor
                    content={content}
                    onChange={setContent}
                    onSave={saveFile}
                    saving={fileSaving}
                    filePath={activeFile.path}
                    availableFiles={files
                      .filter(f => f.type === 'md' || f.type === 'canvas')
                      .map(f => ({ path: f.path, name: f.name }))}
                    availableAssets={assets.map(a => ({ path: a.path, name: a.name }))}
                    documentService={svc}
                    cardScope={{ projectSlug, boardSlug, cardId }}
                    githubRaw={{ owner: OWNER, repo: REPO }}
                  />
                ) : (
                  <MarkdownEditor
                    content={content}
                    onChange={setContent}
                    onSave={saveFile}
                    saving={fileSaving}
                    filePath={activeFile.path}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <p className="text-sm text-surface-200/30">Select a file to edit</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <AttachmentsPanel
            projectSlug={projectSlug}
            boardSlug={boardSlug}
            cardId={cardId}
            files={assets}
            loading={filesLoading}
            owner={OWNER}
            repo={REPO}
            svc={svc}
            onUpload={uploadAsset}
            onDelete={deleteAsset}
          />
        )}
      </div>
    </div>
  )
}
