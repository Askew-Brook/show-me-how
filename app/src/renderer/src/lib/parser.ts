export type DiagnosticSeverity = 'error' | 'warning'
export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'completed' | 'error'
export type PanelType = 'code' | 'browser'
export type LayoutMode = 'single' | 'two-column' | 'grid'
export type ActionStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface Diagnostic {
  severity: DiagnosticSeverity
  message: string
  line: number
  column?: number
  code: string
}

export interface PresentationMeta {
  title?: string
  startLayout?: LayoutMode
  defaultPauseAfterTts?: number
  voice?: string
  rate?: number
}

export interface ParsedAction {
  id: string
  command: string
  args: unknown[]
  sourceLine: number
  raw: string
  summary: string
  isExecutable: boolean
}

export interface ParseResult {
  meta: PresentationMeta
  actions: ParsedAction[]
  diagnostics: Diagnostic[]
}

export interface ProjectValidationContext {
  rootPath?: string | null
  name?: string
}

const COMMAND_SPECS: Record<
  string,
  { minArgs: number; maxArgs: number; executable?: boolean }
> = {
  meta: { minArgs: 1, maxArgs: 1, executable: false },
  new_panel: { minArgs: 2, maxArgs: 2 },
  close_panel: { minArgs: 1, maxArgs: 1 },
  layout: { minArgs: 1, maxArgs: 1 },
  focus_panel: { minArgs: 1, maxArgs: 1 },
  open_code: { minArgs: 2, maxArgs: 3 },
  scroll_code: { minArgs: 2, maxArgs: 2 },
  select_code: { minArgs: 4, maxArgs: 4 },
  select_code_line: { minArgs: 2, maxArgs: 3 },
  highlight_lines: { minArgs: 3, maxArgs: 3 },
  clear_code_selection: { minArgs: 1, maxArgs: 1 },
  open_browser: { minArgs: 2, maxArgs: 2 },
  click_text: { minArgs: 2, maxArgs: 2 },
  type_text: { minArgs: 3, maxArgs: 3 },
  wait_for_text: { minArgs: 2, maxArgs: 3 },
  wait_for_navigation: { minArgs: 1, maxArgs: 2 },
  highlight_text: { minArgs: 2, maxArgs: 2 },
  press_key: { minArgs: 2, maxArgs: 2 },
  browser_back: { minArgs: 1, maxArgs: 1 },
  browser_forward: { minArgs: 1, maxArgs: 1 },
  browser_reload: { minArgs: 1, maxArgs: 1 },
  pause: { minArgs: 1, maxArgs: 1 },
  tts: { minArgs: 1, maxArgs: 1 },
  note: { minArgs: 1, maxArgs: 1, executable: false }
}

const CODE_COMMANDS = new Set([
  'open_code',
  'scroll_code',
  'select_code',
  'select_code_line',
  'highlight_lines',
  'clear_code_selection'
])

const BROWSER_COMMANDS = new Set([
  'open_browser',
  'click_text',
  'type_text',
  'wait_for_text',
  'wait_for_navigation',
  'highlight_text',
  'press_key',
  'browser_back',
  'browser_forward',
  'browser_reload'
])

export function createSampleScript(project?: ProjectValidationContext | null) {
  if (project?.name?.toLowerCase() === 'eyj') {
    return createEyjAuthWalkthroughScript()
  }

  const title = project?.name ? `${project.name} Code Walkthrough` : 'Prototype Code Walkthrough'

  return `meta({
  title: ${JSON.stringify(title)},
  startLayout: "two-column",
  rate: 1
})

layout("two-column")
note("Prototype scope is code walkthroughs only.")

new_panel("code1", "code")
focus_panel("code1")
open_code("code1", "README.md", 1)
highlight_lines("code1", 1, 12)
tts("This panel shows a local file relative to the selected project root.")
pause(0.75)
highlight_lines("code1", 13, 24)
tts("The timeline can walk through different sections of a file step by step.")
pause(0.5)
clear_code_selection("code1")
`
}

