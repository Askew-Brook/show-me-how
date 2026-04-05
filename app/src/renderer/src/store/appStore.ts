import { create, type StoreApi } from 'zustand'
import type { ProjectBootState, ProjectInput, ProjectRecord } from '../lib/projects'
import {
  type ActionStatus,
  createSampleScript,
  type Diagnostic,
  type LayoutMode,
  type ParsedAction,
  parseDocument,
  type PlaybackStatus,
  type PresentationMeta,
  type PanelType,
  validateDocument
} from '../lib/parser'

export interface PrototypePanel {
  id: string
  type: PanelType
  visible: boolean
  focused: boolean
  filePath?: string
  content?: string
  currentLine?: number
  selection?: {
    line: number
    startCol: number
    endCol: number
  }
  highlightRange?: {
    startLine: number
    endLine: number
  }
}

interface RuntimeLogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
  actionId?: string
}

interface AppConfig {
  defaultBrowserTimeoutMs: number
  defaultNavigationTimeoutMs: number
}

interface TtsPlaybackState {
  runId: number | null
  text: string | null
  status: 'idle' | 'playing' | 'paused'
  progressMs: number
  durationMs: number
  volume: number
  rateMultiplier: number
}

interface AppState {
  bootstrapped: boolean
  script: string
  scriptPath: string | null
  pendingScriptPath: string | null
  meta: PresentationMeta
  actions: ParsedAction[]
  diagnostics: Diagnostic[]
  status: PlaybackStatus
  currentActionIndex: number
  actionStatuses: Record<string, ActionStatus>
  panels: Record<string, PrototypePanel>
  panelOrder: string[]
  layoutMode: LayoutMode
  logs: RuntimeLogEntry[]
  muteTts: boolean
  speedMultiplier: number
  tts: TtsPlaybackState
  config: AppConfig
  projects: ProjectRecord[]
  currentProjectId: number | null
  projectSelectorOpen: boolean
  bootstrap: () => Promise<void>
  setScript: (script: string) => void
  loadSample: () => void
  setMuteTts: (mute: boolean) => void
  setSpeedMultiplier: (speed: number) => void
  setTtsVolume: (volume: number) => void
  setTtsRateMultiplier: (rateMultiplier: number) => void
  openProjectSelector: () => void
  closeProjectSelector: () => void
  createProject: (input: ProjectInput) => Promise<void>
  updateProject: (projectId: number, input: ProjectInput) => Promise<void>
  deleteProject: (projectId: number) => Promise<void>
  chooseProject: (projectId: number) => Promise<void>
  validate: () => Promise<boolean>
  play: () => Promise<void>
  pause: () => void
  resume: () => void
  restart: () => Promise<void>
  stop: () => void
  nextStep: () => Promise<void>
}

type StoreSet = StoreApi<AppState>['setState']
type StoreGet = StoreApi<AppState>['getState']

const defaultConfig: AppConfig = {
  defaultBrowserTimeoutMs: 5000,
  defaultNavigationTimeoutMs: 10000
}

function createDefaultTtsState(previous?: TtsPlaybackState): TtsPlaybackState {
  return {
    runId: null,
    text: null,
    status: 'idle',
    progressMs: 0,
    durationMs: 0,
    volume: previous?.volume ?? 1,
    rateMultiplier: previous?.rateMultiplier ?? 1
  }
}

let activeRunId = 0
let activeTtsSession: { runId: number; stop: () => void } | null = null

