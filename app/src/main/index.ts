import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink } from 'node:fs/promises'
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
    rootPath: '/Users/spriggs/Documents/Projects/eyj',
    defaultScriptPath: null
  }
]

interface ProjectRecord {
  id: number
  name: string
  rootPath: string
  defaultScriptPath: string | null
  createdAt: string
  updatedAt: string
}

interface NormalizedProjectInput {
  name: string
  rootPath: string
  defaultScriptPath: string | null
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

  ensureProjectColumn('default_script_path', 'TEXT')
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
        default_script_path,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?)`
    ).run(project.name, project.rootPath, project.defaultScriptPath, timestamp, timestamp)
  }
}

function mapProject(row: any): ProjectRecord {
  return {
    id: Number(row.id),
    name: String(row.name),
    rootPath: String(row.root_path),
    defaultScriptPath: row.default_script_path ? String(row.default_script_path) : null,
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
         default_script_path,
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
         default_script_path,
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

function normalizeProjectInput(input: {
  name: string
  rootPath: string
  defaultScriptPath?: string | null
}): NormalizedProjectInput {
  const rootPath = path.resolve(input.rootPath.trim())
  const name = input.name.trim() || path.basename(rootPath)
  const defaultScriptPath = input.defaultScriptPath?.trim() ? input.defaultScriptPath.trim() : null

  if (!rootPath) {
    throw new Error('Project root is required')
  }

  if (!existsSync(rootPath)) {
    throw new Error(`Project root does not exist: ${rootPath}`)
  }

  if (defaultScriptPath) {
    const resolvedScriptPath = resolveScriptPath(defaultScriptPath, rootPath)
    if (!existsSync(resolvedScriptPath)) {
      throw new Error(`Default script does not exist: ${resolvedScriptPath}`)
    }
  }

  return {
    name,
    rootPath,
    defaultScriptPath
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

function isPresentationFile(filePath: string) {
  return filePath.toLowerCase().endsWith('.smh')
}

function queueExternalScriptOpen(filePath: string) {
  const resolved = path.resolve(filePath)
  pendingScriptPath = resolved

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

ipcMain.handle('projects:create', async (_event, input: { name: string; rootPath: string; defaultScriptPath?: string | null }) => {
  const db = getDatabase()
  const normalized = normalizeProjectInput(input)
  const timestamp = new Date().toISOString()

  try {
    const result = db
      .prepare(
        `INSERT INTO projects (
          name,
          root_path,
          default_script_path,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(normalized.name, normalized.rootPath, normalized.defaultScriptPath, timestamp, timestamp)

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
  async (_event, projectId: number, input: { name: string; rootPath: string; defaultScriptPath?: string | null }) => {
    const db = getDatabase()
    const normalized = normalizeProjectInput(input)
    const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
    if (!existing) {
      throw new Error(`Project not found: ${projectId}`)
    }

    try {
      db.prepare(
        `UPDATE projects
         SET name = ?,
             root_path = ?,
             default_script_path = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(normalized.name, normalized.rootPath, normalized.defaultScriptPath, new Date().toISOString(), projectId)
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        throw new Error(`Project already exists for root: ${normalized.rootPath}`)
      }
      throw error
    }

    return getProjectById(projectId)
  }
)

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