function createEyjAuthWalkthroughScript() {
  return `meta({
  title: "EYJ Authentication Walkthrough",
  startLayout: "two-column",
  rate: 1
})

layout("two-column")
note("This walkthrough focuses on the two authentication layers in EYJ: a dashboard passcode gate and the Filament admin login.")

new_panel("code1", "code")
focus_panel("code1")
open_code("code1", "routes/web.php", 40)
highlight_lines("code1", 40, 41)
tts("The public entry point for the dashboard login code starts in the web routes file. EYJ exposes a GET and POST route at login slash code.")
pause(0.5)
highlight_lines("code1", 58, 73)
tts("A little lower down, the dashboard routes sit behind the passcode block middleware, while the admin area uses Laravel auth in a separate route group.")
pause(0.5)

new_panel("code2", "code")
focus_panel("code2")
open_code("code2", "app/Http/Controllers/LoginCodeController.php", 14)
highlight_lines("code2", 14, 24)
tts("The login code controller validates that a numeric code was submitted, compares it against configuration, stores it in the session, and then redirects to the intended dashboard URL.")
pause(0.5)
select_code_line("code2", 22, 8)
tts("This line is the key state change. The successful code is written into the session under logged in code.")
pause(0.5)
clear_code_selection("code2")
select_code_line("code2", 24, 8)
tts("And this redirect uses Laravel's intended redirect support, so the user lands on the dashboard page they originally asked for.")
pause(0.5)
clear_code_selection("code2")

focus_panel("code1")
open_code("code1", "app/Http/Middleware/PasscodeLocked.php", 21)
highlight_lines("code1", 21, 35)
tts("The real gatekeeping happens in the PasscodeLocked middleware. Local environments bypass it, approved IP addresses bypass it, and everyone else must satisfy the code check.")
pause(0.5)
highlight_lines("code1", 38, 40)
tts("The check itself is simple. EYJ only trusts the session if logged in code exists and exactly matches the configured login code.")
pause(0.5)

focus_panel("code2")
open_code("code2", "config/core.php", 5)
highlight_lines("code2", 5, 12)
tts("Those rules are driven by the core config file. Allowed IPs live here, and the login passcode comes from environment configuration with a fallback default.")
pause(0.5)

focus_panel("code1")
open_code("code1", "vendor/laravel/framework/src/Illuminate/Routing/Redirector.php", 95)
highlight_lines("code1", 95, 99)
tts("Here is the Laravel vendor implementation behind redirect intended. It pulls the stored intended URL from the session and redirects there after login succeeds.")
pause(0.5)
highlight_lines("code1", 256, 258)
tts("And this is the companion setter used by the middleware before it sends the visitor to the code form.")
pause(0.5)

focus_panel("code2")
open_code("code2", "vendor/laravel/framework/src/Illuminate/Session/Store.php", 393)
highlight_lines("code2", 393, 401)
tts("The session write itself is just Laravel's session store put method, which updates the in memory session attributes with the key value pair.")
pause(0.5)

focus_panel("code1")
open_code("code1", "app/Providers/Filament/AdminPanelProvider.php", 76)
highlight_lines("code1", 76, 93)
tts("EYJ also has a second authentication path for the admin area. Filament enables its own login, password reset, and profile screens, then protects the panel with authentication middleware.")
pause(0.5)

focus_panel("code2")
open_code("code2", "app/Http/Middleware/Authenticate.php", 8)
highlight_lines("code2", 8, 19)
tts("This custom middleware extends Laravel's auth middleware and changes the unauthenticated redirect target to slash admin slash login.")
pause(0.5)

focus_panel("code1")
open_code("code1", "vendor/laravel/framework/src/Illuminate/Auth/Middleware/Authenticate.php", 75)
highlight_lines("code1", 75, 84)
tts("Underneath that, Laravel loops through the configured guards and calls guard check. If no guard authenticates the user, the framework raises an unauthenticated response.")
pause(0.5)

focus_panel("code2")
open_code("code2", "app/Models/User.php", 67)
highlight_lines("code2", 67, 70)
tts("Finally, the user model decides who may enter the Filament panel. Admin users and maintenance only users can access the panel.")
pause(0.5)
note("EYJ authentication summary: dashboard access uses a session based numeric passcode, while admin access uses Laravel and Filament auth on the admin panel.")
`
}