class RunAbortedError extends Error {
  constructor() {
    super('Run aborted')
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  bootstrapped: false,
  script: createSampleScript(),
  scriptPath: null,
  pendingScriptPath: null,
  meta: {},
  actions: [],
  diagnostics: [],
  status: 'idle',
  currentActionIndex: 0,
  actionStatuses: {},
  panels: {},
  panelOrder: [],
  layoutMode: 'two-column',
  logs: [],
  muteTts: false,
  speedMultiplier: 1,
  tts: createDefaultTtsState(),
  config: defaultConfig,
  projects: [],
  currentProjectId: null,
  projectSelectorOpen: true,

  bootstrap: async () => {
    const [config, bootState] = await Promise.all([window.smh.getConfig(), window.smh.getBootState()])
    const currentProject = bootState.projects.find((project) => project.id === bootState.currentProjectId) || null
    const initialScript = await getInitialScriptForBoot(bootState, currentProject)

    set({
      bootstrapped: true,
      config,
      projects: bootState.projects,
      currentProjectId: bootState.currentProjectId,
      pendingScriptPath: bootState.pendingScriptPath,
      projectSelectorOpen: bootState.currentProjectId === null || (Boolean(bootState.pendingScriptPath) && !currentProject),
      script: initialScript.content,
      scriptPath: initialScript.path
    })

    const unsubscribe = window.smh.onExternalScriptOpened((scriptPath) => {
      void handleIncomingExternalScript(scriptPath, set, get)
    })

    window.addEventListener('beforeunload', () => unsubscribe(), { once: true })

    if (currentProject && bootState.pendingScriptPath) {
      await window.smh.clearPendingScript()
      set({ pendingScriptPath: null, projectSelectorOpen: false })
      const valid = await get().validate()
      if (valid) {
        await get().play()
      }
      return
    }

    if (currentProject && !bootState.pendingScriptPath) {
      await get().validate()
    }
  },

  setScript: (script) => {
    set({ script, scriptPath: null })
  },

  loadSample: () => {
    set({
      script: createSampleScript(currentProjectFor(get)),
      scriptPath: null
    })
  },

  setMuteTts: (muteTts) => set({ muteTts }),
  setSpeedMultiplier: (speedMultiplier) => set({ speedMultiplier }),
  setTtsVolume: (volume) =>
    set((state: AppState) => ({
      tts: {
        ...state.tts,
        volume: Math.max(0, Math.min(1, volume))
      }
    })),
  setTtsRateMultiplier: (rateMultiplier) =>
    set((state: AppState) => ({
      tts: {
        ...state.tts,
        rateMultiplier: Math.max(0.5, Math.min(2, rateMultiplier))
      }
    })),

  openProjectSelector: () => {
    set({ projectSelectorOpen: true })
  },

  closeProjectSelector: () => {
    if (get().pendingScriptPath) return
    if (!currentProjectFor(get)) return
    set({ projectSelectorOpen: false })
  },

  createProject: async (input) => {
    const project = await window.smh.createProject(normalizeProjectInput(input))

    set((state: AppState) => ({
      projects: [...state.projects, project].sort(compareProjects)
    }))
  },

  updateProject: async (projectId, input) => {
    const updatedProject = await window.smh.updateProject(projectId, normalizeProjectInput(input))

    set((state: AppState) => ({
      projects: state.projects.map((project) => (project.id === projectId ? updatedProject : project)).sort(compareProjects)
    }))

    if (get().currentProjectId === projectId && !get().pendingScriptPath) {
      const loaded = await loadDefaultOrSampleScript(updatedProject)
      set({ script: loaded.content, scriptPath: loaded.path })
      await get().validate()
    }
  },

  deleteProject: async (projectId) => {
    const bootState: ProjectBootState = await window.smh.deleteProject(projectId)
    const currentProject = bootState.projects.find((project) => project.id === bootState.currentProjectId) || null
    const loaded = await getInitialScriptForBoot(bootState, currentProject)

    activeRunId += 1
    set({
      projects: bootState.projects,
      currentProjectId: bootState.currentProjectId,
      pendingScriptPath: bootState.pendingScriptPath,
      projectSelectorOpen: bootState.currentProjectId === null || Boolean(bootState.pendingScriptPath),
      script: loaded.content,
      scriptPath: loaded.path,
      meta: {},
      actions: [],
      diagnostics: [],
      status: 'idle',
      currentActionIndex: 0,
      actionStatuses: {},
      panels: {},
      panelOrder: [],
      logs: [],
      layoutMode: 'two-column',
      tts: createDefaultTtsState(get().tts)
    })

    if (currentProject && !bootState.pendingScriptPath) {
      await get().validate()
    }
  },

  chooseProject: async (projectId) => {
    const project = await window.smh.setCurrentProject(projectId)
    activeRunId += 1

    const pendingScriptPath = get().pendingScriptPath
    const scriptToLoad = pendingScriptPath ? await loadExternalScript(pendingScriptPath) : await loadDefaultOrSampleScript(project)

    if (pendingScriptPath) {
      await window.smh.clearPendingScript()
    }

    set((state: AppState) => ({
      currentProjectId: project.id,
      pendingScriptPath: null,
      projectSelectorOpen: false,
      script: scriptToLoad.content,
      scriptPath: scriptToLoad.path,
      meta: {},
      actions: [],
      diagnostics: [],
      status: 'idle',
      currentActionIndex: 0,
      actionStatuses: {},
      panels: {},
      panelOrder: [],
      logs: [],
      layoutMode: 'two-column',
      tts: createDefaultTtsState(state.tts),
      projects: state.projects.map((item) => (item.id === project.id ? project : item)).sort(compareProjects)
    }))

    const valid = await get().validate()
    if (pendingScriptPath && valid) {
      await get().play()
    }
  },

  validate: async () => {
    const result = parseDocument(get().script)
    const diagnostics = await validateDocument(result, currentProjectFor(get))
    const actionStatuses = Object.fromEntries(result.actions.map((action) => [action.id, 'pending' as ActionStatus]))

    set({
      meta: result.meta,
      actions: result.actions,
      diagnostics,
      actionStatuses,
      layoutMode: result.meta.startLayout || get().layoutMode
    })

    const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === 'error')
    return !hasErrors
  },

