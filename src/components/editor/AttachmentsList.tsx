import { useRef, useState } from 'react'
import type { CardFile } from '../../lib/DocumentService'

interface Props {
  assets:     CardFile[]
  owner:      string
  repo:       string
  onUpload:   (fileName: string, base64: string) => Promise<void>
  onDelete:   (file: CardFile) => Promise<void>
  uploading:  boolean
}

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
const isImage = (name: string) => IMAGE_EXTS.some(ext => name.toLowerCase().endsWith(ext))

function fileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentsList({ assets, owner, repo, onUpload, onDelete, uploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      const base64 = await readAsBase64(file)
      await onUpload(file.name, base64)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  const handleDelete = async (file: CardFile) => {
    setDeleting(file.path)
    try { await onDelete(file) }
    finally { setDeleting(null) }
  }

  const rawUrl = (path: string) =>
    `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`

  return (
    <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto">
      {/* Upload dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed
                   border-white/10 p-6 cursor-pointer transition-all hover:border-brand-400/30
                   hover:bg-brand-500/5 select-none"
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex items-center gap-2 text-sm text-surface-200/50">
            <span className="h-4 w-4 animate-spin rounded-full border border-surface-200/20 border-t-brand-400" />
            Uploading…
          </div>
        ) : (
          <>
            <svg className="h-8 w-8 text-surface-200/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-sm text-surface-200/40">Drop files or click to upload</p>
            <p className="text-xs text-surface-200/25">Images, PDFs, any file type</p>
          </>
        )}
      </div>

      {/* Asset list */}
      {assets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-surface-200/40">Uploaded files</p>
          {assets.map(file => (
            <div
              key={file.path}
              className="flex items-center gap-3 rounded-xl bg-surface-850 border border-white/5 p-3 group"
            >
              {/* Thumbnail or icon */}
              {isImage(file.name) ? (
                <img
                  src={rawUrl(file.path)}
                  alt={file.name}
                  className="h-10 w-10 rounded-lg object-cover flex-shrink-0 bg-surface-800"
                />
              ) : (
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-surface-800 flex-shrink-0 text-xl">
                  📎
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm text-surface-50 truncate">{file.name}</p>
                <p className="text-xs text-surface-200/30">{fileSize(file.size)}</p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={rawUrl(file.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="h-7 w-7 flex items-center justify-center rounded-lg
                             text-surface-200/40 hover:bg-white/5 hover:text-surface-50 transition-all"
                  title="Open"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
                <button
                  onClick={() => handleDelete(file)}
                  disabled={deleting === file.path}
                  className="h-7 w-7 flex items-center justify-center rounded-lg
                             text-surface-200/20 hover:bg-accent-red/10 hover:text-accent-red transition-all"
                  title="Delete"
                >
                  {deleting === file.path ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                  ) : (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {assets.length === 0 && (
        <p className="text-xs text-surface-200/25 text-center">No attachments yet</p>
      )}
    </div>
  )
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
