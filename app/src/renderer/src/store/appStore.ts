import { create, type StoreApi } from 'zustand'
import type { ProjectBootState, ProjectImportResult, ProjectInput, ProjectRecord, RecentPresentationEntry } from '../lib/projects'
import {
  type ActionStatus,
  type Diagnostic,
  type LayoutMode,
  type ParsedAction,
  parseDocument,
  type PlaybackStatus,
  type PresentationMeta,
  type PanelType,
  validateDocument
} from '../lib/parser'
import { type ReviewComment, type ReviewDraft, normalizeReviewRange } from '../lib/review'

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

interface TtsCacheRequest {
  text: string
  voice?: string | null
  rate?: number | null
}

interface TtsPlaybackState {
  runId: number | null
  text: string | null
  status: 'idle' | 'playing' | 'paused'
  progressMs: number
  durationMs: number
  volume: number
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
  recentPresentationPaths: RecentPresentationEntry[]
  tts: TtsPlaybackState
  projects: ProjectRecord[]
  currentProjectId: number | null
  projectSelectorOpen: boolean
  reviewComments: ReviewComment[]
  reviewDraft: ReviewDraft | null
  reviewSummarySelection: string | null
  bootstrap: () => Promise<void>
  setScript: (script: string) => void
  openScript: () => Promise<string | null>
  openRecentPresentation: (entry: RecentPresentationEntry) => Promise<void>
  clearCurrentScript: () => void
  setTtsVolume: (volume: number) => void
  openProjectSelector: () => Promise<void>
  createProject: (input: ProjectInput) => Promise<ProjectRecord>
  importProjectsFromParent: (parentPath: string) => Promise<ProjectImportResult>
  updateProject: (projectId: number, input: ProjectInput) => Promise<void>
  deleteProject: (projectId: number) => Promise<void>
  chooseProject: (projectId: number) => Promise<void>
  startReviewDraft: (
    panelId: string,
    selection: { startLine: number; endLine: number; startColumn?: number; endColumn?: number }
  ) => void
  startReviewDraftForFile: (input: {
    panelId: string
    absolutePath: string
    relativePath: string
    startLine: number
    endLine: number
    startColumn?: number
    endColumn?: number
  }) => void
  setReviewDraftBody: (body: string) => void
  saveReviewDraft: () => void
  cancelReviewDraft: () => void
  editReviewComment: (commentId: string) => void
  deleteReviewComment: (commentId: string) => void
  clearReviewComments: () => void
  setReviewSummarySelection: (relativePath: string | null) => void
  validate: () => Promise<boolean>
  play: () => Promise<void>
  pause: () => void
  resume: () => void
  restart: () => Promise<void>
  stop: () => void
  nextStep: () => Promise<void>
  skipForward: () => Promise<void>
  skipToSummary: () => void
}

type StoreSet = StoreApi<AppState>['setState']
type StoreGet = StoreApi<AppState>['getState']

function createDefaultTtsState(previous?: TtsPlaybackState): TtsPlaybackState {
  return {
    runId: null,
    text: null,
    status: 'idle',
    progressMs: 0,
    durationMs: 0,
    volume: previous?.volume ?? 1
  }
}

let activeRunId = 0
let activeTtsSession: { runId: number; stop: () => void } | null = null
let activeSkippableAction: { runId: number; actionId: string; skip: () => void } | null = null
let pendingSkipCount = 0
const TTS_TRAILING_SILENCE_MS = 180
const TTS_END_GRACE_MS = 120
const TTS_STALL_BUFFER_MS = 1000
const TTS_MIN_FALLBACK_TIMEOUT_MS = 4000

class RunAbortedError extends Error {
  constructor() {
    super('Run aborted')
  }
}