export function parseDocument(source: string): ParseResult {
  const diagnostics: Diagnostic[] = []
  const actions: ParsedAction[] = []
  const meta: PresentationMeta = {}

  const statements = collectStatements(source, diagnostics)

  for (const statement of statements) {
    const match = statement.text.trim().match(/^([a-z_][a-z0-9_]*)\((([\s\S]*))\)$/i)

    if (!match) {
      diagnostics.push({
        severity: 'error',
        message: 'Expected a top-level function call like command(...)',
        line: statement.line,
        code: 'parse.invalid_statement'
      })
      continue
    }

    const command = match[1]
    const argsText = match[2] ?? ''
    const spec = COMMAND_SPECS[command]

    if (!spec) {
      diagnostics.push({
        severity: 'error',
        message: `Unknown command: ${command}`,
        line: statement.line,
        code: 'parse.unknown_command'
      })
      continue
    }

    const argParts = splitTopLevel(argsText)
    if (argsText.trim() === '') {
      argParts.length = 0
    }

    if (argParts.length < spec.minArgs || argParts.length > spec.maxArgs) {
      diagnostics.push({
        severity: 'error',
        message: `${command} expects ${formatArgCount(spec.minArgs, spec.maxArgs)} argument(s), got ${argParts.length}`,
        line: statement.line,
        code: 'parse.arg_count'
      })
      continue
    }

    const args: unknown[] = []
    let hasArgError = false

    for (let index = 0; index < argParts.length; index += 1) {
      const part = argParts[index]
      const parsed = parseArgument(command, index, part)

      if (!parsed.ok) {
        diagnostics.push({
          severity: 'error',
          message: parsed.message,
          line: statement.line,
          code: parsed.code
        })
        hasArgError = true
        break
      }

      args.push(parsed.value)
    }

    if (hasArgError) {
      continue
    }

    if (command === 'meta') {
      Object.assign(meta, args[0] as PresentationMeta)
      continue
    }

    actions.push({
      id: `a${actions.length + 1}`,
      command,
      args,
      sourceLine: statement.line,
      raw: statement.text.trim(),
      summary: summarize(command, args),
      isExecutable: spec.executable !== false
    })
  }

  diagnostics.push(...semanticDiagnostics(actions, meta))

  return { meta, actions, diagnostics }
}

export async function validateDocument(
  result: ParseResult,
  project?: ProjectValidationContext | null
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [...result.diagnostics]

  for (const action of result.actions) {
    if (action.command === 'open_code') {
      const filePath = String(action.args[1] ?? '')
      const exists = await window.smh.fileExists(filePath, project?.rootPath ?? null)
      if (!exists) {
        diagnostics.push({
          severity: 'error',
          message: `File does not exist: ${filePath}`,
          line: action.sourceLine,
          code: 'validate.file_missing'
        })
      }
    }

    if (action.command === 'new_panel' && String(action.args[1]) === 'browser') {
      diagnostics.push({
        severity: 'error',
        message: 'Browser panels are disabled in the current prototype',
        line: action.sourceLine,
        code: 'prototype.browser_panel_disabled'
      })
    }

    if (BROWSER_COMMANDS.has(action.command)) {
      diagnostics.push({
        severity: 'error',
        message: `Browser action disabled in current prototype: ${action.command}`,
        line: action.sourceLine,
        code: 'prototype.browser_action_disabled'
      })
    }
  }

  return sortDiagnostics(diagnostics)
}

function semanticDiagnostics(actions: ParsedAction[], meta: PresentationMeta): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const panels = new Map<string, PanelType>()

  if (meta.startLayout && !['single', 'two-column', 'grid'].includes(meta.startLayout)) {
    diagnostics.push({
      severity: 'error',
      message: `Invalid startLayout: ${meta.startLayout}`,
      line: 1,
      code: 'validate.meta_layout'
    })
  }

  if (typeof meta.rate === 'number' && meta.rate <= 0) {
    diagnostics.push({
      severity: 'error',
      message: 'meta.rate must be greater than 0',
      line: 1,
      code: 'validate.meta_rate'
    })
  }

  for (const action of actions) {
    if (action.command === 'new_panel') {
      const panelId = String(action.args[0])
      const panelType = action.args[1] as PanelType

      if (panelType === 'browser') {
        diagnostics.push({
          severity: 'error',
          message: 'Browser panels are disabled in the current prototype',
          line: action.sourceLine,
          code: 'prototype.browser_panel_disabled'
        })
      }

      if (panels.has(panelId)) {
        diagnostics.push({
          severity: 'error',
          message: `Duplicate panel id: ${panelId}`,
          line: action.sourceLine,
          code: 'validate.duplicate_panel'
        })
      } else if (panelType !== 'code' && panelType !== 'browser') {
        diagnostics.push({
          severity: 'error',
          message: `Invalid panel type: ${panelType}`,
          line: action.sourceLine,
          code: 'validate.panel_type'
        })
      } else {
        panels.set(panelId, panelType)
      }

      continue
    }

    const panelId = getPanelId(action)
    if (panelId) {
      const panelType = panels.get(panelId)
      if (!panelType) {
        diagnostics.push({
          severity: 'error',
          message: `Panel must exist before use: ${panelId}`,
          line: action.sourceLine,
          code: 'validate.panel_missing'
        })
        continue
      }

      if (CODE_COMMANDS.has(action.command) && panelType !== 'code') {
        diagnostics.push({
          severity: 'error',
          message: `${action.command} requires a code panel: ${panelId}`,
          line: action.sourceLine,
          code: 'validate.code_panel_required'
        })
      }

      if (BROWSER_COMMANDS.has(action.command) && panelType !== 'browser') {
        diagnostics.push({
          severity: 'error',
          message: `${action.command} requires a browser panel: ${panelId}`,
          line: action.sourceLine,
          code: 'validate.browser_panel_required'
        })
      }

      if (BROWSER_COMMANDS.has(action.command)) {
        diagnostics.push({
          severity: 'error',
          message: `Browser action disabled in current prototype: ${action.command}`,
          line: action.sourceLine,
          code: 'prototype.browser_action_disabled'
        })
      }
    }

    if (action.command === 'layout') {
      const mode = String(action.args[0])
      if (!['single', 'two-column', 'grid'].includes(mode)) {
        diagnostics.push({
          severity: 'error',
          message: `Invalid layout mode: ${mode}`,
          line: action.sourceLine,
          code: 'validate.layout_mode'
        })
      }
    }

    if (action.command === 'pause' && Number(action.args[0]) < 0) {
      diagnostics.push({
        severity: 'error',
        message: 'pause(seconds) must be >= 0',
        line: action.sourceLine,
        code: 'validate.pause'
      })
    }

    if (action.command === 'tts' && String(action.args[0]).trim().length === 0) {
      diagnostics.push({
        severity: 'error',
        message: 'tts(text) must not be empty',
        line: action.sourceLine,
        code: 'validate.tts'
      })
    }

  }

  return diagnostics
}

