import { useState, useEffect, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface Props {
  content:    string
  onChange:   (value: string) => void
  onSave:     () => void
  saving:     boolean
  filePath:   string
}

type Mode = 'edit' | 'preview' | 'split'

// Dark theme for CodeMirror matching our design
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    fontSize:        '13px',
    fontFamily:      '"JetBrains Mono", monospace',
    height:          '100%',
  },
  '.cm-content': {
    padding:    '12px 16px',
    caretColor: '#4f8ef7',
    color:      '#e2e6ed',
  },
  '.cm-gutters': { display: 'none' },
  '.cm-line':    { lineHeight: '1.7' },
  '.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(79,142,247,0.25)',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.02)' },
}, { dark: true })

marked.setOptions({ breaks: true, gfm: true })

export function MarkdownEditor({ content, onChange, onSave, saving, filePath }: Props) {
  const [mode,    setMode]    = useState<Mode>('split')
  const [preview, setPreview] = useState('')

  // Re-render preview when content or mode changes
  useEffect(() => {
    if (mode === 'edit') return
    void (async () => {
      const parsed = await marked.parse(content)
      setPreview(DOMPurify.sanitize(parsed))
    })()
  }, [content, mode])

  const extensions = [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    EditorView.lineWrapping,
    darkTheme,
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-xs text-surface-200/30 font-mono truncate max-w-[160px]">
            {filePath.split('/').pop()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/5">
            {(['edit', 'split', 'preview'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 text-xs capitalize transition-all
                           ${mode === m
                             ? 'bg-brand-500/20 text-brand-400'
                             : 'text-surface-200/30 hover:text-surface-200/70'}`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Save file */}
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-primary py-1 px-3 text-xs"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                Saving…
              </span>
            ) : (
              'Save file'
            )}
          </button>
        </div>
      </div>

      {/* Editor / Preview area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* CodeMirror editor */}
        {(mode === 'edit' || mode === 'split') && (
          <div className={`flex-1 overflow-auto ${mode === 'split' ? 'border-r border-white/5' : ''}`}>
            <CodeMirror
              value={content}
              height="100%"
              extensions={extensions}
              onChange={onChange}
              theme="dark"
              basicSetup={{
                lineNumbers:       false,
                foldGutter:        false,
                dropCursor:        false,
                allowMultipleSelections: false,
                indentOnInput:     true,
                bracketMatching:   true,
                closeBrackets:     true,
                autocompletion:    true,
                highlightActiveLine: true,
              }}
              style={{ height: '100%' }}
            />
          </div>
        )}

        {/* Preview */}
        {(mode === 'preview' || mode === 'split') && (
          <div
            className="flex-1 overflow-auto px-5 py-4 prose-custom"
            dangerouslySetInnerHTML={{ __html: preview || '<p class="text-surface-200/30 text-sm">Nothing to preview.</p>' }}
          />
        )}
      </div>
    </div>
  )
}