class SkipActionError extends Error {
  constructor(actionId?: string) {
    super(actionId ? `Skipped action: ${actionId}` : 'Skipped action')
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  bootstrapped: false,
  script: '',
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
  recentPresentationPaths: [],
  tts: createDefaultTtsState(),
  projects: [],
  currentProjectId: null,
  projectSelectorOpen: true,
  reviewComments: [],
  reviewDraft: null,
  reviewSummarySelection: null,

  bootstrap: async () => {
    const [recentPresentationPaths, normalizedBootState] = await Promise.all([
      window.smh.getRecentPresentationPaths(),
      window.smh.clearCurrentProject()
    ])
    const currentProject = normalizedBootState.projects.find((project) => project.id === normalizedBootState.currentProjectId) || null
    const initialScript = await getInitialScriptForBoot(normalizedBootState, currentProject)

    set({
      bootstrapped: true,
      projects: normalizedBootState.projects,
      currentProjectId: normalizedBootState.currentProjectId,
      pendingScriptPath: normalizedBootState.pendingScriptPath,
      projectSelectorOpen: true,
      recentPresentationPaths,
      script: initialScript.content,
      scriptPath: initialScript.path
    })

    const unsubscribe = window.smh.onExternalScriptOpened((scriptPath) => {
      void handleIncomingExternalScript(scriptPath, set, get)
    })

    window.addEventListener('beforeunload', () => unsubscribe(), { once: true })

  },

  setScript: (script) => {
    set({ script, scriptPath: null })
  },

  openScript: async () => {
    const project = currentProjectFor(get)
    const filePath = await window.smh.pickPresentationFile(project?.rootPath ?? null)
    if (!filePath) {
      return null
    }

    await openPresentationScript(filePath, set, get, { openSelector: !project, autoPlay: false })
    return filePath
  },

  openRecentPresentation: async (entry) => {
    await openRecentPresentationEntry(entry, set, get)
  },

  clearCurrentScript: () => {
    abortActiveRun(set, get)
    set((state: AppState) => ({
      script: '',
      scriptPath: null,
      pendingScriptPath: null,
      projectSelectorOpen: state.currentProjectId == null,
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
      ...clearReviewState()
    }))
  },

  setTtsVolume: (volume) =>
    set((state: AppState) => ({
      tts: {
        ...state.tts,
        volume: Math.max(0, Math.min(1, volume))
      }
    })),

  openProjectSelector: async () => {
    abortActiveRun(set, get)
    await window.smh.clearCurrentProject()
    set({
      currentProjectId: null,
      projectSelectorOpen: true,
      status: 'idle',
      panels: {},
      panelOrder: [],
      actionStatuses: {},
      currentActionIndex: 0,
      tts: createDefaultTtsState(get().tts),
      ...clearReviewState()
    })
  },

  createProject: async (input) => {
    const project = await window.smh.createProject(normalizeProjectInput(input))

    set((state: AppState) => ({
      projects: [...state.projects, project].sort(compareProjects)
    }))

    return project
  },

  importProjectsFromParent: async (parentPath) => {
    const result = await window.smh.importProjectsFromParent(parentPath)

    set((state: AppState) => ({
      projects: result.projects.sort(compareProjects),
      currentProjectId:
        state.currentProjectId != null && result.projects.some((project) => project.id === state.currentProjectId)
          ? state.currentProjectId
          : state.currentProjectId
    }))

    return result
  },

  updateProject: async (projectId, input) => {
    const updatedProject = await window.smh.updateProject(projectId, normalizeProjectInput(input))

    set((state: AppState) => ({
      projects: state.projects.map((project) => (project.id === projectId ? updatedProject : project)).sort(compareProjects)
    }))

    if (get().currentProjectId === projectId && !get().pendingScriptPath) {
      await get().validate()
    }
  },

  deleteProject: async (projectId) => {
    const bootState: ProjectBootState = await window.smh.deleteProject(projectId)
    const loaded = await getInitialScriptForBoot(bootState, null)

    activeRunId += 1
    set({
      projects: bootState.projects,
      currentProjectId: bootState.currentProjectId,
      pendingScriptPath: bootState.pendingScriptPath,
      projectSelectorOpen: true,
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
      tts: createDefaultTtsState(get().tts),
      ...clearReviewState()
    })
  },

  chooseProject: async (projectId) => {
    const selectedProject = get().projects.find((project) => project.id === projectId)
    if (!selectedProject) {
      throw new Error('Project not found')
    }

    activeRunId += 1

    const pendingScriptPath = get().pendingScriptPath
    const scriptToLoad = pendingScriptPath ? await loadExternalScript(pendingScriptPath) : null

    if (pendingScriptPath) {
      const validation = await validateScriptAgainstProject(scriptToLoad?.content ?? get().script, selectedProject)

      set({
        meta: validation.meta,
        actions: validation.actions,
        diagnostics: validation.diagnostics,
        actionStatuses: validation.actionStatuses,
        layoutMode: validation.meta.startLayout || 'two-column'
      })

      if (validation.hasErrors) {
        window.alert(buildValidationFailureAlert(pendingScriptPath, selectedProject, validation.diagnostics))
        return
      }
    }

    const project = await window.smh.setCurrentProject(projectId)

    const recentPresentationPaths = pendingScriptPath
      ? await window.smh.rememberRecentPresentationPath(scriptToLoad?.path ?? pendingScriptPath, project.id)
      : get().recentPresentationPaths

    if (pendingScriptPath) {
      await window.smh.clearPendingScript()
    }

    set((state: AppState) => ({
      currentProjectId: project.id,
      pendingScriptPath: null,
      projectSelectorOpen: false,
      recentPresentationPaths,
      script: scriptToLoad?.content ?? state.script,
      scriptPath: scriptToLoad?.path ?? state.scriptPath,
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
      ...clearReviewState(),
      projects: state.projects.map((item) => (item.id === project.id ? project : item)).sort(compareProjects)
    }))

    const valid = await get().validate()
    if (pendingScriptPath && valid) {
      await get().play()
    }
  },

  startReviewDraft: (panelId, selection) => {
    const panel = get().panels[panelId]
    const currentProject = currentProjectFor(get)
    const absolutePath = panel?.filePath
    if (!absolutePath) {
      return
    }

    setReviewDraftState(set, {
      panelId,
      absolutePath,
      relativePath: relativePath(absolutePath, currentProject?.rootPath),
      startLine: selection.startLine,
      endLine: selection.endLine,
      startColumn: selection.startColumn,
      endColumn: selection.endColumn
    })
  },

  startReviewDraftForFile: (input) => {
    setReviewDraftState(set, input)
  },

  setReviewDraftBody: (body) =>
    set((state: AppState) => ({
      reviewDraft: state.reviewDraft
        ? {
            ...state.reviewDraft,
            body
          }
        : null
    })),

  saveReviewDraft: () => {
    const draft = get().reviewDraft
    if (!draft) {
      return
    }

    const body = draft.body.trim()
    if (!body) {
      set({ reviewDraft: null })
      return
    }

    const now = Date.now()

    set((state: AppState) => {
      if (!state.reviewDraft) {
        return state
      }

      if (state.reviewDraft.commentId) {
        return {
          reviewComments: state.reviewComments.map((comment) =>
            comment.id === state.reviewDraft?.commentId
              ? {
                  ...comment,
                  panelId: state.reviewDraft.panelId,
                  absolutePath: state.reviewDraft.absolutePath,
                  relativePath: state.reviewDraft.relativePath,
                  startLine: state.reviewDraft.startLine,
                  endLine: state.reviewDraft.endLine,
                  startColumn: state.reviewDraft.startColumn,
                  endColumn: state.reviewDraft.endColumn,
                  body,
                  updatedAt: now
                }
              : comment
          ),
          reviewDraft: null,
          reviewSummarySelection: state.reviewDraft.relativePath
        }
      }

      return {
        reviewComments: [
          ...state.reviewComments,
          {
            id: createReviewCommentId(),
            panelId: state.reviewDraft.panelId,
            absolutePath: state.reviewDraft.absolutePath,
            relativePath: state.reviewDraft.relativePath,
            startLine: state.reviewDraft.startLine,
            endLine: state.reviewDraft.endLine,
            startColumn: state.reviewDraft.startColumn,
            endColumn: state.reviewDraft.endColumn,
            body,
            createdAt: now,
            updatedAt: now
          }
        ],
        reviewDraft: null,
        reviewSummarySelection: state.reviewDraft.relativePath
      }
    })
  },

  cancelReviewDraft: () => {
    set({ reviewDraft: null })
  },

  editReviewComment: (commentId) => {
    const comment = get().reviewComments.find((entry) => entry.id === commentId)
    if (!comment) {
      return
    }

    set({
      reviewDraft: {
        commentId: comment.id,
        panelId: get().status === 'completed' ? 'review-summary-preview' : comment.panelId,
        absolutePath: comment.absolutePath,
        relativePath: comment.relativePath,
        startLine: comment.startLine,
        endLine: comment.endLine,
        startColumn: comment.startColumn,
        endColumn: comment.endColumn,
        body: comment.body
      },
      reviewSummarySelection: comment.relativePath
    })
  },

  deleteReviewComment: (commentId) =>
    set((state: AppState) => ({
      reviewComments: state.reviewComments.filter((comment) => comment.id !== commentId),
      reviewDraft: state.reviewDraft?.commentId === commentId ? null : state.reviewDraft
    })),

  clearReviewComments: () => set(clearReviewState()),

  setReviewSummarySelection: (relativePathValue) => {
    set({ reviewSummarySelection: relativePathValue })
  },

  validate: async () => {
    const validation = await validateScriptAgainstProject(get().script, currentProjectFor(get))

    set({
      meta: validation.meta,
      actions: validation.actions,
      diagnostics: validation.diagnostics,
      actionStatuses: validation.actionStatuses,
      layoutMode: validation.meta.startLayout || get().layoutMode
    })

    if (!validation.hasErrors) {
      void primeTtsCacheForValidation(validation)
    }

    return !validation.hasErrors
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

    await rememberCurrentScriptProject(get, set)
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
    await rememberCurrentScriptProject(get, set)
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

    await rememberCurrentScriptProject(get, set)

    const action = actions[currentActionIndex]
    const runId = ++activeRunId
    try {
      if (consumeSkipRequest()) {
        setActionStatus(set, action.id, 'skipped')
        const nextIndex = currentActionIndex + 1
        set({
          currentActionIndex: nextIndex,
          status: nextIndex >= actions.length ? 'completed' : 'idle'
        })
        return
      }

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
      if (error instanceof SkipActionError) {
        consumeSkipRequest()
        setActionStatus(set, action.id, 'skipped')
        const nextIndex = currentActionIndex + 1
        set({
          currentActionIndex: nextIndex,
          status: nextIndex >= actions.length ? 'completed' : 'idle'
        })
        return
      }

      setActionStatus(set, action.id, 'failed')
      set({ status: 'error' })
      pushLog(set, 'error', error instanceof Error ? error.message : 'Step failed', action.id)
    }
  },

  skipForward: async () => {
    if (!ensureProjectSelected(set, get)) return

    const status = get().status
    if (status === 'completed' || status === 'error') {
      return
    }

    if (status === 'playing' || status === 'paused') {
      pendingSkipCount += 1
      activeSkippableAction?.skip()
      return
    }

    await get().nextStep()
  },

  skipToSummary: () => {
    if (!ensureProjectSelected(set, get)) return

    const { actions, currentActionIndex, status } = get()
    if (status === 'completed') {
      return
    }

    activeRunId += 1
    clearSkipQueue()
    activeTtsSession?.stop()

    set((state: AppState) => ({
      status: 'completed',
      currentActionIndex: actions.length,
      actionStatuses: Object.fromEntries(
        actions.map((action, index) => {
          const existing = state.actionStatuses[action.id] || 'pending'
          if (existing === 'done' || existing === 'failed') {
            return [action.id, existing]
          }

          return [action.id, index >= currentActionIndex ? 'skipped' : existing]
        })
      ),
      tts: createDefaultTtsState(state.tts)
    }))

    pushLog(set, 'info', 'Skipped to summary')
  }
}))