function collectStatements(source: string, diagnostics: Diagnostic[]) {
  const statements: Array<{ text: string; line: number }> = []
  const lines = source.split(/\r?\n/)
  let current = ''
  let startLine = 1
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1
    const cleaned = stripComment(lines[i])
    const trimmed = cleaned.trim()

    if (!current && trimmed === '') {
      continue
    }

    if (!current) {
      startLine = lineNumber
    }

    current += `${current ? '\n' : ''}${cleaned}`

    for (const char of cleaned) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = !inString
        continue
      }

      if (inString) {
        continue
      }

      if (char === '(' || char === '{' || char === '[') depth += 1
      if (char === ')' || char === '}' || char === ']') depth -= 1
    }

    if (depth === 0 && current.trim()) {
      statements.push({ text: current, line: startLine })
      current = ''
    }
  }

  if (current.trim()) {
    diagnostics.push({
      severity: 'error',
      message: 'Unterminated statement at end of file',
      line: startLine,
      code: 'parse.unterminated_statement'
    })
  }

  return statements
}

function stripComment(line: string) {
  let inString = false
  let escaped = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString && char === '/' && next === '/') {
      return line.slice(0, i)
    }
  }

  return line
}

function splitTopLevel(input: string) {
  const parts: string[] = []
  let current = ''
  let inString = false
  let escaped = false
  let depth = 0

  for (const char of input) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      current += char
      escaped = true
      continue
    }

    if (char === '"') {
      current += char
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '(' || char === '{' || char === '[') depth += 1
      if (char === ')' || char === '}' || char === ']') depth -= 1

      if (char === ',' && depth === 0) {
        parts.push(current.trim())
        current = ''
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts
}

function parseArgument(command: string, index: number, raw: string):
  | { ok: true; value: unknown }
  | { ok: false; message: string; code: string } {
  if (command === 'meta' && index === 0) {
    return parseObjectLiteral(raw)
  }

  return parseLiteral(raw)
}

function parseLiteral(raw: string):
  | { ok: true; value: unknown }
  | { ok: false; message: string; code: string } {
  const value = raw.trim()

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return { ok: true, value: JSON.parse(value) }
    } catch {
      return { ok: false, message: `Invalid string literal: ${value}`, code: 'parse.string' }
    }
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return { ok: true, value: Number(value) }
  }

  if (value === 'true' || value === 'false') {
    return { ok: true, value: value === 'true' }
  }

  if (value.startsWith('{') && value.endsWith('}')) {
    return parseObjectLiteral(value)
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    return parseArrayLiteral(value)
  }

  return { ok: false, message: `Unsupported literal: ${value}`, code: 'parse.literal' }
}

