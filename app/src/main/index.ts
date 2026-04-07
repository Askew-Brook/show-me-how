import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, unlink } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const defaultProjectsPath = '/Users/spriggs/Documents/Projects'
const controlHost = '127.0.0.1'
const controlPort = 48561
const seededProjects = [
  {
    name: 'eyj',
    rootPath: '/Users/spriggs/Documents/Projects/eyj'
  }
]

interface ProjectRecord {
  id: number
  name: string
  rootPath: string
  gitRemoteSlug: string | null
  createdAt: string
  updatedAt: string
}

interface RecentPresentationEntry {
  path: string
  projectId: number | null
}

interface NormalizedProjectInput {
  name: string
  rootPath: string
}


let database: DatabaseSync | null = null
let mainWindow: BrowserWindow | null = null
let pendingScriptPath: string | null = null
let controlServer: http.Server | null = null

const controlRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }
>()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function getDatabase() {
  if (database) {
    return database
  }

  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'show-me-how.sqlite')
  database = new DatabaseSync(dbPath)
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      root_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  ensureProjectColumn('git_remote_slug', 'TEXT')
  seedKnownProjects()

  return database
}

function ensureProjectColumn(name: string, type: string) {
  const db = database
  if (!db) return

  const columns = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>
  const exists = columns.some((column) => String(column.name) === name)
  if (!exists) {
    db.exec(`ALTER TABLE projects ADD COLUMN ${name} ${type}`)
  }
}

function seedKnownProjects() {
  const db = database
  if (!db) return

  for (const project of seededProjects) {
    if (!existsSync(project.rootPath)) {
      continue
    }

    const existing = db.prepare('SELECT id FROM projects WHERE root_path = ?').get(project.rootPath)
    if (existing) {
      continue
    }

    const timestamp = new Date().toISOString()
    db.prepare(
      `INSERT INTO projects (
        name,
        root_path,
        git_remote_slug,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?)`
    ).run(project.name, project.rootPath, null, timestamp, timestamp)
  }
}

