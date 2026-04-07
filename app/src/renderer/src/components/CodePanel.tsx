import { type PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { highlightLine, languageFromPath } from '../lib/codeHighlight'
import { formatReviewLineRange, type ReviewComment, type ReviewDraft } from '../lib/review'
import { buttonClass, inputClass } from '../lib/ui'
import type { PrototypePanel } from '../store/appStore'

interface CodePanelProps {
  panel: PrototypePanel
  projectRootPath?: string | null
  interactive?: boolean
  reviewComments?: ReviewComment[]
  reviewDraft?: ReviewDraft | null
  onSelectRange?: (selection: { startLine: number; endLine: number }) => void
  onChangeDraftBody?: (body: string) => void
  onSaveDraft?: () => void
  onCancelDraft?: () => void
  onEditComment?: (commentId: string) => void
  onDeleteComment?: (commentId: string) => void
}

function normalizeRange(startLine: number, endLine: number) {
  return {
    startLine: Math.min(startLine, endLine),
    endLine: Math.max(startLine, endLine)
  }
}

export default function CodePanel({
  panel,
  projectRootPath,
  interactive = false,
  reviewComments = [],
  reviewDraft = null,
  onSelectRange,
  onChangeDraftBody,
  onSaveDraft,
  onCancelDraft,
  onEditComment,
  onDeleteComment
}: CodePanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const dragAnchorRef = useRef<number | null>(null)
  const [composerTop, setComposerTop] = useState<number | null>(null)
  const lines = useMemo(() => (panel.content || '').split('\n'), [panel.content])
  const language = useMemo(() => languageFromPath(panel.filePath), [panel.filePath])
  const activeDraft = reviewDraft?.panelId === panel.id ? reviewDraft : null
  const targetLine = activeDraft?.startLine ?? panel.selection?.line ?? panel.currentLine ?? panel.highlightRange?.startLine

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
  }, [panel.filePath, targetLine, panel.highlightRange?.startLine, panel.selection?.line, activeDraft?.startLine])

  useEffect(() => {
    if (!interactive) {
      dragAnchorRef.current = null
      return
    }

    const handlePointerUp = () => {
      dragAnchorRef.current = null
    }

    window.addEventListener('pointerup', handlePointerUp)
    return () => window.removeEventListener('pointerup', handlePointerUp)
  }, [interactive])

  useLayoutEffect(() => {
    if (!activeDraft) {
      setComposerTop(null)
      return
    }

    const updateComposerPosition = () => {
      const content = contentRef.current
      const composer = composerRef.current
      const target = content?.querySelector<HTMLElement>(`[data-line="${activeDraft.startLine}"]`)
      if (!content || !target) {
        setComposerTop(null)
        return
      }

      const composerHeight = composer?.offsetHeight ?? 180
      const nextTop = Math.max(8, target.offsetTop - composerHeight - 12)
      setComposerTop(nextTop)
    }

    updateComposerPosition()

    const container = containerRef.current
    window.addEventListener('resize', updateComposerPosition)
    container?.addEventListener('scroll', updateComposerPosition)

    return () => {
      window.removeEventListener('resize', updateComposerPosition)
      container?.removeEventListener('scroll', updateComposerPosition)
    }
  }, [activeDraft, lines.length, panel.filePath, activeDraft?.body])

  function handleLinePointerDown(lineNumber: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || !panel.filePath || !onSelectRange) {
      return
    }

    event.preventDefault()
    dragAnchorRef.current = lineNumber
    onSelectRange({ startLine: lineNumber, endLine: lineNumber })
  }

  function handleLinePointerEnter(lineNumber: number) {
    if (!interactive || dragAnchorRef.current == null || !onSelectRange) {
      return
    }

    const range = normalizeRange(dragAnchorRef.current, lineNumber)
    onSelectRange(range)
  }

  async function handleOpenDraftFile(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
    if (!activeDraft) {
      return
    }

    try {
      const result = await window.smh.openPath(activeDraft.absolutePath, projectRootPath)
      if (!result.ok) {
        window.alert(result.error || 'Could not open file')
      }
    } catch {
      window.alert('Could not open file')
    }
  }

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
          <div ref={contentRef} className={`relative min-w-full ${activeDraft ? 'pb-64' : ''}`}>
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
              const lineComments = reviewComments.filter(
                (comment) => lineNumber >= comment.startLine && lineNumber <= comment.endLine
              )
              const startingComments = reviewComments.filter((comment) => comment.startLine === lineNumber)
              const isDraftLine = activeDraft ? lineNumber >= activeDraft.startLine && lineNumber <= activeDraft.endLine : false

              return (
                <div key={lineNumber}
                >
                  <div
                    data-line={lineNumber}
                    className={`grid grid-cols-[64px_1fr] border-l-2 px-2 transition-colors ${
                      isDraftLine
                        ? 'border-[#a78c5f] bg-[#2b241b]'
                        : isSelected
                          ? 'border-[#7b978a] bg-[#243029]'
                          : isHighlighted
                            ? 'border-[#627591] bg-[#252a33]'
                            : lineComments.length > 0
                              ? 'border-[#8e6f8e] bg-[#241f28]'
                              : 'border-transparent'
                    } ${isHighlightStart ? 'rounded-t-sm' : ''} ${isHighlightEnd ? 'rounded-b-sm' : ''} ${
                      showCurrentLine ? 'bg-[#23262a]' : ''
                    } ${shouldDim ? 'opacity-45' : 'opacity-100'} ${interactive ? 'cursor-crosshair' : ''}`}
                    onPointerDown={(event) => handleLinePointerDown(lineNumber, event)}
                    onPointerEnter={() => handleLinePointerEnter(lineNumber)}
                  >
                    <div
                      className={`select-none border-r border-[#343036] pr-3 text-right ${
                        isSelected || isDraftLine ? 'text-[#eef1f4]' : 'text-[#7f8791]'
                      }`}
                    >
                      <div className="flex items-center justify-end gap-2">
                        {lineComments.length > 0 ? (
                          <span className="text-[10px] text-[#d9b9d9]" data-dev-label="review.comment-marker">
                            ●
                          </span>
                        ) : null}
                        <span>{lineNumber}</span>
                      </div>
                    </div>

                    <div className="min-w-0 px-3 py-[1px]">
                      {startingComments.length > 0 ? (
                        <div className="mb-1 flex flex-wrap gap-1" data-dev-label="review.comment-pills">
                          {startingComments.map((comment) => (
                            onEditComment ? (
                              <button
                                key={comment.id}
                                type="button"
                                className="inline-flex items-center rounded-full border border-[#775b79] bg-[#352a37] px-2 py-0.5 text-[10px] text-[#f0e4f0] transition-colors hover:border-[#8e6f8e] hover:bg-[#413244]"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onEditComment(comment.id)
                                }}
                                onPointerDown={(event) => event.stopPropagation()}
                                data-dev-label="review.comment-pill"
                              >
                                {formatReviewLineRange(comment.startLine, comment.endLine)}
                              </button>
                            ) : (
                              <span
                                key={comment.id}
                                className="inline-flex items-center rounded-full border border-[#775b79] bg-[#352a37] px-2 py-0.5 text-[10px] text-[#f0e4f0]"
                                data-dev-label="review.comment-pill"
                              >
                                {formatReviewLineRange(comment.startLine, comment.endLine)}
                              </span>
                            )
                          ))}
                        </div>
                      ) : null}

                      <pre className={`m-0 overflow-x-hidden whitespace-pre-wrap break-words ${interactive ? 'select-none' : 'select-text'}`}>
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
                  </div>
                </div>
              )
            })}

            {activeDraft && composerTop != null ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-20"
                style={{ top: composerTop }}
                data-dev-label="review.comment-composer-row"
              >
                <div className="pointer-events-auto ml-[88px] mr-4 w-[420px] max-w-[calc(100%-104px)]">
                  <div
                    ref={composerRef}
                    className="relative rounded-md border border-[#85653d] bg-[#272018] p-3 shadow-lg shadow-black/20"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <div className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 border-b border-r border-[#85653d] bg-[#272018]" />
                    <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-[#d7c5a7]">
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left leading-5 text-[#d7c5a7] underline decoration-[#8f7a58]/60 underline-offset-2 hover:text-[#efe3cd]"
                        title={activeDraft.absolutePath}
                        onClick={handleOpenDraftFile}
                        data-dev-label="review.comment-path"
                        data-review-ignore-space="true"
                      >
                        {activeDraft.relativePath}:{formatReviewLineRange(activeDraft.startLine, activeDraft.endLine)}
                      </button>
                      {activeDraft.commentId ? (
                        <button
                          type="button"
                          className={buttonClass('danger', 'sm')}
                          onClick={() => onDeleteComment?.(activeDraft.commentId!)}
                          data-dev-label="review.comment-delete"
                          data-review-ignore-space="true"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                    <textarea
                      value={activeDraft.body}
                      onChange={(event) => onChangeDraftBody?.(event.target.value)}
                      className={`${inputClass()} min-h-28 resize-y font-sans text-[12px] leading-5`}
                      placeholder="Add a review note for this code range…"
                      data-dev-label="review.comment-composer"
                      data-review-ignore-space="true"
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className={buttonClass('ghost', 'sm')}
                        onClick={onCancelDraft}
                        data-dev-label="review.comment-cancel"
                        data-review-ignore-space="true"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={buttonClass('primary', 'sm')}
                        onClick={onSaveDraft}
                        disabled={!activeDraft.body.trim()}
                        data-dev-label="review.comment-save"
                        data-review-ignore-space="true"
                      >
                        Save comment
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[#8b929c]">No code loaded</div>
        )}
      </div>
    </div>
  )
}