function normalizeProjectInput(input: ProjectInput) {
  return {
    name: input.name,
    rootPath: input.rootPath
  }
}

function compareProjects(a: ProjectRecord, b: ProjectRecord) {
  return a.name.localeCompare(b.name)
}

async function validateScriptAgainstProject(script: string, project?: ProjectRecord | null) {
  const result = parseDocument(script)
  const diagnostics = await validateDocument(result, project)
  const actionStatuses = Object.fromEntries(result.actions.map((action) => [action.id, 'pending' as ActionStatus]))

  return {
    meta: result.meta,
    actions: result.actions,
    diagnostics,
    actionStatuses,
    hasErrors: diagnostics.some((diagnostic) => diagnostic.severity === 'error')
  }
}

function buildTtsCacheRequests(actions: ParsedAction[], meta: PresentationMeta): TtsCacheRequest[] {
  const voice = meta.voice?.trim() || null
  const rate = meta.rate && meta.rate > 0 ? Math.round(175 * meta.rate) : null
  const seen = new Set<string>()
  const requests: TtsCacheRequest[] = []

  for (const action of actions) {
    if (action.command !== 'tts') {
      continue
    }

    const [text] = action.args as [string]
    const normalizedText = text.trim()
    if (!normalizedText) {
      continue
    }

    const key = JSON.stringify({ text: normalizedText, voice, rate })
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    requests.push({
      text: normalizedText,
      voice,
      rate
    })
  }

  return requests
}

