import { useEffect, useMemo, useRef } from 'react'
import { highlightLine, languageFromPath } from '../lib/codeHighlight'
import type { PrototypePanel } from '../store/appStore'

interface CodePanelProps {
  panel: PrototypePanel
}

export default function CodePanel({ panel }: CodePanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const lines = useMemo(() => (panel.content || '').split('\n'), [panel.content])
  const language = useMemo(() => languageFromPath(panel.filePath), [panel.filePath])
  const targetLine = panel.selection?.line ?? panel.currentLine ?? panel.highlightRange?.startLine

  useEffect(() => {
    if (!targetLine) return

    const frame = window.requestAnimationFrame(() => {
      const container = containerRef.current
      const target = container?.querySelector<HTMLElement>(`[data-line="${targetLine}"]`)
      if (!container || !target) return

      const nextTop = Math.max(0, target.offsetTop - container.clientHeight / 2 + target.clientHeight / 2)
      container.scrollTo({ top: nextTop, behavior: 'smooth' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [panel.filePath, targetLine, panel.highlightRange?.startLine, panel.selection?.line])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 text-xs text-zinc-400">
        <span className="truncate">{panel.filePath || 'No file loaded'}</span>
        <span>
          {language}
          {panel.currentLine ? ` · line ${panel.currentLine}` : ''}
          {panel.selection ? ` · cols ${panel.selection.startCol}-${panel.selection.endCol}` : ''}
        </span>
      </div>
      <div ref={containerRef} className="smh-code-scroll min-h-0 flex-1 overflow-auto bg-[#0b0d10] font-mono text-[13px] leading-6 text-zinc-200">
        {panel.content ? (
          <div className="min-w-full">
            {lines.map((line, index) => {
              const lineNumber = index + 1
              const hasHighlightedBlock = Boolean(panel.highlightRange)
              const isHighlighted =
                panel.highlightRange &&
                lineNumber >= panel.highlightRange.startLine &&
                lineNumber <= panel.highlightRange.endLine
              const isSelected = panel.selection?.line === lineNumber
              const isHighlightStart = isHighlighted && panel.highlightRange?.startLine === lineNumber
              const isHighlightEnd = isHighlighted && panel.highlightRange?.endLine === lineNumber
              const shouldDim = hasHighlightedBlock && !isHighlighted && !isSelected
              const before = isSelected ? line.slice(0, panel.selection?.startCol ?? 0) : line
              const selected = isSelected
                ? line.slice(panel.selection?.startCol ?? 0, panel.selection?.endCol ?? 0)
                : ''
              const after = isSelected ? line.slice(panel.selection?.endCol ?? 0) : ''
              const highlightedHtml = highlightLine(line, language)

              const showCurrentLine = panel.currentLine === lineNumber && !isHighlighted && !isSelected

              return (
                <div
                  key={lineNumber}
                  data-line={lineNumber}
                  className={`grid grid-cols-[64px_1fr] border-l-2 px-2 transition-all ${
                    isSelected
                      ? 'border-sky-300/60 bg-sky-400/10'
                      : isHighlighted
                        ? 'border-amber-300/35 bg-amber-400/10'
                        : 'border-transparent'
                  } ${isHighlightStart ? 'rounded-t-md' : ''} ${isHighlightEnd ? 'rounded-b-md' : ''} ${showCurrentLine ? 'bg-zinc-900/90' : ''} ${shouldDim ? 'opacity-45' : 'opacity-100'}`}
                >
                  <div
                    className={`select-none border-r border-zinc-800/80 pr-3 text-right ${
                      isSelected ? 'text-sky-200' : 'text-zinc-500'
                    }`}
                  >
                    {lineNumber}
                  </div>
                  <pre className="m-0 overflow-x-hidden px-3 whitespace-pre-wrap break-words">
                    {isSelected ? (
                      <>
                        {before}
                        <span className="rounded bg-sky-300/25 text-sky-100 ring-1 ring-sky-200/20">{selected || ' '}</span>
                        {after}
                      </>
                    ) : (
                      <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                    )}
                  </pre>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">No code loaded</div>
        )}
      </div>
    </div>
  )
}