function mapProject(row: any): ProjectRecord {
  return {
    id: Number(row.id),
    name: String(row.name),
    rootPath: String(row.root_path),
    gitRemoteSlug: row.git_remote_slug ? String(row.git_remote_slug) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}

function listProjects() {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT
         id,
         name,
         root_path,
         git_remote_slug,
         created_at,
         updated_at
       FROM projects
       ORDER BY name COLLATE NOCASE ASC, id ASC`
    )
    .all()

  return rows.map(mapProject)
}

function getProjectById(projectId: number) {
  const db = getDatabase()
  const row = db
    .prepare(
      `SELECT
         id,
         name,
         root_path,
         git_remote_slug,
         created_at,
         updated_at
       FROM projects
       WHERE id = ?`
    )
    .get(projectId)

  return row ? mapProject(row) : null
}

function getCurrentProjectId() {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('currentProjectId') as { value: string } | undefined
  if (!row) return null
  const value = Number(row.value)
  return Number.isFinite(value) ? value : null
}

function setCurrentProjectId(projectId: number | null) {
  const db = getDatabase()

  if (projectId === null) {
    db.prepare('DELETE FROM app_settings WHERE key = ?').run('currentProjectId')
    return
  }

  db.prepare(
    `INSERT INTO app_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run('currentProjectId', String(projectId))
}

function normalizeRecentPresentationEntry(value: unknown): RecentPresentationEntry | null {
  if (typeof value === 'string') {
    return {
      path: path.resolve(value),
      projectId: null
    }
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as { path?: unknown; projectId?: unknown }
  if (typeof candidate.path !== 'string' || candidate.path.trim() === '') {
    return null
  }

  const projectId = typeof candidate.projectId === 'number' && Number.isFinite(candidate.projectId) ? candidate.projectId : null

  return {
    path: path.resolve(candidate.path),
    projectId
  }
}

function getRecentPresentationPaths() {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('recentPresentationPaths') as
    | { value: string }
    | undefined
  if (!row) return []

  try {
    const parsed = JSON.parse(row.value)
    if (!Array.isArray(parsed)) {
      return []
    }

    const entries: RecentPresentationEntry[] = []
    const seenPaths = new Set<string>()

    for (const value of parsed) {
      const entry = normalizeRecentPresentationEntry(value)
      if (!entry || seenPaths.has(entry.path)) {
        continue
      }
      seenPaths.add(entry.path)
      entries.push(entry)
    }

    return entries
  } catch {
    return []
  }
}

function rememberRecentPresentationPath(filePath: string, projectId?: number | null) {
  const db = getDatabase()
  const resolvedPath = path.resolve(filePath)
  const nextEntries = [
    { path: resolvedPath, projectId: projectId ?? null },
    ...getRecentPresentationPaths().filter((entry) => entry.path !== resolvedPath)
  ].slice(0, 12)

  db.prepare(
    `INSERT INTO app_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run('recentPresentationPaths', JSON.stringify(nextEntries))

  return nextEntries
}

function normalizeProjectInput(input: { name: string; rootPath: string }): NormalizedProjectInput {
  const rootPath = path.resolve(input.rootPath.trim())
  const name = input.name.trim() || path.basename(rootPath)

  if (!rootPath) {
    throw new Error('Project root is required')
  }

  if (!existsSync(rootPath)) {
    throw new Error(`Project root does not exist: ${rootPath}`)
  }

  return {
    name,
    rootPath
  }
}

function resolveScriptPath(filePath: string, projectRootPath?: string | null) {
  const trimmed = filePath.trim()
  if (path.isAbsolute(trimmed)) {
    return path.normalize(trimmed)
  }

  if (projectRootPath?.trim()) {
    return path.resolve(projectRootPath, trimmed)
  }

  return path.resolve(trimmed)
}

function execGitCommand(args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    execFile('git', ['-C', cwd, ...args], (error, stdout) => {
      if (error) {
        reject(error)
        return
      }

      resolve(String(stdout).trim())
    })
  })
}

function parseGitRemoteSlug(remoteUrl: string) {
  const trimmed = remoteUrl.trim()
  if (!trimmed) return null

  const scpMatch = trimmed.match(/^[^@]+@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (scpMatch) {
    return `${scpMatch[1]}/${scpMatch[2]}`
  }

  try {
    const parsed = new URL(trimmed)
    const parts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
    if (parts.length >= 2) {
      const owner = parts[parts.length - 2]
      const repo = parts[parts.length - 1].replace(/\.git$/, '')
      if (owner && repo) {
        return `${owner}/${repo}`
      }
    }
  } catch {
    return null
  }

  return null
}

async function inspectGitProject(projectRoot: string) {
  try {
    const topLevel = await execGitCommand(['rev-parse', '--show-toplevel'], projectRoot)
    if (path.resolve(topLevel) !== path.resolve(projectRoot)) {
      return null
    }

    const remoteUrl = await execGitCommand(['config', '--get', 'remote.origin.url'], projectRoot)
    const gitRemoteSlug = parseGitRemoteSlug(remoteUrl)
    if (!gitRemoteSlug) {
      return null
    }

    return {
      rootPath: path.resolve(projectRoot),
      gitRemoteSlug,
      name: gitRemoteSlug.split('/').pop() || path.basename(projectRoot)
    }
  } catch {
    return null
  }
}

async function collectGitProjects(parentPath: string) {
  const results: Array<{ name: string; rootPath: string; gitRemoteSlug: string }> = []
  let skippedInvalid = 0
  const seenRoots = new Set<string>()

  async function visit(currentPath: string): Promise<void> {
    let entries
    try {
      entries = await readdir(currentPath, { withFileTypes: true })
    } catch {
      return
    }

    const hasGitMarker = entries.some((entry) => entry.name === '.git')
    if (hasGitMarker) {
      const project = await inspectGitProject(currentPath)
      if (project) {
        if (!seenRoots.has(project.rootPath)) {
          seenRoots.add(project.rootPath)
          results.push(project)
        }
      } else {
        skippedInvalid += 1
      }
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue
      await visit(path.join(currentPath, entry.name))
    }
  }

  await visit(path.resolve(parentPath))

  return {
    projects: results,
    skippedInvalid
  }
}

function isPresentationFile(filePath: string) {
  return filePath.toLowerCase().endsWith('.smh')
}

function queueExternalScriptOpen(filePath: string) {
  const resolved = path.resolve(filePath)
  pendingScriptPath = resolved
  rememberRecentPresentationPath(resolved, getCurrentProjectId())

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:externalScriptOpened', resolved)
  }
}

function sendControlCommand(command: Record<string, unknown>) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('ShowMeHow app window is not available')
  }

  const id = randomUUID()

  return new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      controlRequests.delete(id)
      reject(new Error(`Control command timed out: ${String(command.type || 'unknown')}`))
    }, 15000)

    controlRequests.set(id, { resolve, reject, timeout })
    mainWindow?.webContents.send('control:command', { id, command })
  })
}

function startControlServer() {
  if (controlServer) {
    return
  }

  controlServer = http.createServer(async (request, response) => {
    try {
      const method = request.method || 'GET'
      const url = new URL(request.url || '/', `http://${controlHost}:${controlPort}`)

      if (method === 'GET' && url.pathname === '/health') {
        return json(response, 200, { ok: true, port: controlPort })
      }

      if (method === 'GET' && url.pathname === '/projects') {
        return json(response, 200, {
          projects: listProjects(),
          currentProjectId: getCurrentProjectId()
        })
      }

      if (method === 'GET' && url.pathname === '/state') {
        return json(response, 200, await sendControlCommand({ type: 'get-state' }))
      }

      if (method === 'GET' && url.pathname === '/script') {
        return json(response, 200, await sendControlCommand({ type: 'get-script' }))
      }

      if (method === 'POST' && url.pathname === '/command') {
        const body = await readJsonBody(request)
        return json(response, 200, await sendControlCommand(body))
      }

      return json(response, 404, { error: 'Not found' })
    } catch (error) {
      return json(response, 500, {
        error: error instanceof Error ? error.message : 'Unknown control server error'
      })
    }
  })

  controlServer.listen(controlPort, controlHost)
}

