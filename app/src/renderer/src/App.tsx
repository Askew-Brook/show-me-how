import { useEffect, useMemo, useState } from 'react'
import CodePanel from './components/CodePanel'
import ProjectSelector from './components/ProjectSelector'
import { registerRemoteControl } from './lib/remoteControl'
import { useAppStore } from './store/appStore'

const speedOptions = [0.75, 1, 1.25, 1.5, 2]

function buttonClass(variant: 'default' | 'primary' | 'ghost' = 'default') {
  if (variant === 'primary') {
    return 'rounded-md border border-emerald-500/60 bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50'
  }

  if (variant === 'ghost') {
    return 'rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50'
  }

  return 'rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50'
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
    <div
      className={`border-b px-4 py-2 transition-all ${
        active ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/30 opacity-70'
      }`}
    >
      <div className="flex min-h-[42px] flex-wrap items-center gap-3">
        <button
          className={buttonClass(active ? 'default' : 'ghost')}
          onClick={tts.status === 'paused' ? onResume : onPause}
          disabled={!active}
        >
          {tts.status === 'paused' ? 'Resume voice' : 'Pause voice'}
        </button>

        <div className="min-w-[220px] flex-1">
          <div className="truncate text-sm text-zinc-200">{tts.text || 'Narration idle'}</div>
        </div>

        <div className="flex min-w-[240px] flex-1 items-center gap-3">
          <span className="w-10 text-right text-[11px] text-zinc-500">{formatMs(tts.progressMs)}</span>
          <input
            className="flex-1 accent-emerald-400"
            type="range"
            min={0}
            max={Math.max(1, Math.round(tts.durationMs) || 1)}
            value={Math.min(Math.round(tts.progressMs), Math.max(1, Math.round(tts.durationMs) || 1))}
            readOnly
          />
          <span className="w-10 text-[11px] text-zinc-500">{formatMs(tts.durationMs)}</span>
        </div>

        <label className="flex items-center gap-2 text-[11px] text-zinc-400">
          volume
          <input
            className="w-24 accent-emerald-400"
            type="range"
            min={0}
            max={100}
            value={Math.round(tts.volume * 100)}
            onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
          />
        </label>
      </div>
    </div>
  )
}