  play: async () => {
    if (!ensureProjectSelected(set, get)) return
    if (get().status === 'playing') return
    if (get().status === 'paused') {
      set({ status: 'playing' })
      return
    }

    const valid = await get().validate()
    if (!valid) {
      pushLog(set, 'error', 'Validation failed. Fix diagnostics before playing.')
      set({ status: 'error' })
      return
    }

    if (get().status === 'completed') {
      resetRuntime(set, get)
    }

    await runFromCurrentIndex(set, get)
  },

  pause: () => {
    if (get().status === 'playing') {
      set((state: AppState) => ({
        status: 'paused',
        tts: state.tts.text ? { ...state.tts, status: 'paused' } : state.tts
      }))
    }
  },

  resume: () => {
    if (get().status === 'paused') {
      set((state: AppState) => ({
        status: 'playing',
        tts: state.tts.text ? { ...state.tts, status: 'playing' } : state.tts
      }))
    }
  },

  restart: async () => {
    if (!ensureProjectSelected(set, get)) return

    abortActiveRun(set, get)

    const valid = await get().validate()
    if (!valid) {
      pushLog(set, 'error', 'Validation failed. Fix diagnostics before restarting.')
      set({ status: 'error' })
      return
    }

    resetRuntime(set, get)
    await runFromCurrentIndex(set, get)
  },

  stop: () => {
    abortActiveRun(set, get)
    resetRuntime(set, get)
  },

  nextStep: async () => {
    if (!ensureProjectSelected(set, get)) return
    if (get().status === 'playing') return

    const valid = await get().validate()
    if (!valid) {
      pushLog(set, 'error', 'Validation failed. Fix diagnostics before stepping.')
      set({ status: 'error' })
      return
    }

    const { actions, currentActionIndex } = get()
    if (currentActionIndex >= actions.length) {
      set({ status: 'completed' })
      return
    }

    const action = actions[currentActionIndex]
    const runId = ++activeRunId
    try {
      setActionStatus(set, action.id, 'running')
      await executeAction(action, set, get, runId)
      if (runId !== activeRunId) {
        throw new RunAbortedError()
      }
      setActionStatus(set, action.id, 'done')
      const nextIndex = currentActionIndex + 1
      set({
        currentActionIndex: nextIndex,
        status: nextIndex >= actions.length ? 'completed' : 'idle'
      })
    } catch (error) {
      setActionStatus(set, action.id, 'failed')
      set({ status: 'error' })
      pushLog(set, 'error', error instanceof Error ? error.message : 'Step failed', action.id)
    }
  }
}))

function normalizeProjectInput(input: ProjectInput) {
  return {
    name: input.name,
    rootPath: input.rootPath,
    defaultScriptPath: input.defaultScriptPath.trim() || null
  }
}

function compareProjects(a: ProjectRecord, b: ProjectRecord) {
  return a.name.localeCompare(b.name)
}

function currentProjectFor(get: StoreGet) {
  const state = get()
  return state.projects.find((project) => project.id === state.currentProjectId) || null
}

async function getInitialScriptForBoot(bootState: ProjectBootState, currentProject: ProjectRecord | null) {
  if (bootState.pendingScriptPath) {
    return loadExternalScript(bootState.pendingScriptPath)
  }

  if (currentProject) {
    return loadDefaultOrSampleScript(currentProject)
  }

  return {
    content: createSampleScript(),
    path: null
  }
}

