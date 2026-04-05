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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#1b1e22]">
      <div className="flex items-center justify-between border-b border-[#34383e] px-3 py-2 text-xs text-[#c9d0d7]">
        <span className="truncate">{panel.filePath || 'No file loaded'}</span>
        <span>
          {language}
          {panel.currentLine ? ` · line ${panel.currentLine}` : ''}
          {panel.selection ? ` · cols ${panel.selection.startCol}-${panel.selection.endCol}` : ''}
        </span>
      </div>

      <div
        ref={containerRef}
        className="smh-code-scroll min-h-0 flex-1 overflow-auto bg-[#1b181c] font-mono text-[13px] leading-6 text-[#e7e1d9]"
      >
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
              const selected = isSelected ? line.slice(panel.selection?.startCol ?? 0, panel.selection?.endCol ?? 0) : ''
              const after = isSelected ? line.slice(panel.selection?.endCol ?? 0) : ''
              const highlightedHtml = highlightLine(line, language)
              const showCurrentLine = panel.currentLine === lineNumber && !isHighlighted && !isSelected

              return (
                <div
                  key={lineNumber}
                  data-line={lineNumber}
                  className={`grid grid-cols-[64px_1fr] border-l-2 px-2 transition-colors ${
                    isSelected
                      ? 'border-[#7b978a] bg-[#243029]'
                      : isHighlighted
                        ? 'border-[#627591] bg-[#252a33]'
                        : 'border-transparent'
                  } ${isHighlightStart ? 'rounded-t-sm' : ''} ${isHighlightEnd ? 'rounded-b-sm' : ''} ${showCurrentLine ? 'bg-[#23262a]' : ''} ${shouldDim ? 'opacity-45' : 'opacity-100'}`}
                >
                  <div className={`select-none border-r border-[#343036] pr-3 text-right ${isSelected ? 'text-[#d9e3dc]' : 'text-[#7f8791]'}`}>
                    {lineNumber}
                  </div>
                  <pre className="m-0 overflow-x-hidden whitespace-pre-wrap break-words px-3">
                    {isSelected ? (
                      <>
                        {before}
                        <span className="bg-[#2f3c35] px-[1px] text-[#eef1f4]">{selected || ' '}</span>
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
          <div className="flex h-full items-center justify-center text-sm text-[#8b929c]">No code loaded</div>
        )}
      </div>
    </div>
  )
}