async function primeTtsCacheForValidation(validation: { actions: ParsedAction[]; meta: PresentationMeta }) {
  const requests = buildTtsCacheRequests(validation.actions, validation.meta)
  if (requests.length === 0) {
    return
  }

  try {
    await window.smh.primeTtsCache(requests)
  } catch {
    // Keep warmup best-effort so failed pre-generation never blocks editing or playback.
  }
}

function buildValidationFailureAlert(scriptPath: string, project: ProjectRecord, diagnostics: Diagnostic[]) {
  const errorDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity === 'error')
  const summary = errorDiagnostics
    .slice(0, 3)
    .map((diagnostic) => `Line ${diagnostic.line}: ${diagnostic.message}`)
    .join('\n')
  const remainder = errorDiagnostics.length > 3 ? `\n+ ${errorDiagnostics.length - 3} more` : ''

  return [`Can't open ${basename(scriptPath)} in ${project.name}.`, summary + remainder].filter(Boolean).join('\n\n')
}

function basename(filePath: string) {
  return filePath.split(/[\\/]/).pop() || filePath
}

function relativePath(filePath: string, rootPath?: string | null) {
  if (!rootPath) return filePath
  const normalizedRoot = rootPath.endsWith('/') ? rootPath : `${rootPath}/`
  return filePath.startsWith(normalizedRoot) ? filePath.slice(normalizedRoot.length) : filePath
}