async function handleIncomingExternalScript(scriptPath: string, set: StoreSet, get: StoreGet) {
  const loaded = await loadExternalScript(scriptPath)
  activeRunId += 1

  const project = currentProjectFor(get)
  const hasProject = Boolean(project)

  set({
    pendingScriptPath: hasProject ? null : scriptPath,
    projectSelectorOpen: !hasProject,
    script: loaded.content,
    scriptPath: loaded.path,
    meta: {},
    actions: [],
    diagnostics: [],
    status: 'idle',
    currentActionIndex: 0,
    actionStatuses: {},
    panels: {},
    panelOrder: [],
    logs: [],
    layoutMode: 'two-column',
    tts: createDefaultTtsState(get().tts)
  })

  if (hasProject) {
    await window.smh.clearPendingScript()
    const valid = await get().validate()
    if (valid) {
      await get().play()
    }
    return
  }
}

async function loadDefaultOrSampleScript(project: ProjectRecord) {
  if (project.defaultScriptPath) {
    const file = await window.smh.readTextFile(project.defaultScriptPath, project.rootPath)
    if (file.exists) {
      return {
        content: file.content,
        path: file.path
      }
    }
  }

  return {
    content: createSampleScript(project),
    path: null
  }
}

async function loadExternalScript(scriptPath: string) {
  const file = await window.smh.readTextFile(scriptPath, null)
  if (!file.exists) {
    throw new Error(`Presentation file not found: ${scriptPath}`)
  }

  return {
    content: file.content,
    path: file.path
  }
}

function ensureProjectSelected(set: StoreSet, get: StoreGet) {
  if (currentProjectFor(get)) {
    return true
  }

  set({ projectSelectorOpen: true })
  return false
}

async function runFromCurrentIndex(set: StoreSet, get: StoreGet) {
  activeRunId += 1
  const runId = activeRunId
  const { actions } = get()

  set({ status: 'playing' })
  pushLog(set, 'info', 'Playback started')

  try {
    for (let index = get().currentActionIndex; index < actions.length; index += 1) {
      await waitWhilePaused(get, runId)

      const action = actions[index]
      set({ currentActionIndex: index })
      setActionStatus(set, action.id, 'running')

      if (!action.isExecutable) {
        setActionStatus(set, action.id, 'done')
        continue
      }

      await executeAction(action, set, get, runId)
      if (runId !== activeRunId) {
        throw new RunAbortedError()
      }
      setActionStatus(set, action.id, 'done')
      set({ currentActionIndex: index + 1 })
    }

    if (activeRunId === runId) {
      set({ status: 'completed' })
      pushLog(set, 'info', 'Playback completed')
    }
  } catch (error) {
    if (error instanceof RunAbortedError) {
      return
    }

    const action = actions[get().currentActionIndex]
    if (action) {
      setActionStatus(set, action.id, 'failed')
    }

    set({ status: 'error' })
    pushLog(set, 'error', error instanceof Error ? error.message : 'Playback failed', action?.id)
  }
}

function abortActiveRun(set: StoreSet, get: StoreGet) {
  activeRunId += 1
  activeTtsSession?.stop()

  set((state: AppState) => ({
    status: 'idle',
    tts: createDefaultTtsState(state.tts)
  }))
}

function resetRuntime(set: StoreSet, get: StoreGet) {
  const actionStatuses = Object.fromEntries(get().actions.map((action) => [action.id, 'pending' as ActionStatus]))

  set({
    status: 'idle',
    currentActionIndex: 0,
    actionStatuses,
    panels: {},
    panelOrder: [],
    logs: [],
    layoutMode: get().meta.startLayout || 'two-column',
    tts: createDefaultTtsState(get().tts)
  })
}

