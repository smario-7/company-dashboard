import { useEffect, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  type FilePreviewState,
  fileBasename,
  detectPreviewKind,
  truncateForPreview,
  formatJsonPreview,
} from '../../lib/filePreview'

marked.setOptions({ breaks: true, gfm: true })

interface Props {
  repoPath:      string
  readFileText:  (path: string) => Promise<string | null>
  rawFileUrl:    (path: string) => string
  unsupportedMessage?: (fileName: string) => string
}

export function AttachmentPreview({
  repoPath,
  readFileText,
  rawFileUrl,
  unsupportedMessage,
}: Props) {
  const [state, setState] = useState<FilePreviewState>({
    kind:     'loading',
    fileName: fileBasename(repoPath),
  })

  useEffect(() => {
    let cancelled = false
    const fileName = fileBasename(repoPath)

    async function load() {
      setState({ kind: 'loading', fileName })

      const previewKind = detectPreviewKind(fileName)

      if (previewKind === 'image') {
        if (!cancelled) {
          setState({
            kind:     'image',
            fileName,
            imageUrl: rawFileUrl(repoPath),
          })
        }
        return
      }

      if (previewKind === 'unsupported') {
        if (!cancelled) {
          setState({
            kind:     'unsupported',
            fileName,
            message:  unsupportedMessage?.(fileName)
              ?? (fileName.endsWith('.canvas')
                ? 'Plik canvas — otwórz go w zakładce Documents'
                : 'Ten format nie ma podglądu — otwórz plik w GitHub'),
          })
        }
        return
      }

      const file = await readFileText(repoPath)
      if (cancelled) return

      if (!file) {
        setState({
          kind:     'error',
          fileName,
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
          fileName,
          html:     DOMPurify.sanitize(parsed),
        })
        return
      }

      if (previewKind === 'json') {
        const { text, valid } = formatJsonPreview(content)
        if (cancelled) return
        setState({
          kind:     'json',
          fileName,
          text,
          message: valid ? undefined : 'Niepoprawny JSON — pokazano surową treść',
        })
        return
      }

      setState({
        kind:     'text',
        fileName,
        text:     content,
      })
    }

    load()
    return () => { cancelled = true }
  }, [repoPath, readFileText, rawFileUrl, unsupportedMessage])

  if (state.kind === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center p-6 min-h-0">
        <span className="h-5 w-5 animate-spin rounded-full border border-white/20 border-t-brand-400" />
      </div>
    )
  }

  if (state.kind === 'error' || state.kind === 'unsupported') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 gap-2 min-h-0 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-surface-200/35">
          {state.kind === 'error' ? 'Błąd' : 'Brak podglądu'}
        </p>
        <p className="text-sm text-surface-200/50">{state.message}</p>
        {state.kind === 'unsupported' && (
          <a
            href={rawFileUrl(repoPath)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            Otwórz w GitHub →
          </a>
        )}
      </div>
    )
  }

  if (state.kind === 'image' && state.imageUrl) {
    return (
      <div className="flex-1 min-h-0 p-4 flex items-center justify-center overflow-hidden bg-surface-900/30">
        <img
          src={state.imageUrl}
          alt={state.fileName}
          className="max-w-full max-h-full object-contain rounded-lg"
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
        className="flex-1 min-h-0 overflow-auto p-5 text-sm text-surface-100
                   prose prose-invert prose-sm max-w-none
                   prose-headings:text-surface-50 prose-p:my-1.5 prose-a:text-brand-400"
        dangerouslySetInnerHTML={{ __html: state.html }}
      />
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-5">
      <p className="text-xs font-mono text-surface-200/40 mb-3">{state.fileName}</p>
      {state.message && (
        <p className="text-xs text-amber-400/80 mb-2">{state.message}</p>
      )}
      <pre className="text-sm leading-relaxed text-surface-200/80 whitespace-pre-wrap break-words font-mono">
        {state.text ?? ''}
      </pre>
    </div>
  )
}