function clearReviewState() {
  return {
    reviewComments: [] as ReviewComment[],
    reviewDraft: null as ReviewDraft | null,
    reviewSummarySelection: null as string | null
  }
}

function createReviewCommentId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function setReviewDraftState(
  set: StoreSet,
  input: {
    panelId: string
    absolutePath: string
    relativePath: string
    startLine: number
    endLine: number
    startColumn?: number
    endColumn?: number
  }
) {
  const range = normalizeReviewRange(input.startLine, input.endLine)

  set((state: AppState) => {
    const preserveBody =
      state.reviewDraft &&
      !state.reviewDraft.commentId &&
      state.reviewDraft.panelId === input.panelId &&
      state.reviewDraft.absolutePath === input.absolutePath
        ? state.reviewDraft.body
        : ''

    return {
      reviewDraft: {
        panelId: input.panelId,
        absolutePath: input.absolutePath,
        relativePath: input.relativePath,
        startLine: range.startLine,
        endLine: range.endLine,
        startColumn: input.startColumn,
        endColumn: input.endColumn,
        body: preserveBody
      }
    }
  })
}

function currentProjectFor(get: StoreGet) {
  const state = get()
  return state.projects.find((project) => project.id === state.currentProjectId) || null
}

async function rememberCurrentScriptProject(get: StoreGet, set: StoreSet) {
  const state = get()
  const project = currentProjectFor(get)
  if (!project || !state.scriptPath) {
    return
  }

  const recentPresentationPaths = await window.smh.rememberRecentPresentationPath(state.scriptPath, project.id)
  set({ recentPresentationPaths })
}

async function getInitialScriptForBoot(bootState: ProjectBootState, _currentProject: ProjectRecord | null) {
  if (bootState.pendingScriptPath) {
    return loadExternalScript(bootState.pendingScriptPath)
  }

  return {
    content: '',
    path: null
  }
}

async function handleIncomingExternalScript(scriptPath: string, set: StoreSet, get: StoreGet) {
  await openPresentationScript(scriptPath, set, get, { openSelector: true, autoPlay: false })
}

