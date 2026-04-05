import Editor, { loader } from '@monaco-editor/react'
import { useEffect, useMemo, useRef } from 'react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import type { Diagnostic } from '../lib/parser'
import { parseDocument } from '../lib/parser'
import { registerSmhLanguage } from '../lib/smhLanguage'

;(self as typeof globalThis & { MonacoEnvironment?: { getWorker: () => Worker } }).MonacoEnvironment = {
  getWorker: () => new editorWorker()
}

loader.config({ monaco })

interface ScriptEditorProps {
  value: string
  path?: string | null
  diagnostics?: Diagnostic[]
  onChange: (value: string) => void
}

function mergeDiagnostics(primary: Diagnostic[], secondary: Diagnostic[]) {
  const seen = new Set<string>()
  const merged: Diagnostic[] = []

  for (const diagnostic of [...primary, ...secondary]) {
    const key = `${diagnostic.code}:${diagnostic.line}:${diagnostic.column ?? ''}:${diagnostic.message}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(diagnostic)
  }

  return merged
}

export default function ScriptEditor({ value, path, diagnostics = [], onChange }: ScriptEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const parseDiagnostics = useMemo(() => parseDocument(value).diagnostics, [value])
  const allDiagnostics = useMemo(() => mergeDiagnostics(parseDiagnostics, diagnostics), [parseDiagnostics, diagnostics])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const model = editor.getModel()
    if (!model) return

    monaco.editor.setModelMarkers(
      model,
      'smh',
      allDiagnostics.map((diagnostic) => ({
        severity:
          diagnostic.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        message: diagnostic.message,
        startLineNumber: diagnostic.line,
        startColumn: diagnostic.column ?? 1,
        endLineNumber: diagnostic.line,
        endColumn: Math.max((diagnostic.column ?? 1) + 1, 2),
        code: diagnostic.code
      }))
    )
  }, [allDiagnostics])

  return (
    <Editor
      height="100%"
      path={path || 'presentation.smh'}
      defaultLanguage="smh"
      language="smh"
      theme="smh-dark"
      value={value}
      beforeMount={(instance) => {
        registerSmhLanguage(instance)
      }}
      onMount={(editor, instance) => {
        registerSmhLanguage(instance)
        editorRef.current = editor
      }}
      onChange={(nextValue) => onChange(nextValue ?? '')}
      options={{
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 12,
        lineHeight: 20,
        fontFamily: "ui-monospace, 'SF Mono', 'SFMono-Regular', Menlo, Consolas, monospace",
        padding: { top: 10, bottom: 10 },
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        wordWrap: 'on',
        wrappingIndent: 'indent',
        folding: true,
        guides: {
          bracketPairs: true,
          indentation: true
        },
        glyphMargin: false,
        lineNumbersMinChars: 3,
        overviewRulerBorder: false,
        overviewRulerLanes: 0,
        occurrencesHighlight: 'off',
        selectionHighlight: false,
        matchBrackets: 'always',
        stickyScroll: { enabled: false },
        cursorBlinking: 'solid',
        cursorSmoothCaretAnimation: 'off',
        smoothScrolling: true,
        contextmenu: true,
        quickSuggestions: {
          other: true,
          comments: false,
          strings: true
        },
        suggest: {
          preview: true,
          showSnippets: true,
          showWords: false
        },
        tabSize: 2,
        insertSpaces: true,
        formatOnPaste: true,
        formatOnType: false
      }}
    />
  )
}
