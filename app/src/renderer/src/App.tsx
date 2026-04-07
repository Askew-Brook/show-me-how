import { type ReactNode, useEffect, useMemo, useState } from 'react'
import showMeHowIcon from './assets/showmehow-icon.svg'
import CodePanel from './components/CodePanel'
import CommandPalette, { type PaletteItem } from './components/CommandPalette'
import DevModeOverlay from './components/DevModeOverlay'
import ProjectSelector from './components/ProjectSelector'
import ScriptEditor from './components/ScriptEditor'
import {
  buildReviewExportMarkdown,
  buildReviewFileTree,
  extractReviewReferences,
  formatReviewLineRange,
  type ReviewComment,
  type ReviewTreeNode
} from './lib/review'
import { registerRemoteControl } from './lib/remoteControl'
import { badgeClass, buttonClass, iconButtonClass } from './lib/ui'
import { useAppStore } from './store/appStore'

const appFrameClass = 'flex h-full flex-col bg-[#17181b] text-[#eef1f4]'
const surfaceClass = 'rounded-md border border-[#34383e] bg-[#202327]'
const mutedTextClass = 'text-[#a7adb6]'
const subtleTextClass = 'text-[#8b929c]'

function basename(filePath: string) {
  return filePath.split(/[\\/]/).pop() || filePath
}

function parentPath(filePath: string) {
  const normalized = filePath.replace(/[\\/]+$/, '')
  const parts = normalized.split(/[\\/]/)
  parts.pop()
  return parts.join('/') || '/'
}

function relativePath(filePath: string, rootPath?: string | null) {
  if (!rootPath) return filePath
  const normalizedRoot = rootPath.endsWith('/') ? rootPath : `${rootPath}/`
  return filePath.startsWith(normalizedRoot) ? filePath.slice(normalizedRoot.length) : filePath
}

function formatMs(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function flashMessage(setMessage: (value: string) => void, message: string) {
  setMessage(message)
  window.setTimeout(() => setMessage(''), 4000)
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
    return true
  }

  return Boolean(
    target.closest(
      'input, textarea, select, button, [role="textbox"], .monaco-editor, .monaco-editor * , [data-review-ignore-space="true"]'
    )
  )
}

function formatReviewTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

function groupReviewComments(comments: ReviewComment[]) {
  const groups = new Map<string, ReviewComment[]>()

  for (const comment of comments) {
    const existing = groups.get(comment.relativePath) || []
    existing.push(comment)
    groups.set(comment.relativePath, existing)
  }

  return Array.from(groups.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([relativePath, fileComments]) => ({
      relativePath,
      comments: [...fileComments].sort(
        (left, right) => left.startLine - right.startLine || left.endLine - right.endLine || left.createdAt - right.createdAt
      )
    }))
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M5 3.5v9l7-4.5-7-4.5Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M4.5 3h2.5v10H4.5V3Zm4.5 0h2.5v10H9V3Z" />
    </svg>
  )
}

function StepIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M3.5 3.5v9l6-4.5-6-4.5Zm7 0h2v9h-2v-9Z" />
    </svg>
  )
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 stroke-current" aria-hidden="true" fill="none" strokeWidth="1.5">
      <path d="M4 4.5V2.75M4 2.75h1.75M4 2.75l2 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.75 5.25A4.75 4.75 0 1 1 3.5 8" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 stroke-current" aria-hidden="true" fill="none" strokeWidth="1.5">
      <path d="M4 4l8 8M12 4 4 12" strokeLinecap="round" />
    </svg>
  )
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 stroke-current" aria-hidden="true" fill="none" strokeWidth="1.5">
      <path d="M3.5 9.5h2l2.5 2v-7l-2.5 2h-2v3Z" strokeLinejoin="round" />
      <path d="M10.75 5.5a3.5 3.5 0 0 1 0 5" strokeLinecap="round" />
    </svg>
  )
}

function IconButton({
  title,
  onClick,
  disabled,
  variant = 'ghost',
  devLabel,
  children
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  variant?: Parameters<typeof iconButtonClass>[0]
  devLabel?: string
  children: ReactNode
}) {
  return (
    <button
      aria-label={title}
      title={title}
      className={iconButtonClass(variant, 'sm')}
      onClick={onClick}
      disabled={disabled}
      data-dev-label={devLabel}
    >
      {children}
    </button>
  )
}