async function openRecentPresentationEntry(entry: RecentPresentationEntry, set: StoreSet, get: StoreGet) {
  abortActiveRun(set, get)

  const rememberedProject = entry.projectId != null ? get().projects.find((project) => project.id === entry.projectId) || null : null

  if (!rememberedProject) {
    await openPresentationScript(entry.path, set, get, { openSelector: true, autoPlay: false })
    return
  }

  const loaded = await loadExternalScript(entry.path)
  const validation = await validateScriptAgainstProject(loaded.content, rememberedProject)

  if (validation.hasErrors) {
    await openPresentationScript(entry.path, set, get, { openSelector: true, autoPlay: false })
    window.alert(`Can't reopen ${basename(entry.path)} in ${rememberedProject.name}. Choose a project again.`)
    return
  }

  const project = await window.smh.setCurrentProject(rememberedProject.id)
  const recentPresentationPaths = await window.smh.rememberRecentPresentationPath(loaded.path, project.id)

  set((state: AppState) => ({
    currentProjectId: project.id,
    pendingScriptPath: null,
    projectSelectorOpen: false,
    recentPresentationPaths,
    script: loaded.content,
    scriptPath: loaded.path,
    meta: validation.meta,
    actions: validation.actions,
    diagnostics: validation.diagnostics,
    status: 'idle',
    currentActionIndex: 0,
    actionStatuses: validation.actionStatuses,
    panels: {},
    panelOrder: [],
    logs: [],
    layoutMode: validation.meta.startLayout || 'two-column',
    tts: createDefaultTtsState(state.tts),
    ...clearReviewState(),
    projects: state.projects.map((item) => (item.id === project.id ? project : item)).sort(compareProjects)
  }))

  void primeTtsCacheForValidation(validation)
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

async function openPresentationScript(
  scriptPath: string,
  set: StoreSet,
  get: StoreGet,
  options: { openSelector: boolean; autoPlay: boolean }
) {
  const loaded = await loadExternalScript(scriptPath)
  const recentProjectId = options.openSelector ? null : currentProjectFor(get)?.id ?? null
  const recentPresentationPaths = await window.smh.rememberRecentPresentationPath(loaded.path, recentProjectId)

  abortActiveRun(set, get)

  if (options.openSelector) {
    await window.smh.clearCurrentProject()
  }

  const hasProject = !options.openSelector && Boolean(currentProjectFor(get))

  set((state: AppState) => ({
    currentProjectId: options.openSelector ? null : state.currentProjectId,
    pendingScriptPath: hasProject ? null : loaded.path,
    projectSelectorOpen: options.openSelector || !hasProject,
    recentPresentationPaths,
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
    tts: createDefaultTtsState(state.tts),
    ...clearReviewState()
  }))

  if (hasProject) {
    const valid = await get().validate()
    if (options.autoPlay && valid) {
      await get().play()
    }
  }
}

async function runFromCurrentIndex(set: StoreSet, get: StoreGet) {
  activeRunId += 1
  const runId = activeRunId
  const { actions } = get()

  set({ status: 'playing' })
  pushLog(set, 'info', 'Playback started')

  try {
    for (let index = get().currentActionIndex; index < actions.length; index += 1) {
      const action = actions[index]
      set({ currentActionIndex: index })

      try {
        await waitWhilePaused(get, runId)

        if (pendingSkipCount > 0) {
          throw new SkipActionError(action.id)
        }

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
      } catch (error) {
        if (error instanceof SkipActionError) {
          consumeSkipRequest()
          setActionStatus(set, action.id, 'skipped')
          pushLog(set, 'info', `Skipped ${action.summary}`, action.id)
          set({ currentActionIndex: index + 1 })
          continue
        }

        throw error
      }
    }

    if (activeRunId === runId) {
      clearSkipQueue()
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

    clearSkipQueue()
    set({ status: 'error' })
    pushLog(set, 'error', error instanceof Error ? error.message : 'Playback failed', action?.id)
  }
}

function abortActiveRun(set: StoreSet, get: StoreGet) {
  activeRunId += 1
  clearSkipQueue()
  activeTtsSession?.stop()

  set((state: AppState) => ({
    status: 'idle',
    tts: createDefaultTtsState(state.tts)
  }))
}

function resetRuntime(set: StoreSet, get: StoreGet) {
  const actionStatuses = Object.fromEntries(get().actions.map((action) => [action.id, 'pending' as ActionStatus]))
  clearSkipQueue()

  set({
    status: 'idle',
    currentActionIndex: 0,
    actionStatuses,
    panels: {},
    panelOrder: [],
    logs: [],
    layoutMode: get().meta.startLayout || 'two-column',
    tts: createDefaultTtsState(get().tts),
    ...clearReviewState()
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
      await delay(seconds * 1000, get, runId, action.id)
      return
    }

    case 'tts': {
      const [text] = action.args as [string]
      await speakText(text, get().meta.rate, set, get, runId, action.id)
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

function consumeSkipRequest() {
  if (pendingSkipCount <= 0) {
    return false
  }

  pendingSkipCount -= 1
  return true
}

function clearSkipQueue() {
  pendingSkipCount = 0
  activeSkippableAction = null
}

function setActiveSkippableAction(runId: number, actionId: string, skip: () => void) {
  activeSkippableAction = { runId, actionId, skip }
}

function clearActiveSkippableAction(runId: number, actionId: string) {
  if (activeSkippableAction?.runId === runId && activeSkippableAction.actionId === actionId) {
    activeSkippableAction = null
  }
}

async function waitWhilePaused(get: StoreGet, runId: number) {
  while (get().status === 'paused') {
    if (runId !== activeRunId) {
      throw new RunAbortedError()
    }

    if (pendingSkipCount > 0 && !activeSkippableAction) {
      throw new SkipActionError()
    }

    await delay(75)
  }

  if (runId !== activeRunId || get().status === 'idle') {
    throw new RunAbortedError()
  }
}

function delay(ms: number, get?: StoreGet, runId?: number, actionId?: string) {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now()
    let settled = false
    let timeoutId: number | null = null

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      if (timeoutId != null) {
        window.clearTimeout(timeoutId)
      }
      if (runId != null && actionId) {
        clearActiveSkippableAction(runId, actionId)
      }
      callback()
    }

    const tick = () => {
      if (settled) {
        return
      }

      if (runId != null && runId !== activeRunId) {
        finish(() => reject(new RunAbortedError()))
        return
      }

      if (get?.().status === 'idle') {
        finish(() => reject(new RunAbortedError()))
        return
      }

      if (get?.().status === 'paused') {
        timeoutId = window.setTimeout(tick, 75)
        return
      }

      if (Date.now() - started >= ms) {
        finish(resolve)
        return
      }

      timeoutId = window.setTimeout(tick, 25)
    }

    if (runId != null && actionId) {
      setActiveSkippableAction(runId, actionId, () => finish(() => reject(new SkipActionError(actionId))))
    }

    timeoutId = window.setTimeout(tick, 25)
  })
}

async function speakText(
  text: string,
  rate: number | undefined,
  set: StoreSet,
  get: StoreGet,
  runId: number,
  actionId: string
) {
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
  const paddedBuffer = appendTrailingSilence(audioContext, decodedBuffer, TTS_TRAILING_SILENCE_MS)
  const durationMs = paddedBuffer.duration * 1000
  const source = audioContext.createBufferSource()
  const gainNode = audioContext.createGain()

  source.buffer = paddedBuffer
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
    let stallTimeoutId: number | null = null

    const cleanup = () => {
      if (finished) return
      finished = true
      window.clearInterval(intervalId)
      if (stallTimeoutId != null) {
        window.clearTimeout(stallTimeoutId)
      }
      source.onended = null
      source.disconnect()
      gainNode.disconnect()
      void audioContext.close()
      clearActiveSkippableAction(runId, actionId)
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

    setActiveSkippableAction(runId, actionId, () => {
      fail(new SkipActionError(actionId))
    })

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
      window.setTimeout(() => {
        cleanup()
        resolve()
      }, TTS_END_GRACE_MS)
    }

    stallTimeoutId = window.setTimeout(() => {
      pushLog(set, 'warn', 'TTS playback stalled; continuing to the next step.', actionId)
      cleanup()
      resolve()
    }, Math.max(durationMs + TTS_END_GRACE_MS + TTS_STALL_BUFFER_MS, TTS_MIN_FALLBACK_TIMEOUT_MS))

    try {
      source.start(0)
    } catch {
      fail(new Error('System TTS audio playback failed'))
    }
  })
}

function appendTrailingSilence(audioContext: AudioContext, buffer: AudioBuffer, trailingSilenceMs: number) {
  const extraFrames = Math.max(0, Math.round((buffer.sampleRate * trailingSilenceMs) / 1000))
  if (extraFrames === 0) {
    return buffer
  }

  const paddedBuffer = audioContext.createBuffer(buffer.numberOfChannels, buffer.length + extraFrames, buffer.sampleRate)

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    paddedBuffer.getChannelData(channel).set(buffer.getChannelData(channel), 0)
  }

  return paddedBuffer
}

function decodeBase64Audio(base64Audio: string) {
  const binary = window.atob(base64Audio)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes.buffer
}
