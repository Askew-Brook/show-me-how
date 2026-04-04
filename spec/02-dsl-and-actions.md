# WIP 02 — DSL and Actions

## 8. File format

### 8.1 Presentation file extension
Use:
- `.smh` for the DSL source

### 8.2 Internal compiled form
Use normalized JSON actions in memory.

Optional later:
- save compiled cache as `.smh.json`

### 8.3 Example source file
```js
meta({
  title: "Login Demo",
  startLayout: "two-column"
})

new_panel("code1", "code")
open_code("code1", "/Users/jack/project/app/Http/Controllers/LoginController.php", 33)
select_code("code1", 33, 0, 122)
pause(1)
tts("This controller handles the login request and calls the auth service.")

new_panel("web1", "browser")
open_browser("web1", "https://example.test/login")
type_text("web1", "Email", "jack@example.com")
type_text("web1", "Password", "secret123")
click_text("web1", "Sign in")
wait_for_text("web1", "Welcome back", 5000)
tts("Once signed in, the app redirects the user to their dashboard.")
```

---

## 9. DSL specification

### 9.1 Design principles
- Human-readable
- AI-friendly
- Line-oriented function-call style
- No arbitrary JavaScript execution
- Strict command whitelist
- All runtime commands compile to plain data

### 9.2 Grammar shape
The DSL is a series of top-level statements:
- function-style command calls
- optional blank lines
- optional comments

### 9.3 Comments
Support:
```js
// single line
```

### 9.4 Strings
Use double quotes only in v1.

### 9.5 Numbers
Integers and decimals allowed where documented.

### 9.6 Booleans
`true`, `false`

### 9.7 Arrays and objects
Only allow these inside `meta()` and future config commands.

---

## 10. Supported v1 commands

## 10.1 Metadata

### `meta(object)`
Sets presentation metadata.

Allowed fields:
- `title: string`
- `startLayout: "single" | "two-column" | "grid"`
- `defaultPauseAfterTts?: number`
- `voice?: string`
- `rate?: number`

Example:
```js
meta({ title: "Demo", startLayout: "two-column", rate: 1 })
```

---

## 10.2 Panel lifecycle

### `new_panel(id, type)`
Creates a panel.

Arguments:
- `id: string`
- `type: "code" | "browser"`

Rules:
- `id` must be unique
- panel becomes available immediately after creation

Example:
```js
new_panel("code1", "code")
```

### `close_panel(id)`
Closes an existing panel.

Arguments:
- `id: string`

---

## 10.3 Layout / focus

### `layout(mode)`
Sets app layout.

Allowed values:
- `"single"`
- `"two-column"`
- `"grid"`

### `focus_panel(id)`
Marks a panel as visually focused.

Expected UI behavior:
- slightly stronger border or highlight
- no execution-side impact beyond state

---

## 10.4 Code panel commands

### `open_code(id, path, line?)`
Loads a text file into a code panel and optionally scrolls to a line.

Arguments:
- `id: string`
- `path: string`
- `line?: number`

Rules:
- panel must exist and be type `code`
- path must exist and be readable
- file must be within allowed roots if root restriction is enabled

### `scroll_code(id, line)`
Scrolls code panel to a line.

Arguments:
- `id: string`
- `line: number`

### `select_code(id, line, startCol, endCol)`
Highlights a single-line range.

Arguments:
- `id: string`
- `line: number`
- `startCol: number`
- `endCol: number`

Rules:
- `startCol <= endCol`
- columns are 0-based in DSL
- runtime converts to editor-native indexing if needed

### `highlight_lines(id, startLine, endLine)`
Highlights one or more whole lines.

Arguments:
- `id: string`
- `startLine: number`
- `endLine: number`

### `clear_code_selection(id)`
Clears any code highlight/selection.

---

## 10.5 Browser panel commands

### `open_browser(id, url)`
Navigates a browser panel to a URL.

Arguments:
- `id: string`
- `url: string`

Rules:
- panel must exist and be type `browser`
- runtime waits for navigation complete or timeout

### `click_text(id, text)`
Finds the best visible clickable element whose text matches and clicks it.

Arguments:
- `id: string`
- `text: string`

Candidate elements:
- `button`
- `a`
- `input[type=button]`
- `input[type=submit]`
- elements with role `button`

Matching behavior:
- exact visible text first
- trimmed case-insensitive fallback
- substring fallback only if unique

### `type_text(id, targetText, value)`
Finds an input based on associated label, placeholder, aria-label, name, or nearby visible text and enters a value.

Arguments:
- `id: string`
- `targetText: string`
- `value: string`

### `wait_for_text(id, text, timeoutMs?)`
Waits until visible page text contains a target string.

Arguments:
- `id: string`
- `text: string`
- `timeoutMs?: number`

Default timeout:
- 5000 ms

### `wait_for_navigation(id, timeoutMs?)`
Waits for page navigation / load settle.

### `highlight_text(id, text)`
Finds visible text and briefly highlights the associated DOM region.

### `press_key(id, key)`
Sends a keyboard key to the active element in the browser panel.

Allowed keys in v1:
- `"Enter"`
- `"Tab"`
- `"Escape"`

### `browser_back(id)`
Navigates back once.

### `browser_forward(id)`
Navigates forward once.

### `browser_reload(id)`
Reloads current page.

---

## 10.6 Timing and narration

### `pause(seconds)`
Waits for a duration.

Arguments:
- `seconds: number`

Rules:
- must be `>= 0`

### `tts(text)`
Speaks narration text via TTS.

Arguments:
- `text: string`

Behavior:
- action resolves when speech ends
- if muted, speech is skipped but action still resolves after a minimal delay of 50 ms

### `note(text)`
Editor-visible note only.

Arguments:
- `text: string`

Behavior:
- no runtime effect
- appears in timeline/debug UI

---

## 10.7 Future-reserved commands
Not implemented in v1 but reserve names:
- `open_terminal`
- `run_terminal`
- `click_selector`
- `type_selector`
- `screenshot`
- `voice`
- `set_var`
- `if_text`

---

## 11. Normalized action schema

All DSL commands compile into normalized action objects.

### 11.1 Base action
```ts
interface BaseAction {
  id: string;
  type: string;
  sourceLine: number;
}
```

### 11.2 Action union
```ts
type Action =
  | MetaAction
  | NewPanelAction
  | ClosePanelAction
  | LayoutAction
  | FocusPanelAction
  | OpenCodeAction
  | ScrollCodeAction
  | SelectCodeAction
  | HighlightLinesAction
  | ClearCodeSelectionAction
  | OpenBrowserAction
  | ClickTextAction
  | TypeTextAction
  | WaitForTextAction
  | WaitForNavigationAction
  | HighlightTextAction
  | PressKeyAction
  | BrowserBackAction
  | BrowserForwardAction
  | BrowserReloadAction
  | PauseAction
  | TtsAction
  | NoteAction;
```

### 11.3 Examples
```ts
interface NewPanelAction extends BaseAction {
  type: "panel.new";
  panelId: string;
  panelType: "code" | "browser";
}

interface OpenCodeAction extends BaseAction {
  type: "code.open";
  panelId: string;
  path: string;
  line?: number;
}

interface TtsAction extends BaseAction {
  type: "tts.speak";
  text: string;
}
```