async function executeAction(action: ParsedAction, set: StoreSet, get: StoreGet, runId: number) {
  const currentProject = currentProjectFor(get)

  switch (action.command) {
    case 'new_panel': {
      const [panelId, panelType] = action.args as [string, PanelType]
      set((state: AppState) => ({
        panels: {
          ...state.panels,
          [panelId]: {
            id: panelId,
            type: panelType,
            visible: true,
            focused: false
          }
        },
        panelOrder: state.panelOrder.includes(panelId) ? state.panelOrder : [...state.panelOrder, panelId]
      }))
      pushLog(set, 'info', `Created ${panelType} panel ${panelId}`, action.id)
      return
    }

    case 'close_panel': {
      const [panelId] = action.args as [string]
      set((state: AppState) => {
        const panels = { ...state.panels }
        delete panels[panelId]
        return {
          panels,
          panelOrder: state.panelOrder.filter((id: string) => id !== panelId)
        }
      })
      pushLog(set, 'info', `Closed panel ${panelId}`, action.id)
      return
    }

    case 'layout': {
      const [mode] = action.args as [LayoutMode]
      set({ layoutMode: mode })
      pushLog(set, 'info', `Layout set to ${mode}`, action.id)
      return
    }

    case 'focus_panel': {
      const [panelId] = action.args as [string]
      set((state: AppState) => ({
        panels: Object.fromEntries(
          Object.entries(state.panels).map(([id, panel]) => [id, { ...panel, focused: id === panelId }])
        )
      }))
      pushLog(set, 'info', `Focused panel ${panelId}`, action.id)
      return
    }

    case 'open_code': {
      const [panelId, filePath, line] = action.args as [string, string, number | undefined]
      const file = await window.smh.readTextFile(filePath, currentProject?.rootPath ?? null)
      if (!file.exists) {
        throw new Error(`File not found: ${file.path}`)
      }

      set((state: AppState) => {
        const panel = state.panels[panelId]
        if (!panel) return state

        return {
          panels: {
            ...state.panels,
            [panelId]: {
              ...panel,
              filePath: file.path,
              content: file.content,
              currentLine: line,
              selection: undefined,
              highlightRange: undefined
            }
          }
        }
      })
      pushLog(set, 'info', `Loaded file ${file.path}`, action.id)
      return
    }

    case 'scroll_code': {
      const [panelId, line] = action.args as [string, number]
      updatePanel(set, panelId, { currentLine: line })
      return
    }

    case 'select_code': {
      const [panelId, line, startCol, endCol] = action.args as [string, number, number, number]
      updatePanel(set, panelId, {
        currentLine: line,
        selection: { line, startCol, endCol }
      })
      return
    }

    case 'select_code_line': {
      const [panelId, line, startColInput] = action.args as [string, number, number | undefined]
      const panel = get().panels[panelId]
      const content = panel?.content

      if (!content) {
        throw new Error(`Cannot select line before file is loaded in ${panelId}`)
      }

      const lines = content.split('\n')
      const lineText = lines[line - 1]
      if (lineText == null) {
        throw new Error(`Line ${line} does not exist in ${panelId}`)
      }

      const startCol = startColInput ?? 0
      const endCol = lineText.length

      updatePanel(set, panelId, {
        currentLine: line,
        selection: { line, startCol, endCol }
      })
      return
    }

    case 'highlight_lines': {
      const [panelId, startLine, endLine] = action.args as [string, number, number]
      updatePanel(set, panelId, {
        currentLine: startLine,
        highlightRange: { startLine, endLine }
      })
      return
    }

    case 'clear_code_selection': {
      const [panelId] = action.args as [string]
      updatePanel(set, panelId, {
        selection: undefined,
        highlightRange: undefined
      })
      return
    }

    case 'open_browser':
    case 'click_text':
    case 'type_text':
    case 'wait_for_text':
    case 'wait_for_navigation':
    case 'highlight_text':
    case 'press_key':
    case 'browser_back':
    case 'browser_forward':
    case 'browser_reload': {
      throw new Error(`Browser actions are disabled in this prototype: ${action.command}`)
    }

    case 'pause': {
      const [seconds] = action.args as [number]
      await delay((seconds * 1000) / get().speedMultiplier, get, runId)
      return
    }

    case 'tts': {
      const [text] = action.args as [string]
      await speakText(text, get().muteTts, get().meta.rate, set, get, runId)
      pushLog(set, 'info', 'TTS completed', action.id)
      return
    }

    case 'note': {
      const [text] = action.args as [string]
      pushLog(set, 'info', `Note: ${text}`, action.id)
      return
    }

    default:
      pushLog(set, 'warn', `Command not implemented: ${action.command}`, action.id)
  }
}

function updatePanel(set: StoreSet, panelId: string, patch: Partial<PrototypePanel>) {
  set((state: AppState) => {
    const panel = state.panels[panelId]
    if (!panel) return state

    return {
      panels: {
        ...state.panels,
        [panelId]: {
          ...panel,
          ...patch
        }
      }
    }
  })
}

function setActionStatus(set: StoreSet, actionId: string, status: ActionStatus) {
  set((state: AppState) => ({
    actionStatuses: {
      ...state.actionStatuses,
      [actionId]: status
    }
  }))
}

function pushLog(set: StoreSet, level: RuntimeLogEntry['level'], message: string, actionId?: string) {
  set((state: AppState) => ({
    logs: [...state.logs, { timestamp: Date.now(), level, message, actionId }]
  }))
}