function NarrationBar({
  tts,
  onPause,
  onResume,
  onVolumeChange
}: {
  tts: {
    runId: number | null
    text: string | null
    status: 'idle' | 'playing' | 'paused'
    progressMs: number
    durationMs: number
    volume: number
  }
  onPause: () => void
  onResume: () => void
  onVolumeChange: (value: number) => void
}) {
  const active = tts.status !== 'idle' && Boolean(tts.text)

  return (
    <div className="border-b border-[#34383e] bg-[#202327] px-4 py-2" data-dev-label="presentation.narration-bar">
      <div className="space-y-2">
        <div className="rounded-md border border-[#34383e] bg-[#1b1e22] px-3 py-2" data-dev-label="presentation.narration-text">
          <div className="h-10 overflow-y-auto text-[12px] leading-5 text-[#eef1f4]">{tts.text || 'Narration idle'}</div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#a7adb6]" data-dev-label="presentation.narration-controls">
          <IconButton
            title={tts.status === 'paused' ? 'Resume' : 'Pause'}
            onClick={tts.status === 'paused' ? onResume : onPause}
            disabled={!active}
            devLabel="presentation.narration-toggle"
          >
            {tts.status === 'paused' ? <PlayIcon /> : <PauseIcon />}
          </IconButton>

          <span className="w-9 text-right text-[#8b929c]">{formatMs(tts.progressMs)}</span>

          <input
            className="min-w-0 flex-1 accent-[#7b978a]"
            type="range"
            min={0}
            max={Math.max(1, Math.round(tts.durationMs) || 1)}
            value={Math.min(Math.round(tts.progressMs), Math.max(1, Math.round(tts.durationMs) || 1))}
            readOnly
          />

          <span className="w-9 text-[#8b929c]">{formatMs(tts.durationMs)}</span>

          <div className="flex items-center gap-1.5 text-[#8b929c]">
            <VolumeIcon />
            <input
              className="w-20 accent-[#7b978a]"
              type="range"
              min={0}
              max={100}
              value={Math.round(tts.volume * 100)}
              onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ReviewTree({
  nodes,
  selectedPath,
  onSelect,
  depth = 0
}: {
  nodes: ReviewTreeNode[]
  selectedPath: string | null
  onSelect: (path: string) => void
  depth?: number
}) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <div key={node.id}>
          {node.type === 'folder' ? (
            <>
              <div
                className="rounded-md px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#b7b0a0]"
                style={{ paddingLeft: `${8 + depth * 14}px` }}
              >
                {node.name}
              </div>
              {node.children?.length ? (
                <ReviewTree nodes={node.children} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className={`block w-full rounded-md px-2 py-1.5 text-left text-[12px] transition-colors ${
                selectedPath === node.path
                  ? 'bg-[#2b3028] text-[#eef1f4]'
                  : 'text-[#c9d0d7] hover:bg-[#23272c] hover:text-[#eef1f4]'
              }`}
              style={{ paddingLeft: `${8 + depth * 14}px` }}
              onClick={() => onSelect(node.path)}
              data-dev-label="review.summary.tree-file"
            >
              {node.name}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [presentationMode, setPresentationMode] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [fileMessage, setFileMessage] = useState('')
  const [devMode, setDevMode] = useState(false)
  const [devOutlines, setDevOutlines] = useState(true)
  const [devLastClicked, setDevLastClicked] = useState<string | null>(null)
  const [reviewPreview, setReviewPreview] = useState<{
    absolutePath: string
    content: string
    exists: boolean
  } | null>(null)

  const {
    bootstrapped,
    script,
    scriptPath,
    pendingScriptPath,
    meta,
    actions,
    diagnostics,
    status,
    currentActionIndex,
    actionStatuses,
    panels,
    panelOrder,
    layoutMode,
    logs,
    recentPresentationPaths,
    tts,
    projects,
    currentProjectId,
    projectSelectorOpen,
    reviewComments,
    reviewDraft,
    reviewSummarySelection,
    bootstrap,
    setScript,
    openScript,
    openRecentPresentation,
    clearCurrentScript,
    setTtsVolume,
    openProjectSelector,
    createProject,
    importProjectsFromParent,
    updateProject,
    deleteProject,
    chooseProject,
    startReviewDraft,
    startReviewDraftForFile,
    setReviewDraftBody,
    saveReviewDraft,
    cancelReviewDraft,
    editReviewComment,
    deleteReviewComment,
    clearReviewComments,
    setReviewSummarySelection,
    validate,
    play,
    pause,
    resume,
    restart,
    stop,
    skipForward,
    skipToSummary
  } = useAppStore()

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    const unsubscribe = registerRemoteControl(setPresentationMode)
    return unsubscribe
  }, [])

  const currentProject = useMemo(
    () => projects.find((project) => project.id === currentProjectId) || null,
    [projects, currentProjectId]
  )

  const orderedPanels = useMemo(() => panelOrder.map((id) => panels[id]).filter(Boolean), [panelOrder, panels])
  const currentAction = actions[currentActionIndex]
  const recentLogs = useMemo(() => logs.slice(-8).reverse(), [logs])
  const reviewReferences = useMemo(() => extractReviewReferences(actions), [actions])
  const reviewTree = useMemo(() => buildReviewFileTree(reviewReferences.map((reference) => reference.relativePath)), [reviewReferences])
  const groupedReviewComments = useMemo(() => groupReviewComments(reviewComments), [reviewComments])
  const preferredReviewSummaryPath =
    reviewSummarySelection || reviewComments[0]?.relativePath || reviewReferences[0]?.relativePath || null
  const hasPresentation = presentationMode || status === 'paused' || status === 'playing'
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  const issueTone = diagnostics.length === 0 ? 'success' : hasErrors ? 'danger' : 'warning'
  const playbackTone = status === 'completed' ? 'success' : status === 'error' ? 'danger' : status === 'playing' ? 'warning' : 'neutral'
  const scriptDisplay = scriptPath ? relativePath(scriptPath, currentProject?.rootPath) : null

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((value) => !value)
        return
      }

      if (event.altKey || event.metaKey || event.ctrlKey) {
        return
      }

      if (event.code === 'Space' && !isEditableTarget(event.target)) {
        if (status === 'playing') {
          event.preventDefault()
          pause()
          return
        }

        if (status === 'paused') {
          event.preventDefault()
          setPresentationMode(true)
          resume()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pause, resume, status])

  useEffect(() => {
    if (!devMode) {
      setDevLastClicked(null)
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-dev-label]') : null
      if (!target?.dataset.devLabel) {
        return
      }

      setDevLastClicked(target.dataset.devLabel)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => window.removeEventListener('pointerdown', handlePointerDown, true)
  }, [devMode])

  useEffect(() => {
    if (status !== 'completed' || reviewSummarySelection || !preferredReviewSummaryPath) {
      return
    }

    setReviewSummarySelection(preferredReviewSummaryPath)
  }, [preferredReviewSummaryPath, reviewSummarySelection, setReviewSummarySelection, status])

  useEffect(() => {
    if (status !== 'completed' || !preferredReviewSummaryPath || !currentProject) {
      setReviewPreview(null)
      return
    }

    let cancelled = false

    void window.smh.readTextFile(preferredReviewSummaryPath, currentProject.rootPath).then((file) => {
      if (cancelled) {
        return
      }

      setReviewPreview({
        absolutePath: file.path,
        content: file.content,
        exists: file.exists
      })
    })

    return () => {
      cancelled = true
    }
  }, [currentProject, preferredReviewSummaryPath, status])

  async function handleImportProjects() {
    const parentPath = await window.smh.pickFolder()
    if (!parentPath) return

    const result = await importProjectsFromParent(parentPath)
    const parts = [`Imported ${result.imported}`]
    if (result.skippedExisting) parts.push(`ignored ${result.skippedExisting} existing`)
    if (result.skippedInvalid) parts.push(`skipped ${result.skippedInvalid} invalid`)
    flashMessage(setFileMessage, parts.join(' · '))
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value)
      flashMessage(setFileMessage, successMessage)
    } catch {
      flashMessage(setFileMessage, 'Copy failed.')
    }
  }

  function buildDevSummary() {
    return [
      `project=${currentProject?.name || 'none'}`,
      `script=${scriptPath ? basename(scriptPath) : script.trim() ? 'unsaved' : 'none'}`,
      `status=${status}`,
      `presentation=${hasPresentation ? 'open' : 'closed'}`,
      `action=${currentAction ? `${currentAction.sourceLine}:${currentAction.summary}` : 'none'}`,
      `diagnostics=${diagnostics.length}`,
      `panels=${orderedPanels.length}`,
      `last=${devLastClicked || 'none'}`
    ].join('\n')
  }

  async function handleCopyDevSummary() {
    await copyText(buildDevSummary(), 'Copied dev summary.')
  }

  async function handleCopyLastDevLabel() {
    if (!devLastClicked) {
      flashMessage(setFileMessage, 'No dev label picked yet.')
      return
    }

    await copyText(devLastClicked, `Copied dev label: ${devLastClicked}`)
  }

  async function handleCopyReviewMarkdown() {
    const markdown = buildReviewExportMarkdown({
      title: meta.title,
      projectName: currentProject?.name || null,
      exportedAt: new Date().toLocaleString(),
      comments: reviewComments,
      references: reviewReferences
    })

    await copyText(markdown, reviewComments.length > 0 ? 'Copied review markdown.' : 'Copied review summary.')
  }

  async function handleToggleDevMode() {
    setDevMode((value) => !value)
    flashMessage(setFileMessage, devMode ? 'Dev mode off.' : 'Dev mode on.')
  }

  function handleToggleDevOutlines() {
    setDevOutlines((value) => !value)
    flashMessage(setFileMessage, devOutlines ? 'Dev outlines off.' : 'Dev outlines on.')
  }

  async function handleExitProject() {
    setPresentationMode(false)
    await openProjectSelector()
    flashMessage(setFileMessage, 'Exited project.')
  }

  function handleClearCurrentScript() {
    setPresentationMode(false)
    clearCurrentScript()
    flashMessage(setFileMessage, 'Cleared current script.')
  }

  const paletteItems = useMemo<PaletteItem[]>(
    () => {
      const items: PaletteItem[] = [
        {
          id: 'action-open-script',
          title: 'Open script…',
          subtitle: currentProject ? `Open an .smh file in ${currentProject.name}` : 'Choose an .smh file',
          hint: 'Action',
          section: 'Actions',
          symbol: '↗',
          keywords: ['open', 'script', 'smh'],
          onSelect: async () => {
            await handleOpenScript()
          }
        },
        {
          id: 'action-projects',
          title: currentProject ? 'Exit project' : 'Project switcher',
          subtitle: currentProject ? `Leave ${currentProject.name} and go back to the project list` : 'Go back to the project list',
          hint: 'Action',
          section: 'Actions',
          symbol: '⌘',
          keywords: ['projects', 'switcher', 'exit', 'leave', 'close project'],
          onSelect: async () => {
            await handleExitProject()
          }
        },
        {
          id: 'action-import-projects',
          title: 'Import projects…',
          subtitle: 'Scan a parent folder for git repositories',
          hint: 'Action',
          section: 'Actions',
          symbol: '⊕',
          keywords: ['import', 'git', 'repositories'],
          onSelect: async () => {
            await handleImportProjects()
          }
        },
        {
          id: 'dev-toggle-mode',
          title: devMode ? 'Disable dev mode' : 'Enable dev mode',
          subtitle: devMode ? 'Hide element tags and dev helpers' : 'Show element tags and debugging helpers',
          hint: 'Dev',
          section: 'Dev',
          symbol: '</>',
          keywords: ['dev', 'debug', 'labels', 'inspect', 'overlay'],
          onSelect: async () => {
            await handleToggleDevMode()
          }
        }
      ]

      if (devMode) {
        items.push(
          {
            id: 'dev-toggle-outlines',
            title: devOutlines ? 'Hide dev outlines' : 'Show dev outlines',
            subtitle: 'Toggle region borders around labeled elements',
            hint: 'Dev',
            section: 'Dev',
            symbol: '□',
            keywords: ['dev', 'outlines', 'boxes', 'regions'],
            onSelect: () => {
              handleToggleDevOutlines()
            }
          },
          {
            id: 'dev-copy-summary',
            title: 'Copy dev summary',
            subtitle: 'Copy current project, script, playback, and last-clicked state',
            hint: 'Dev',
            section: 'Dev',
            symbol: '⧉',
            keywords: ['dev', 'summary', 'copy', 'debug'],
            onSelect: async () => {
              await handleCopyDevSummary()
            }
          },
          {
            id: 'dev-copy-last-label',
            title: 'Copy last clicked label',
            subtitle: devLastClicked || 'Click a tagged element first',
            hint: 'Dev',
            section: 'Dev',
            symbol: '#',
            keywords: ['dev', 'label', 'copy', 'last clicked'],
            onSelect: async () => {
              await handleCopyLastDevLabel()
            }
          }
        )
      }

      if (currentProject) {
        items.push({
          id: 'workspace-clear-script',
          title: 'Clear current script',
          subtitle: scriptPath ? `Remove ${basename(scriptPath)} and stay in ${currentProject.name}` : `Start fresh in ${currentProject.name}`,
          hint: 'Workspace',
          section: 'Workspace',
          symbol: '⌫',
          keywords: ['clear', 'reset', 'blank', 'new script', 'close script'],
          onSelect: () => {
            handleClearCurrentScript()
          }
        })

        items.push({
          id: 'workspace-validate',
          title: 'Validate script',
          subtitle: 'Run checks against the current project',
          hint: 'Workspace',
          section: 'Workspace',
          symbol: '✓',
          keywords: ['validate', 'check', 'lint', 'verify'],
          onSelect: async () => {
            await handleValidate()
          }
        })

        items.push({
          id: 'workspace-copy-path',
          title: 'Copy file path…',
          subtitle: 'Pick a project file and copy its relative path',
          hint: 'Workspace',
          section: 'Workspace',
          symbol: '⧉',
          keywords: ['copy', 'path', 'file', 'relative'],
          onSelect: async () => {
            await pickFilePath()
          }
        })

        if (script.trim() || scriptPath || actions.length > 0) {
          items.push({
            id: status === 'paused' ? 'playback-resume' : status === 'playing' ? 'playback-restart' : 'playback-play',
            title: status === 'paused' ? 'Resume playback' : status === 'playing' ? 'Restart playback' : 'Play script',
            subtitle:
              status === 'paused'
                ? 'Continue the current walkthrough'
                : status === 'playing'
                  ? 'Restart from the top'
                  : 'Validate and run the current script',
            hint: 'Playback',
            section: 'Playback',
            symbol: status === 'paused' ? '▶' : status === 'playing' ? '↺' : '▶',
            keywords: ['play', 'run', 'resume', 'restart', 'presentation'],
            onSelect: async () => {
              if (status === 'paused') {
                handleResume()
                return
              }
              if (status === 'playing') {
                await handleRestart()
                return
              }
              await handleRun()
            }
          })

          items.push({
            id: status === 'playing' || status === 'paused' ? 'playback-skip' : 'playback-step',
            title: status === 'playing' || status === 'paused' ? 'Skip step' : 'Step once',
            subtitle:
              status === 'playing' || status === 'paused'
                ? 'Skip the current narration or pause block'
                : 'Run the next step only',
            hint: 'Playback',
            section: 'Playback',
            symbol: '▹',
            keywords: ['skip', 'step', 'next', 'advance'],
            onSelect: async () => {
              await handleSkipForward()
            }
          })

          if (status === 'playing' || status === 'paused') {
            items.push({
              id: 'playback-summary',
              title: 'Skip to summary',
              subtitle: 'End playback and open the review summary',
              hint: 'Playback',
              section: 'Playback',
              symbol: '»',
              keywords: ['summary', 'finish', 'complete', 'review'],
              onSelect: () => {
                handleSkipToSummary()
              }
            })
          }
        }

        if (status === 'playing') {
          items.push({
            id: 'playback-pause',
            title: 'Pause playback',
            subtitle: 'Pause the current walkthrough',
            hint: 'Playback',
            section: 'Playback',
            symbol: '❚❚',
            keywords: ['pause', 'hold'],
            onSelect: () => {
              pause()
            }
          })
        }

        if (hasPresentation) {
          items.push({
            id: 'playback-close',
            title: 'Close presentation view',
            subtitle: 'Stop playback and return to the editor',
            hint: 'Playback',
            section: 'Playback',
            symbol: '×',
            keywords: ['close', 'stop', 'editor'],
            onSelect: () => {
              handleClosePresentation()
            }
          })
        }
      }

      items.push(
        ...recentPresentationPaths.map((entry) => {
          const rememberedProject = entry.projectId != null ? projects.find((project) => project.id === entry.projectId) || null : null

          return {
            id: `recent-${entry.path}`,
            title: basename(entry.path),
            subtitle: rememberedProject ? `${rememberedProject.name} · ${parentPath(entry.path)}` : parentPath(entry.path),
            hint: 'Recent',
            section: 'Recent scripts',
            symbol: rememberedProject ? '↺' : '.smh',
            keywords: [entry.path, basename(entry.path), rememberedProject?.name || '', 'recent', 'smh'],
            onSelect: async () => {
              setPresentationMode(false)
              await openRecentPresentation(entry)
            }
          }
        })
      )

      items.push(
        ...projects.map((project) => ({
          id: `project-${project.id}`,
          title: project.name,
          subtitle: project.gitRemoteSlug || project.rootPath,
          hint: 'Project',
          section: 'Projects',
          symbol: project.gitRemoteSlug ? 'git' : 'dir',
          keywords: [project.rootPath, project.gitRemoteSlug || '', project.name],
          onSelect: async () => {
            setPresentationMode(false)
            await chooseProject(project.id)
          }
        }))
      )

      return items
    },
    [
      actions.length,
      chooseProject,
      currentAction,
      currentProject,
      devLastClicked,
      devMode,
      devOutlines,
      diagnostics.length,
      hasPresentation,
      openRecentPresentation,
      pause,
      projects,
      recentPresentationPaths,
      script,
      scriptPath,
      status
    ]
  )

  async function pickFilePath() {
    const filePath = await window.smh.pickFile(currentProject?.rootPath ?? null)
    if (!filePath) return

    const displayPath = relativePath(filePath, currentProject?.rootPath)

    try {
      await navigator.clipboard.writeText(displayPath)
      flashMessage(setFileMessage, `Copied path: ${displayPath}`)
    } catch {
      flashMessage(setFileMessage, `Selected path: ${displayPath}`)
    }
  }

  async function handleOpenScript() {
    const openedPath = await openScript()
    if (!openedPath) return
    flashMessage(setFileMessage, `Opened script: ${relativePath(openedPath, currentProject?.rootPath)}`)
  }

  async function handleValidate() {
    const valid = await validate()
    flashMessage(setFileMessage, valid ? 'Check passed.' : 'Check found issues.')
  }

  async function handleRun() {
    setPresentationMode(true)
    await play()
  }

  async function handleRestart() {
    setPresentationMode(true)
    await restart()
  }

  async function handleSkipForward() {
    setPresentationMode(true)
    await skipForward()
  }

  function handleClosePresentation() {
    stop()
    setPresentationMode(false)
  }

  function handleSkipToSummary() {
    setPresentationMode(true)
    skipToSummary()
  }

  function handleBackToWorkspace() {
    setPresentationMode(false)
  }

  function handleResume() {
    setPresentationMode(true)
    resume()
  }

  function renderPausedReviewToolbar() {
    if (status !== 'paused') {
      return null
    }

    return (
      <div
        className="flex items-center justify-between gap-3 border-b border-[#3f433b] bg-[#1d211d] px-4 py-2 text-[11px] text-[#d2d7d2]"
        data-dev-label="review.paused-toolbar"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={badgeClass()}>{reviewComments.length} comments</span>
          {reviewDraft ? (
            <span className={badgeClass('warning')}>
              Draft {reviewDraft.relativePath}:{formatReviewLineRange(reviewDraft.startLine, reviewDraft.endLine)}
            </span>
          ) : (
            <span className={subtleTextClass}>Click or drag code lines to add a comment.</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {reviewDraft ? (
            <button
              type="button"
              className={buttonClass('ghost', 'sm')}
              onClick={cancelReviewDraft}
              data-dev-label="review.paused-clear-draft"
            >
              Clear draft
            </button>
          ) : null}
          {reviewComments.length > 0 ? (
            <button
              type="button"
              className={buttonClass('ghost', 'sm')}
              onClick={clearReviewComments}
              data-dev-label="review.paused-clear-comments"
            >
              Clear comments
            </button>
          ) : null}
          <button
            type="button"
            className={buttonClass('secondary', 'sm')}
            onClick={() => void handleCopyReviewMarkdown()}
            data-dev-label="review.export"
          >
            Export to clipboard
          </button>
          <button
            type="button"
            className={buttonClass('primary', 'sm')}
            onClick={handleResume}
            data-dev-label="review.paused-resume"
          >
            Resume
          </button>
        </div>
      </div>
    )
  }

  function renderFinishedSummary() {
    const selectedFileComments = preferredReviewSummaryPath
      ? reviewComments.filter((comment) => comment.relativePath === preferredReviewSummaryPath)
      : []
    const selectedReference = preferredReviewSummaryPath
      ? reviewReferences.find((reference) => reference.relativePath === preferredReviewSummaryPath) || null
      : null
    const previewPanel =
      reviewPreview && reviewPreview.exists
        ? {
            id: 'review-summary-preview',
            type: 'code' as const,
            visible: true,
            focused: true,
            filePath: reviewPreview.absolutePath,
            content: reviewPreview.content,
            currentLine: selectedFileComments[0]?.startLine || selectedReference?.ranges[0]?.startLine
          }
        : null

    return (
      <main className="min-h-0 flex-1 overflow-hidden p-3" data-dev-label="review.summary.shell">
        <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-3">
            <section className={`${surfaceClass} p-4`} data-dev-label="review.summary.empty-state">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8b07e]">Walkthrough complete</div>
              <div className={`mt-2 text-[12px] ${subtleTextClass}`}>Add comments or copy the review.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass('primary', 'sm')}
                  onClick={() => void handleCopyReviewMarkdown()}
                  data-dev-label="review.summary.export"
                >
                  Copy review markdown
                </button>
                <button
                  type="button"
                  className={buttonClass('secondary', 'sm')}
                  onClick={() => void handleRestart()}
                  data-dev-label="review.summary.restart"
                >
                  Restart walkthrough
                </button>
                <button
                  type="button"
                  className={buttonClass('ghost', 'sm')}
                  onClick={handleBackToWorkspace}
                  data-dev-label="review.summary.workspace"
                >
                  Back to workspace
                </button>
              </div>
            </section>

            <section className={`${surfaceClass} flex min-h-0 flex-col p-3`} data-dev-label="review.summary.comments">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium text-[#f4f6f8]">Comments</h3>
                <span className={badgeClass()}>{reviewComments.length}</span>
              </div>
              <div className="max-h-[32vh] flex-1 space-y-3 overflow-auto pr-1">
                {groupedReviewComments.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#3d4249] bg-[#1b1e22] p-3 text-[12px] text-[#8b929c]">
                    No review comments captured.
                  </div>
                ) : (
                  groupedReviewComments.map((group) => (
                    <div key={group.relativePath} className="rounded-md border border-[#34383e] bg-[#1b1e22] p-3">
                      <button
                        type="button"
                        className="block w-full truncate text-left text-[12px] font-medium text-[#eef1f4] hover:text-[#ffffff]"
                        onClick={() => setReviewSummarySelection(group.relativePath)}
                        title={group.relativePath}
                      >
                        {group.relativePath}
                      </button>
                      <div className="mt-2 space-y-2">
                        {group.comments.map((comment) => (
                          <div key={comment.id} className="rounded-md border border-[#34383e] bg-[#202327] p-2.5 text-[12px]">
                            <div className="flex items-center justify-between gap-3 text-[#bfc5cf]">
                              <span className="min-w-0 truncate">{formatReviewLineRange(comment.startLine, comment.endLine)}</span>
                              <span className={`${subtleTextClass} shrink-0`}>{formatReviewTimestamp(comment.updatedAt)}</span>
                            </div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-[#eef1f4]">{comment.body}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
            <section className={`${surfaceClass} flex min-h-0 flex-col p-3`} data-dev-label="review.summary.tree">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium text-[#f4f6f8]">Code references</h3>
                <span className={badgeClass()}>{reviewReferences.length}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto pr-1">
                {reviewTree.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#3d4249] bg-[#1b1e22] p-3 text-[12px] text-[#8b929c]">
                    No code references recorded.
                  </div>
                ) : (
                  <ReviewTree nodes={reviewTree} selectedPath={preferredReviewSummaryPath} onSelect={setReviewSummarySelection} />
                )}
              </div>
            </section>

            <section className={`${surfaceClass} flex min-h-0 flex-col overflow-hidden p-3`} data-dev-label="review.summary.preview">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-medium text-[#f4f6f8]">Preview</h3>
                  <div className={`text-[11px] ${subtleTextClass}`}>{preferredReviewSummaryPath || 'Choose a referenced file'}</div>
                </div>
                {selectedReference ? <span className={badgeClass()}>{selectedReference.ranges.length} refs</span> : null}
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[#34383e] bg-[#17181b]">
                {previewPanel ? (
                  <CodePanel
                    panel={previewPanel}
                    projectRootPath={currentProject?.rootPath}
                    interactive={Boolean(reviewPreview?.exists && preferredReviewSummaryPath)}
                    reviewComments={selectedFileComments}
                    reviewDraft={reviewDraft}
                    onSelectRange={(selection) => {
                      if (!reviewPreview || !preferredReviewSummaryPath) {
                        return
                      }

                      startReviewDraftForFile({
                        panelId: previewPanel.id,
                        absolutePath: reviewPreview.absolutePath,
                        relativePath: preferredReviewSummaryPath,
                        startLine: selection.startLine,
                        endLine: selection.endLine
                      })
                    }}
                    onChangeDraftBody={setReviewDraftBody}
                    onSaveDraft={saveReviewDraft}
                    onCancelDraft={cancelReviewDraft}
                    onEditComment={editReviewComment}
                    onDeleteComment={deleteReviewComment}
                  />
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center text-[12px] text-[#8b929c]">
                    {preferredReviewSummaryPath ? 'Unable to load the selected file preview.' : 'Choose a file from the reference list.'}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    )
  }

  function renderDevHud() {
    if (!devMode) {
      return null
    }

    return (
      <div className="pointer-events-none fixed bottom-3 right-3 z-[71] w-[300px] rounded-md border border-[#4b6256] bg-[#1a201c]/95 p-3 text-[11px] text-[#d9e3dc] shadow-lg shadow-black/25" data-dev-label="dev.hud">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-medium text-[#eef1f4]">Dev mode</span>
          <span className="text-[#9fb2a7]">{devOutlines ? 'labels + outlines' : 'labels only'}</span>
        </div>
        <div className="space-y-1 text-[#b8c6be]">
          <div>Project: {currentProject?.name || 'none'}</div>
          <div>Script: {scriptPath ? basename(scriptPath) : script.trim() ? 'unsaved' : 'none'}</div>
          <div>Status: {status}</div>
          <div>Action: {currentAction ? `${currentAction.sourceLine} · ${currentAction.summary}` : 'none'}</div>
          <div>Last: {devLastClicked || 'click a tagged element'}</div>
        </div>
      </div>
    )
  }

  if (!bootstrapped) {
    return <div className={`${appFrameClass} items-center justify-center text-sm ${mutedTextClass}`}>Loading ShowMeHow…</div>
  }

  if (projectSelectorOpen) {
    return (
      <>
        <ProjectSelector
          projects={projects}
          pendingScriptPath={pendingScriptPath}
          onSelect={chooseProject}
          onCreate={createProject}
          onImportFromParent={importProjectsFromParent}
          onUpdate={updateProject}
          onDelete={deleteProject}
        />
        <CommandPalette open={paletteOpen} items={paletteItems} onClose={() => setPaletteOpen(false)} />
        <DevModeOverlay enabled={devMode} showOutlines={devOutlines} />
        {renderDevHud()}
      </>
    )
  }

  return (
    <div className={appFrameClass} data-dev-label="app.shell">
      {hasPresentation ? (
        <div className="flex min-h-0 flex-1 flex-col" data-dev-label="presentation.shell">
          <header className="border-b border-[#34383e] bg-[#202327] px-4 py-2.5" data-dev-label="presentation.header">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-medium text-[#f4f6f8]">{meta.title || 'Presentation'}</h1>
                  <span className={badgeClass(playbackTone)}>{status}</span>
                </div>
                <div className={`truncate text-[11px] ${mutedTextClass}`}>
                  {currentProject?.name || 'No project selected'}
                  {currentAction ? ` · ${currentAction.sourceLine} · ${currentAction.summary}` : ''}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <IconButton title="Close" onClick={handleClosePresentation} devLabel="presentation.close">
                  <CloseIcon />
                </IconButton>
                {status === 'playing' ? (
                  <IconButton title="Pause" onClick={pause} variant="secondary" devLabel="presentation.pause">
                    <PauseIcon />
                  </IconButton>
                ) : (
                  <IconButton title="Resume" onClick={handleResume} disabled={status !== 'paused'} variant="secondary" devLabel="presentation.resume">
                    <PlayIcon />
                  </IconButton>
                )}
                {(status === 'playing' || status === 'paused') && (
                  <button
                    type="button"
                    className={buttonClass('ghost', 'sm')}
                    onClick={handleSkipToSummary}
                    data-dev-label="presentation.summary"
                  >
                    Summary
                  </button>
                )}
                <IconButton title="Restart" onClick={() => void handleRestart()} variant="secondary" devLabel="presentation.restart">
                  <RestartIcon />
                </IconButton>
                <IconButton
                  title={status === 'playing' || status === 'paused' ? 'Skip' : 'Step'}
                  onClick={() => void handleSkipForward()}
                  variant="primary"
                  devLabel="presentation.skip"
                >
                  <StepIcon />
                </IconButton>
              </div>
            </div>
          </header>

          {renderPausedReviewToolbar()}

          {fileMessage ? (
            <div className="border-b border-[#5a4637] bg-[#232933] px-4 py-1.5 text-[11px] text-[#d5dfed]">{fileMessage}</div>
          ) : null}

          {status !== 'completed' ? <NarrationBar tts={tts} onPause={pause} onResume={handleResume} onVolumeChange={setTtsVolume} /> : null}

          {status === 'completed' ? (
            renderFinishedSummary()
          ) : (
            <main className="min-h-0 flex-1 p-3" data-dev-label="presentation.canvas">
              <div
                className={`grid h-full min-h-0 gap-3 ${layoutMode === 'single' ? 'grid-cols-1' : 'grid-cols-2'} ${
                  layoutMode === 'grid' ? 'auto-rows-fr' : ''
                }`}
              >
                {orderedPanels.map((panel) => (
                  <div
                    key={panel.id}
                    className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border ${
                      panel.focused ? 'border-[#627591]' : 'border-[#34383e]'
                    } bg-[#202327]`}
                  >
                    <div className="flex items-center justify-between border-b border-[#34383e] px-3 py-1.5 text-[11px] text-[#c9d0d7]">
                      <span className="truncate">
                        {panel.filePath ? relativePath(panel.filePath, currentProject?.rootPath) : `${panel.id} · ${panel.type}`}
                      </span>
                      <span className={panel.focused ? 'text-[#b9c8dc]' : subtleTextClass}>{panel.focused ? 'Focused' : panel.type}</span>
                    </div>
                    <div className="min-h-0 flex-1">
                      {panel.type === 'code' ? (
                        <CodePanel
                          panel={panel}
                          projectRootPath={currentProject?.rootPath}
                          interactive={status === 'paused'}
                          reviewComments={reviewComments.filter((comment) => comment.absolutePath === panel.filePath)}
                          reviewDraft={reviewDraft}
                          onSelectRange={(selection) => startReviewDraft(panel.id, selection)}
                          onChangeDraftBody={setReviewDraftBody}
                          onSaveDraft={saveReviewDraft}
                          onCancelDraft={cancelReviewDraft}
                          onEditComment={editReviewComment}
                          onDeleteComment={deleteReviewComment}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-[#8b929c]">
                          Browser panels are disabled in this prototype.
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {orderedPanels.length === 0 ? (
                  <div className="flex min-h-0 items-center justify-center rounded-md border border-dashed border-[#34383e] bg-[#202327] text-sm text-[#8b929c]">
                    Run a script to open code panels.
                  </div>
                ) : null}
              </div>
            </main>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col" data-dev-label="workspace.shell">
          <header className="border-b border-[#34383e] bg-[#202327] px-4 py-2.5" data-dev-label="workspace.header">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-[280px] flex-1">
                <div className="flex items-center gap-2" data-dev-label="workspace.brand">
                  <img src={showMeHowIcon} alt="ShowMeHow" className="h-8 w-8 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.35)]" />
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8b07e]">ShowMeHow</div>
                    <h1 className="text-sm font-medium text-[#f4f6f8]">{meta.title || 'Walkthrough workspace'}</h1>
                  </div>
                </div>
                <div className={`mt-0.5 text-[11px] ${mutedTextClass}`}>
                  {currentProject ? `${currentProject.name} · ${currentProject.rootPath}` : 'No project selected'}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {scriptDisplay ? <span className={badgeClass()}>{scriptDisplay}</span> : null}
                  <span className={badgeClass()}>{actions.length} actions</span>
                  <span className={badgeClass(issueTone)}>{diagnostics.length} issues</span>
                  <span className={badgeClass(playbackTone)}>{status}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  className={buttonClass('ghost', 'sm')}
                  onClick={() => void openProjectSelector()}
                  data-dev-label="workspace.projects"
                  title="Leave this project and go back to the project list"
                >
                  Switch project
                </button>
                <button
                  className={buttonClass('secondary', 'sm')}
                  onClick={() => void handleOpenScript()}
                  data-dev-label="workspace.open-script"
                  title="Open an .smh walkthrough script"
                >
                  Open script…
                </button>
                <button
                  className={buttonClass('ghost', 'sm')}
                  onClick={() => void pickFilePath()}
                  data-dev-label="workspace.copy-path"
                  title="Pick a project file and copy its relative path"
                >
                  Copy path…
                </button>
                <button
                  className={buttonClass('secondary', 'sm')}
                  onClick={() => void handleValidate()}
                  data-dev-label="workspace.validate"
                  title="Validate the current script against this project"
                >
                  Validate
                </button>
                <button
                  className={buttonClass('primary', 'sm')}
                  onClick={() => void handleRun()}
                  data-dev-label="workspace.play"
                  title="Run the current walkthrough"
                >
                  Run walkthrough
                </button>
              </div>
            </div>

          </header>

          {fileMessage ? (
            <div className="border-b border-[#5a4637] bg-[#232933] px-4 py-1.5 text-[11px] text-[#d5dfed]">{fileMessage}</div>
          ) : null}

          <main className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 p-3" data-dev-label="workspace.editor-region">
              <div className={`${surfaceClass} flex h-full min-h-0 flex-col overflow-hidden`} data-dev-label="workspace.script-editor">
                <div className="flex items-center justify-between border-b border-[#34383e] px-3 py-1.5 text-[11px] text-[#c9d0d7]">
                  <span className="font-medium text-[#eef1f4]">Script</span>
                  {scriptDisplay ? <span className={subtleTextClass}>{scriptDisplay}</span> : null}
                </div>
                <ScriptEditor value={script} path={scriptPath} diagnostics={diagnostics} onChange={setScript} />
              </div>
            </div>

            <div className="border-t border-[#34383e] px-3 py-2.5">
              <div className="grid gap-2.5 lg:grid-cols-3">
                <details className={`${surfaceClass} p-2.5`} open={diagnostics.length > 0} data-dev-label="workspace.diagnostics">
                  <summary className="cursor-pointer text-xs font-medium text-[#f4f6f8]">Diagnostics ({diagnostics.length})</summary>
                  <div className="mt-2.5 max-h-56 overflow-auto text-[11px]">
                    {diagnostics.length === 0 ? (
                      <div className={subtleTextClass}>No diagnostics.</div>
                    ) : (
                      <div className="space-y-2">
                        {diagnostics.map((diagnostic, index) => (
                          <div key={`${diagnostic.code}-${index}`} className="rounded-md border border-[#34383e] bg-[#1b1e22] p-2">
                            <div className={diagnostic.severity === 'error' ? 'text-[#e8c3c3]' : 'text-[#d5dfed]'}>
                              {diagnostic.severity.toUpperCase()} · line {diagnostic.line}
                            </div>
                            <div className="mt-1 text-[#eef1f4]">{diagnostic.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>

                <details className={`${surfaceClass} p-2.5`} data-dev-label="workspace.timeline">
                  <summary className="cursor-pointer text-xs font-medium text-[#f4f6f8]">Timeline ({actions.length})</summary>
                  <div className="mt-2.5 max-h-56 overflow-auto text-[11px]">
                    {actions.length === 0 ? (
                      <div className={subtleTextClass}>No actions yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {actions.map((action, index) => {
                          const rowStatus = actionStatuses[action.id] || 'pending'
                          const active = index === currentActionIndex && status !== 'completed'
                          return (
                            <div
                              key={action.id}
                              className={`rounded-md border p-2 ${
                                active ? 'border-[#627591] bg-[#232933]' : 'border-[#34383e] bg-[#1b1e22]'
                              }`}
                            >
                              <div className={`flex items-center justify-between gap-3 ${mutedTextClass}`}>
                                <span>
                                  {index + 1}. line {action.sourceLine}
                                </span>
                                <span>{rowStatus}</span>
                              </div>
                              <div className="mt-1 text-[#eef1f4]">{action.summary}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </details>

                <details className={`${surfaceClass} p-2.5`} data-dev-label="workspace.logs">
                  <summary className="cursor-pointer text-xs font-medium text-[#f4f6f8]">Logs ({logs.length})</summary>
                  <div className="mt-2.5 max-h-56 overflow-auto text-[11px]">
                    {recentLogs.length === 0 ? (
                      <div className={subtleTextClass}>No logs yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {recentLogs.map((log, index) => (
                          <div key={`${log.timestamp}-${index}`} className="rounded-md border border-[#34383e] bg-[#1b1e22] p-2">
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={
                                  log.level === 'error'
                                    ? 'text-[#e8c3c3]'
                                    : log.level === 'warn'
                                      ? 'text-[#d5dfed]'
                                      : mutedTextClass
                                }
                              >
                                {log.level}
                              </span>
                              <span className={subtleTextClass}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="mt-1 text-[#eef1f4]">{log.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>
          </main>
        </div>
      )}
      <CommandPalette open={paletteOpen} items={paletteItems} onClose={() => setPaletteOpen(false)} />
      <DevModeOverlay enabled={devMode} showOutlines={devOutlines} />
      {renderDevHud()}
    </div>
  )
}
