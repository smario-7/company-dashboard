import { useRef, useState } from 'react'
import type { CardFile } from '../../lib/DocumentService'

interface Props {
  files:           CardFile[]
  activeFile:      CardFile | null
  assetsPrefix:    string
  owner:           string
  repo:            string
  loading:         boolean
  uploading:       boolean
  onSelect:        (file: CardFile) => void
  onDelete:        (file: CardFile) => void
  onUpload:        (fileName: string, base64: string) => Promise<void>
}

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
const isImage = (name: string) => IMAGE_EXTS.some(ext => name.toLowerCase().endsWith(ext))

export function AttachmentsSidebar({
  files, activeFile, assetsPrefix, owner, repo,
  loading, uploading, onSelect, onDelete, onUpload,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const assetFiles = files.filter(f => f.path.startsWith(assetsPrefix))
  const cardFiles  = files.filter(f => !f.path.startsWith(assetsPrefix))

  const rawUrl = (path: string) =>
    `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    for (const file of Array.from(fileList)) {
      const base64 = await readAsBase64(file)
      await onUpload(file.name, base64)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDelete = async (file: CardFile) => {
    setDeleting(file.path)
    try { await onDelete(file) }
    finally { setDeleting(null) }
  }

  return (
    <div className="w-56 flex-shrink-0 flex flex-col h-full border-r border-white/5 bg-surface-900/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <p className="text-xs font-medium text-surface-200/50">Attachments</p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-5 w-5 flex items-center justify-center rounded text-surface-200/30
                     hover:bg-white/5 hover:text-brand-400 transition-all disabled:opacity-40"
          title="Upload file"
        >
          {uploading ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-surface-200/20 border-t-brand-400" />
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-4 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-5 rounded bg-surface-800 animate-pulse" />)}
          </div>
        ) : files.length === 0 ? (
          <p className="px-3 py-4 text-xs text-surface-200/25 text-center">No attachments yet</p>
        ) : (
          <>
            {assetFiles.length > 0 && (
              <Section label="Assets">
                {assetFiles.map(f => (
                  <AttachmentRow
                    key={f.path}
                    file={f}
                    active={activeFile?.path === f.path}
                    hovered={hoverId === f.path}
                    deleting={deleting === f.path}
                    rawUrl={rawUrl(f.path)}
                    isImage={isImage(f.name)}
                    onHover={setHoverId}
                    onSelect={onSelect}
                    onDelete={handleDelete}
                  />
                ))}
              </Section>
            )}
            {cardFiles.length > 0 && (
              <Section label="Card folder">
                {cardFiles.map(f => (
                  <AttachmentRow
                    key={f.path}
                    file={f}
                    active={activeFile?.path === f.path}
                    hovered={hoverId === f.path}
                    deleting={deleting === f.path}
                    rawUrl={rawUrl(f.path)}
                    isImage={isImage(f.name)}
                    onHover={setHoverId}
                    onSelect={onSelect}
                    onDelete={handleDelete}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-surface-200/25">
        {label}
      </p>
      {children}
    </div>
  )
}

function AttachmentRow({
  file, active, hovered, deleting, rawUrl, isImage,
  onHover, onSelect, onDelete,
}: {
  file:      CardFile
  active:    boolean
  hovered:   boolean
  deleting:  boolean
  rawUrl:    string
  isImage:   boolean
  onHover:   (path: string | null) => void
  onSelect:  (f: CardFile) => void
  onDelete:  (f: CardFile) => void
}) {
  return (
    <div
      className={`group flex items-center gap-1.5 px-2 py-1 mx-1 rounded-lg cursor-pointer transition-all
                  ${active ? 'bg-brand-500/15 text-brand-400' : 'text-surface-200/60 hover:bg-white/5 hover:text-surface-50'}`}
      onClick={() => onSelect(file)}
      onMouseEnter={() => onHover(file.path)}
      onMouseLeave={() => onHover(null)}
    >
      {isImage ? (
        <img
          src={rawUrl}
          alt=""
          className="h-5 w-5 rounded object-cover flex-shrink-0 bg-surface-800"
        />
      ) : (
        <span className="text-xs flex-shrink-0 opacity-70">📎</span>
      )}
      <span className="text-xs truncate flex-1 min-w-0">{file.name}</span>
      {hovered && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <a
            href={rawUrl}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="h-4 w-4 flex items-center justify-center rounded
                       text-surface-200/30 hover:text-surface-50 transition-colors"
            title="Open in GitHub"
          >
            <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
          <button
            onClick={e => { e.stopPropagation(); onDelete(file) }}
            disabled={deleting}
            className="h-4 w-4 flex items-center justify-center rounded
                       text-surface-200/20 hover:text-accent-red transition-colors disabled:opacity-40"
          >
            {deleting ? (
              <span className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
            ) : (
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            )}
          </button>
        </div>
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