async function waitWhilePaused(get: StoreGet, runId: number) {
  while (get().status === 'paused') {
    if (runId !== activeRunId) {
      throw new RunAbortedError()
    }
    await delay(75)
  }

  if (runId !== activeRunId || get().status === 'idle') {
    throw new RunAbortedError()
  }
}

function delay(ms: number, get?: StoreGet, runId?: number) {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now()

    const tick = () => {
      if (runId != null && runId !== activeRunId) {
        reject(new RunAbortedError())
        return
      }

      if (get?.().status === 'idle') {
        reject(new RunAbortedError())
        return
      }

      if (get?.().status === 'paused') {
        window.setTimeout(tick, 75)
        return
      }

      if (Date.now() - started >= ms) {
        resolve()
        return
      }

      window.setTimeout(tick, 25)
    }

    window.setTimeout(tick, 25)
  })
}

async function speakText(text: string, mute: boolean, rate: number | undefined, set: StoreSet, get: StoreGet, runId: number) {
  if (mute) {
    await delay(50, get, runId)
    return
  }

  const voice = get().meta.voice?.trim() || null
  const wordsPerMinute = rate && rate > 0 ? Math.round(175 * rate) : null
  const speechFile = await window.smh.synthesizeSpeechToFile(text, {
    voice,
    rate: wordsPerMinute
  })

  if (runId !== activeRunId) {
    throw new RunAbortedError()
  }

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) {
    throw new Error('Web Audio is not available in this environment')
  }

  const audioContext = new AudioContextClass()
  const wavBuffer = decodeBase64Audio(speechFile.base64Audio)
  const decodedBuffer = await audioContext.decodeAudioData(wavBuffer)
  const durationMs = decodedBuffer.duration * 1000
  const source = audioContext.createBufferSource()
  const gainNode = audioContext.createGain()

  source.buffer = decodedBuffer
  gainNode.gain.value = get().tts.volume
  source.connect(gainNode)
  gainNode.connect(audioContext.destination)

  set((state: AppState) => ({
    tts: {
      ...state.tts,
      runId,
      text,
      status: 'playing',
      progressMs: 0,
      durationMs
    }
  }))

  if (runId !== activeRunId) {
    throw new RunAbortedError()
  }

  await audioContext.resume()

  await new Promise<void>((resolve, reject) => {
    let finished = false
    let playedMs = 0
    let lastTickTime = audioContext.currentTime

    const cleanup = () => {
      if (finished) return
      finished = true
      window.clearInterval(intervalId)
      source.onended = null
      source.disconnect()
      gainNode.disconnect()
      void audioContext.close()
      if (activeTtsSession?.runId === runId) {
        activeTtsSession = null
      }
      set((state: AppState) => ({
        tts: state.tts.runId === runId ? createDefaultTtsState(state.tts) : state.tts
      }))
    }

    const fail = (error: Error) => {
      try {
        source.stop()
      } catch {
        // Ignore stop errors during cancellation.
      }
      cleanup()
      reject(error)
    }

    activeTtsSession = {
      runId,
      stop: () => {
        fail(new RunAbortedError())
      }
    }

    const intervalId = window.setInterval(() => {
      const runtimeStatus = get().status
      const now = audioContext.currentTime
      const deltaMs = Math.max(0, (now - lastTickTime) * 1000)
      lastTickTime = now

      if (runId !== activeRunId || runtimeStatus === 'idle') {
        fail(new RunAbortedError())
        return
      }

      if (runtimeStatus === 'paused') {
        set((state: AppState) => ({
          tts: state.tts.runId === runId ? { ...state.tts, status: 'paused' } : state.tts
        }))
        void audioContext.suspend()
        return
      }

      if (runtimeStatus === 'playing') {
        if (audioContext.state === 'suspended') {
          void audioContext.resume().catch(() => fail(new Error('System TTS audio playback failed')))
        }

        playedMs = Math.min(durationMs, playedMs + deltaMs)
        gainNode.gain.value = get().tts.volume

        set((state: AppState) => ({
          tts:
            state.tts.runId === runId
              ? {
                  ...state.tts,
                  status: 'playing',
                  progressMs: playedMs,
                  durationMs
                }
              : state.tts
        }))
      }
    }, 50)

    source.onended = () => {
      cleanup()
      resolve()
    }

    try {
      source.start(0)
    } catch {
      fail(new Error('System TTS audio playback failed'))
    }
  })
}

function decodeBase64Audio(base64Audio: string) {
  const binary = window.atob(base64Audio)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}