function readJsonBody(request: http.IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let raw = ''

    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      raw += chunk
    })
    request.on('end', () => {
      if (!raw.trim()) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON request body'))
      }
    })
    request.on('error', reject)
  })
}

function json(response: http.ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  })
  response.end(JSON.stringify(payload))
}

ipcMain.on('control:response', (_event, payload: { id: string; ok: boolean; result?: unknown; error?: string }) => {
  const entry = controlRequests.get(payload.id)
  if (!entry) {
    return
  }

  clearTimeout(entry.timeout)
  controlRequests.delete(payload.id)

  if (payload.ok) {
    entry.resolve(payload.result)
  } else {
    entry.reject(new Error(payload.error || 'Unknown control command failure'))
  }
})

ipcMain.handle('dialog:pickFile', async (_event, projectRootPath?: string | null) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: 'Open file',
    defaultPath: projectRootPath?.trim() || (existsSync(defaultProjectsPath) ? defaultProjectsPath : undefined)
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('dialog:pickPresentationFile', async (_event, projectRootPath?: string | null) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: 'Open presentation',
    defaultPath: projectRootPath?.trim() || (existsSync(defaultProjectsPath) ? defaultProjectsPath : undefined),
    filters: [
      { name: 'ShowMeHow Scripts', extensions: ['smh'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('dialog:pickFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose project root',
    defaultPath: existsSync(defaultProjectsPath) ? defaultProjectsPath : undefined
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('projects:getBootState', async () => {
  return {
    projects: listProjects(),
    currentProjectId: getCurrentProjectId(),
    pendingScriptPath
  }
})

ipcMain.handle('projects:create', async (_event, input: { name: string; rootPath: string }) => {
  const db = getDatabase()
  const normalized = normalizeProjectInput(input)
  const timestamp = new Date().toISOString()

  try {
    const result = db
      .prepare(
        `INSERT INTO projects (
          name,
          root_path,
          git_remote_slug,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(normalized.name, normalized.rootPath, null, timestamp, timestamp)

    return getProjectById(Number(result.lastInsertRowid))
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new Error(`Project already exists for root: ${normalized.rootPath}`)
    }
    throw error
  }
})

ipcMain.handle(
  'projects:update',
  async (_event, projectId: number, input: { name: string; rootPath: string }) => {
    const db = getDatabase()
    const normalized = normalizeProjectInput(input)
    const existing = db
      .prepare('SELECT id, root_path, git_remote_slug FROM projects WHERE id = ?')
      .get(projectId) as { id: number; root_path: string; git_remote_slug: string | null } | undefined
    if (!existing) {
      throw new Error(`Project not found: ${projectId}`)
    }

    const nextGitRemoteSlug = existing.root_path === normalized.rootPath ? existing.git_remote_slug : null

    try {
      db.prepare(
        `UPDATE projects
         SET name = ?,
             root_path = ?,
             git_remote_slug = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(normalized.name, normalized.rootPath, nextGitRemoteSlug, new Date().toISOString(), projectId)
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        throw new Error(`Project already exists for root: ${normalized.rootPath}`)
      }
      throw error
    }

    return getProjectById(projectId)
  }
)

ipcMain.handle('projects:importFromParent', async (_event, parentPath: string) => {
  const db = getDatabase()
  const normalizedParentPath = path.resolve(parentPath.trim())

  if (!normalizedParentPath) {
    throw new Error('Parent folder is required')
  }

  if (!existsSync(normalizedParentPath)) {
    throw new Error(`Parent folder does not exist: ${normalizedParentPath}`)
  }

  const discovered = await collectGitProjects(normalizedParentPath)
  const existingPaths = new Set(
    (db.prepare('SELECT root_path FROM projects').all() as Array<{ root_path: string }>).map((row) => path.resolve(String(row.root_path)))
  )

  let imported = 0
  let skippedExisting = 0

  for (const project of discovered.projects) {
    if (existingPaths.has(project.rootPath)) {
      skippedExisting += 1
      continue
    }

    const timestamp = new Date().toISOString()
    db.prepare(
      `INSERT INTO projects (
        name,
        root_path,
        git_remote_slug,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?)`
    ).run(project.name, project.rootPath, project.gitRemoteSlug, timestamp, timestamp)

    existingPaths.add(project.rootPath)
    imported += 1
  }

  return {
    projects: listProjects(),
    imported,
    skippedExisting,
    skippedInvalid: discovered.skippedInvalid
  }
})

ipcMain.handle('projects:delete', async (_event, projectId: number) => {
  const db = getDatabase()
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)

  if (getCurrentProjectId() === projectId) {
    setCurrentProjectId(null)
  }

  return {
    projects: listProjects(),
    currentProjectId: getCurrentProjectId(),
    pendingScriptPath
  }
})

ipcMain.handle('projects:setCurrent', async (_event, projectId: number) => {
  const project = getProjectById(projectId)

  if (!project) {
    throw new Error(`Project not found: ${projectId}`)
  }

  setCurrentProjectId(projectId)
  return project
})

ipcMain.handle('projects:clearCurrent', async () => {
  setCurrentProjectId(null)
  return {
    projects: listProjects(),
    currentProjectId: null,
    pendingScriptPath
  }
})

ipcMain.handle('app:getRecentPresentationPaths', async () => {
  return getRecentPresentationPaths()
})

ipcMain.handle('app:rememberRecentPresentationPath', async (_event, filePath: string, projectId?: number | null) => {
  return rememberRecentPresentationPath(filePath, projectId)
})

ipcMain.handle('app:clearPendingScript', async () => {
  pendingScriptPath = null
})

ipcMain.handle('fs:resolvePath', async (_event, filePath: string, projectRootPath?: string | null) => {
  return resolveScriptPath(filePath, projectRootPath)
})

ipcMain.handle('fs:readTextFile', async (_event, filePath: string, projectRootPath?: string | null) => {
  const resolvedPath = resolveScriptPath(filePath, projectRootPath)

  try {
    const content = await readFile(resolvedPath, 'utf8')
    return {
      path: resolvedPath,
      content,
      exists: true
    }
  } catch {
    return {
      path: resolvedPath,
      content: '',
      exists: false
    }
  }
})

ipcMain.handle('fs:fileExists', async (_event, filePath: string, projectRootPath?: string | null) => {
  return existsSync(resolveScriptPath(filePath, projectRootPath))
})

ipcMain.handle(
  'tts:synthesizeToFile',
  async (_event, text: string, options?: { voice?: string | null; rate?: number | null }) => {
    if (process.platform !== 'darwin') {
      throw new Error('System TTS file synthesis is currently only implemented for macOS')
    }

    const aiffPath = path.join(app.getPath('temp'), `show-me-how-tts-${randomUUID()}.aiff`)
    const wavPath = path.join(app.getPath('temp'), `show-me-how-tts-${randomUUID()}.wav`)
    const args = ['-o', aiffPath]
    const voice = options?.voice?.trim()
    const rate = options?.rate == null ? null : Math.max(80, Math.min(360, Math.round(options.rate)))

    if (voice) {
      args.push('-v', voice)
    }

    if (rate) {
      args.push('-r', String(rate))
    }

    args.push(text)

    await new Promise<void>((resolve, reject) => {
      execFile('say', args, (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })

    await new Promise<void>((resolve, reject) => {
      execFile('afconvert', ['-f', 'WAVE', '-d', 'LEI16@22050', aiffPath, wavPath], (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })

    const audioBuffer = await readFile(wavPath)

    for (const tempPath of [aiffPath, wavPath]) {
      try {
        await unlink(tempPath)
      } catch {
        // Ignore temp file cleanup errors.
      }
    }

    return {
      mimeType: 'audio/wav',
      base64Audio: audioBuffer.toString('base64')
    }
  }
)

ipcMain.handle('app:getConfig', async () => {
  await mkdir(app.getPath('userData'), { recursive: true })

  return {
    defaultBrowserTimeoutMs: 5000,
    defaultNavigationTimeoutMs: 10000,
    controlUrl: `http://${controlHost}:${controlPort}`
  }
})

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (isPresentationFile(filePath)) {
    queueExternalScriptOpen(filePath)
  }
})

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const scriptPath = argv.find((value) => isPresentationFile(value))
    if (scriptPath) {
      queueExternalScriptOpen(scriptPath)
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  getDatabase()
  startControlServer()

  const argvScriptPath = process.argv.find((value) => isPresentationFile(value))
  if (argvScriptPath) {
    queueExternalScriptOpen(argvScriptPath)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('will-quit', () => {
  controlServer?.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
