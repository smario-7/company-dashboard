import { useEffect, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  type FilePreviewState,
  fileBasename,
  detectPreviewKind,
  truncateForPreview,
  formatJsonPreview,
} from '../../../lib/filePreview'
import { useCanvasFlow } from './CanvasFlowContext'

marked.setOptions({ breaks: true, gfm: true })

interface Props {
  vaultPath: string
}

export function FileNodePreview({ vaultPath }: Props) {
  const { resolveFilePath, readFileText, rawFileUrl } = useCanvasFlow()
  const [state, setState] = useState<FilePreviewState>({
    kind:     'loading',
    fileName: fileBasename(vaultPath),
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const fileName = fileBasename(vaultPath)
      setState({ kind: 'loading', fileName })

      const repoPath = resolveFilePath(vaultPath)
      if (!repoPath) {
        if (!cancelled) {
          setState({
            kind:     'error',
            fileName,
            message:  'Plik nie został znaleziony w tej karcie',
          })
        }
        return
      }

      const name = fileBasename(repoPath)
      const previewKind = detectPreviewKind(name)

      if (previewKind === 'image') {
        if (!cancelled) {
          setState({
            kind:     'image',
            fileName: name,
            imageUrl: rawFileUrl(repoPath),
          })
        }
        return
      }

      if (previewKind === 'unsupported') {
        if (!cancelled) {
          setState({
            kind:     'unsupported',
            fileName: name,
            message:  name.endsWith('.canvas')
              ? 'Plik canvas — otwórz go w drzewie plików'
              : 'Ten format nie ma podglądu w węźle',
          })
        }
        return
      }

      const file = await readFileText(repoPath)
      if (cancelled) return

      if (!file) {
        setState({
          kind:     'error',
          fileName: name,
          message:  'Nie udało się wczytać pliku',
        })
        return
      }

      const content = truncateForPreview(file)

      if (previewKind === 'markdown') {
        const parsed = await marked.parse(content)
        if (cancelled) return
        setState({
          kind:     'markdown',
          fileName: name,
          html:     DOMPurify.sanitize(parsed),
        })
        return
      }

      if (previewKind === 'json') {
        const { text, valid } = formatJsonPreview(content)
        if (cancelled) return
        setState({
          kind:     'json',
          fileName: name,
          text,
          message: valid ? undefined : 'Niepoprawny JSON — pokazano surową treść',
        })
        return
      }

      setState({
        kind:     'text',
        fileName: name,
        text:     content,
      })
    }

    load()
    return () => { cancelled = true }
  }, [vaultPath, resolveFilePath, readFileText, rawFileUrl])

  if (state.kind === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center p-3 min-h-0">
        <span className="h-4 w-4 animate-spin rounded-full border border-white/20 border-t-brand-400" />
      </div>
    )
  }

  if (state.kind === 'error' || state.kind === 'unsupported') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-3 gap-1 min-h-0 text-center">
        <p className="text-[10px] uppercase tracking-wide text-surface-200/35">
          {state.kind === 'error' ? 'Błąd' : 'Brak podglądu'}
        </p>
        <p className="text-xs text-surface-200/50">{state.message}</p>
      </div>
    )
  }

  if (state.kind === 'image' && state.imageUrl) {
    return (
      <div className="flex-1 min-h-0 p-2 flex items-center justify-center overflow-hidden">
        <img
          src={state.imageUrl}
          alt={state.fileName}
          className="max-w-full max-h-full object-contain rounded"
          onError={() => setState({
            kind:     'error',
            fileName: state.fileName,
            message:  'Nie udało się załadować obrazu',
          })}
        />
      </div>
    )
  }

  if (state.kind === 'markdown' && state.html) {
    return (
      <div
        className="flex-1 min-h-0 overflow-auto p-2 text-xs text-surface-100
                   prose prose-invert prose-sm max-w-none
                   prose-headings:text-surface-50 prose-p:my-1 prose-a:text-brand-400"
        dangerouslySetInnerHTML={{ __html: state.html }}
      />
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-2">
      {state.message && (
        <p className="text-[10px] text-amber-400/80 mb-1">{state.message}</p>
      )}
      <pre className="text-[10px] leading-relaxed text-surface-200/70 whitespace-pre-wrap break-words font-mono">
        {state.text ?? ''}
      </pre>
    </div>
  )
}