function parseObjectLiteral(raw: string):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; message: string; code: string } {
  const value = raw.trim()
  if (!value.startsWith('{') || !value.endsWith('}')) {
    return { ok: false, message: 'Expected object literal', code: 'parse.object' }
  }

  const body = value.slice(1, -1).trim()
  if (!body) {
    return { ok: true, value: {} }
  }

  const result: Record<string, unknown> = {}
  const parts = splitTopLevel(body)

  for (const part of parts) {
    const colonIndex = findTopLevelColon(part)
    if (colonIndex === -1) {
      return { ok: false, message: `Invalid object entry: ${part}`, code: 'parse.object_entry' }
    }

    const rawKey = part.slice(0, colonIndex).trim()
    const rawValue = part.slice(colonIndex + 1).trim()
    const key = rawKey.startsWith('"') ? JSON.parse(rawKey) : rawKey

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && typeof key !== 'string') {
      return { ok: false, message: `Invalid object key: ${rawKey}`, code: 'parse.object_key' }
    }

    const parsed = parseLiteral(rawValue)
    if (!parsed.ok) {
      return parsed
    }

    result[String(key)] = parsed.value
  }

  return { ok: true, value: result }
}

function parseArrayLiteral(raw: string):
  | { ok: true; value: unknown[] }
  | { ok: false; message: string; code: string } {
  const value = raw.trim()
  const body = value.slice(1, -1).trim()
  if (!body) {
    return { ok: true, value: [] }
  }

  const parts = splitTopLevel(body)
  const result: unknown[] = []

  for (const part of parts) {
    const parsed = parseLiteral(part)
    if (!parsed.ok) {
      return parsed
    }
    result.push(parsed.value)
  }

  return { ok: true, value: result }
}

function findTopLevelColon(input: string) {
  let inString = false
  let escaped = false
  let depth = 0

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === '{' || char === '[' || char === '(') depth += 1
    if (char === '}' || char === ']' || char === ')') depth -= 1
    if (char === ':' && depth === 0) return i
  }

  return -1
}

function summarize(command: string, args: unknown[]) {
  switch (command) {
    case 'new_panel':
      return `Create ${args[1]} panel ${args[0]}`
    case 'close_panel':
      return `Close panel ${args[0]}`
    case 'layout':
      return `Set layout to ${args[0]}`
    case 'focus_panel':
      return `Focus panel ${args[0]}`
    case 'open_code':
      return `Open ${args[1]} in ${args[0]}${typeof args[2] === 'number' ? ` at line ${args[2]}` : ''}`
    case 'scroll_code':
      return `Scroll ${args[0]} to line ${args[1]}`
    case 'select_code':
      return `Select line ${args[1]} cols ${args[2]}-${args[3]} in ${args[0]}`
    case 'select_code_line':
      return `Select line ${args[1]} from col ${typeof args[2] === 'number' ? args[2] : 0} to end in ${args[0]}`
    case 'highlight_lines':
      return `Highlight lines ${args[1]}-${args[2]} in ${args[0]}`
    case 'clear_code_selection':
      return `Clear code selection in ${args[0]}`
    case 'open_browser':
      return `Open ${args[1]} in ${args[0]}`
    case 'click_text':
      return `Click text ${args[1]} in ${args[0]}`
    case 'type_text':
      return `Type into ${args[1]} in ${args[0]}`
    case 'wait_for_text':
      return `Wait for text ${args[1]} in ${args[0]}`
    case 'wait_for_navigation':
      return `Wait for navigation in ${args[0]}`
    case 'highlight_text':
      return `Highlight text ${args[1]} in ${args[0]}`
    case 'press_key':
      return `Press ${args[1]} in ${args[0]}`
    case 'browser_back':
      return `Navigate back in ${args[0]}`
    case 'browser_forward':
      return `Navigate forward in ${args[0]}`
    case 'browser_reload':
      return `Reload ${args[0]}`
    case 'pause':
      return `Pause ${args[0]} second(s)`
    case 'tts':
      return 'Speak narration'
    case 'note':
      return `Note: ${args[0]}`
    default:
      return `${command}(${args.map((arg) => JSON.stringify(arg)).join(', ')})`
  }
}

function getPanelId(action: ParsedAction) {
  if (action.command === 'layout' || action.command === 'pause' || action.command === 'tts' || action.command === 'note') {
    return null
  }

  return typeof action.args[0] === 'string' ? String(action.args[0]) : null
}

function sortDiagnostics(diagnostics: Diagnostic[]) {
  return [...diagnostics].sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
    return a.message.localeCompare(b.message)
  })
}

function formatArgCount(minArgs: number, maxArgs: number) {
  return minArgs === maxArgs ? `${minArgs}` : `${minArgs}-${maxArgs}`
}