export default function App() {
  const [presentationMode, setPresentationMode] = useState(false)
  const [fileMessage, setFileMessage] = useState('')

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
    muteTts,
    speedMultiplier,
    tts,
    projects,
    currentProjectId,
    projectSelectorOpen,
    bootstrap,
    setScript,
    loadSample,
    setMuteTts,
    setSpeedMultiplier,
    setTtsVolume,
    openProjectSelector,
    closeProjectSelector,
    createProject,
    updateProject,
    deleteProject,
    chooseProject,
    validate,
    play,
    pause,
    resume,
    restart,
    stop,
    nextStep
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
  const hasPresentation = presentationMode || orderedPanels.length > 0 || status === 'paused' || status === 'playing'

  async function pickFilePath() {
    const filePath = await window.smh.pickFile(currentProject?.rootPath ?? null)
    if (!filePath) return

    const displayPath = relativePath(filePath, currentProject?.rootPath)

    try {
      await navigator.clipboard.writeText(displayPath)
      setFileMessage(`Copied path: ${displayPath}`)
    } catch {
      setFileMessage(`Selected path: ${displayPath}`)
    }

    window.setTimeout(() => setFileMessage(''), 4000)
  }

  async function handleRun() {
    setPresentationMode(true)
    await play()
  }

  async function handleRestart() {
    setPresentationMode(true)
    await restart()
  }

  async function handleNextStep() {
    setPresentationMode(true)
    await nextStep()
  }

  function handleClosePresentation() {
    stop()
    setPresentationMode(false)
  }

  function handleResume() {
    setPresentationMode(true)
    resume()
  }

  if (!bootstrapped) {
    return <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-400">Loading ShowMeHow...</div>
  }

  if (projectSelectorOpen) {
    return (
      <ProjectSelector
        projects={projects}
        currentProjectId={currentProjectId}
        pendingScriptPath={pendingScriptPath}
        canClose={Boolean(currentProject) && !pendingScriptPath}
        onClose={closeProjectSelector}
        onSelect={chooseProject}
        onCreate={createProject}
        onUpdate={updateProject}
        onDelete={deleteProject}
      />
    )
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      {hasPresentation ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="border-b border-zinc-800 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[260px] flex-1">
                <div className="text-base font-semibold text-white">{meta.title || 'Presentation'}</div>
                <div className="mt-1 text-sm text-zinc-400">
                  {currentProject?.name || 'No project selected'} · {status}
                  {currentAction ? ` · line ${currentAction.sourceLine} · ${currentAction.summary}` : ''}
                </div>
              </div>

              <button className={buttonClass('ghost')} onClick={handleClosePresentation}>
                Close presentation
              </button>
              {status === 'playing' ? (
                <button className={buttonClass()} onClick={pause}>
                  Pause
                </button>
              ) : (
                <button className={buttonClass()} onClick={handleResume} disabled={status !== 'paused'}>
                  Resume
                </button>
              )}
              <button className={buttonClass()} onClick={() => void handleRestart()}>
                Restart
              </button>
              <button className={buttonClass()} onClick={() => void handleNextStep()}>
                Next step
              </button>
            </div>

          </header>

          <NarrationBar tts={tts} onPause={pause} onResume={handleResume} onVolumeChange={setTtsVolume} />

          <main className="min-h-0 flex-1 p-3">
            <div
              className={`grid h-full min-h-0 gap-3 ${layoutMode === 'single' ? 'grid-cols-1' : 'grid-cols-2'} ${
                layoutMode === 'grid' ? 'auto-rows-fr' : ''
              }`}
            >
              {orderedPanels.map((panel) => (
                <div key={panel.id} className={`flex min-h-0 min-w-0 flex-col ${panel.focused ? 'ring-1 ring-amber-400' : ''}`}>
                  <div className="flex items-center justify-between rounded-t-md border border-b-0 border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
                    <span>{panel.filePath ? relativePath(panel.filePath, currentProject?.rootPath) : `${panel.id} · ${panel.type}`}</span>
                    <span>{panel.focused ? 'focused' : ''}</span>
                  </div>
                  <div className="min-h-0 flex-1">
                    {panel.type === 'code' ? (
                      <CodePanel panel={panel} />
                    ) : (
                      <div className="flex h-full items-center justify-center border border-zinc-800 bg-zinc-950 text-sm text-zinc-500">
                        Browser panels are disabled in this prototype.
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {orderedPanels.length === 0 ? (
                <div className="flex min-h-0 items-center justify-center rounded-md border border-dashed border-zinc-800 text-sm text-zinc-500">
                  Run a script to open code panels.
                </div>
              ) : null}
            </div>
          </main>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="border-b border-zinc-800 px-4 py-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-[280px] flex-1">
                <div className="text-lg font-semibold text-white">{meta.title || 'ShowMeHow'}</div>
                <div className="mt-1 text-sm text-zinc-400">
                  {currentProject ? `${currentProject.name} · ${currentProject.rootPath}` : 'No project selected'}
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  {scriptPath ? `Script: ${relativePath(scriptPath, currentProject?.rootPath)}` : 'Script: unsaved / sample'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button className={buttonClass('ghost')} onClick={openProjectSelector}>
                  Projects
                </button>
                <button className={buttonClass('ghost')} onClick={loadSample}>
                  Load sample
                </button>
                <button className={buttonClass('ghost')} onClick={() => void pickFilePath()}>
                  Copy file path
                </button>
                <button className={buttonClass()} onClick={() => void validate()}>
                  Validate
                </button>
                <button className={buttonClass('primary')} onClick={() => void handleRun()}>
                  Run script
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-zinc-300">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={muteTts} onChange={(event) => setMuteTts(event.target.checked)} />
                mute narration
              </label>

              <label className="flex items-center gap-2">
                <span className="text-zinc-400">timeline speed</span>
                <select
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                  value={speedMultiplier}
                  onChange={(event) => setSpeedMultiplier(Number(event.target.value))}
                >
                  {speedOptions.map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}x
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-sm text-zinc-500">
                status: {status} · actions: {actions.length} · issues: {diagnostics.length}
              </div>
            </div>
          </header>

          {fileMessage ? <div className="border-b border-zinc-800 px-4 py-2 text-xs text-amber-300">{fileMessage}</div> : null}

          <main className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 p-4">
              <textarea
                className="h-full w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 p-4 font-mono text-[13px] leading-6 text-zinc-100 outline-none"
                value={script}
                onChange={(event) => setScript(event.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="border-t border-zinc-800 px-4 py-3">
              <div className="grid gap-3 lg:grid-cols-3">
                <details className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3" open={diagnostics.length > 0}>
                  <summary className="cursor-pointer text-sm font-medium text-white">Diagnostics ({diagnostics.length})</summary>
                  <div className="mt-3 max-h-56 overflow-auto text-xs">
                    {diagnostics.length === 0 ? (
                      <div className="text-zinc-500">No diagnostics.</div>
                    ) : (
                      <div className="space-y-3">
                        {diagnostics.map((diagnostic, index) => (
                          <div key={`${diagnostic.code}-${index}`} className="rounded border border-zinc-800 bg-zinc-950/80 p-2">
                            <div className={diagnostic.severity === 'error' ? 'text-red-300' : 'text-amber-300'}>
                              {diagnostic.severity.toUpperCase()} · line {diagnostic.line}
                            </div>
                            <div className="mt-1 text-zinc-200">{diagnostic.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>

                <details className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-white">Timeline ({actions.length})</summary>
                  <div className="mt-3 max-h-56 overflow-auto text-xs">
                    {actions.length === 0 ? (
                      <div className="text-zinc-500">No actions yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {actions.map((action, index) => {
                          const rowStatus = actionStatuses[action.id] || 'pending'
                          const active = index === currentActionIndex && status !== 'completed'
                          return (
                            <div
                              key={action.id}
                              className={`rounded border p-2 ${
                                active ? 'border-amber-500/60 bg-amber-500/10' : 'border-zinc-800 bg-zinc-950/80'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3 text-zinc-400">
                                <span>
                                  {index + 1}. line {action.sourceLine}
                                </span>
                                <span>{rowStatus}</span>
                              </div>
                              <div className="mt-1 text-zinc-200">{action.summary}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </details>

                <details className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-white">Recent logs ({logs.length})</summary>
                  <div className="mt-3 max-h-56 overflow-auto text-xs">
                    {recentLogs.length === 0 ? (
                      <div className="text-zinc-500">No logs yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {recentLogs.map((log, index) => (
                          <div key={`${log.timestamp}-${index}`} className="rounded border border-zinc-800 bg-zinc-950/80 p-2">
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={
                                  log.level === 'error'
                                    ? 'text-red-300'
                                    : log.level === 'warn'
                                      ? 'text-amber-300'
                                      : 'text-zinc-400'
                                }
                              >
                                {log.level}
                              </span>
                              <span className="text-zinc-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="mt-1 text-zinc-200">{log.message}</div>
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
    </div>
  )
}
