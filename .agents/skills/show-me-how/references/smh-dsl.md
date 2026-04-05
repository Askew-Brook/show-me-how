# ShowMeHow DSL Reference

This is the **current prototype** DSL guidance.

## Prototype scope

- code walkthroughs only
- no browser automation
- browser panels are currently disabled in the app UI
- external `.smh` open flow exists, but scripts should still stay deterministic and code-focused

## Core commands

### `meta(object)`
Use for presentation metadata.

Example:
```js
meta({
  title: "EYJ Authentication Walkthrough",
  startLayout: "two-column",
  rate: 1
})
```

### `layout(mode)`
Use:
- `"single"`
- `"two-column"`
- `"grid"`

For most walkthroughs, prefer:
```js
layout("two-column")
```

### `new_panel(id, "code")`
Creates a code panel.

Example:
```js
new_panel("code1", "code")
```

### `focus_panel(id)`
Visually focuses a panel.

### `open_code(id, path, line?)`
Opens a file in a code panel.

Prefer **relative paths** from the selected project root.

Example:
```js
open_code("code1", "app/Http/Controllers/LoginCodeController.php", 14)
```

### `highlight_lines(id, startLine, endLine)`
Highlights a block of lines and scrolls the panel into view.

Example:
```js
highlight_lines("code1", 14, 24)
```

### `select_code_line(id, line, startCol?)`
Selects from `startCol` to the end of the line.

Examples:
```js
select_code_line("code1", 22)
select_code_line("code1", 22, 8)
```

Prefer this over hand-counting the end column.

### `select_code(id, line, startCol, endCol)`
Precise single-line range selection.

Use only when you truly need a subrange.

### `clear_code_selection(id)`
Clears the selection/highlight for the code panel.

### `pause(seconds)`
Adds a timing beat.

Example:
```js
pause(0.5)
```

### `tts(text)`
Narration.

Keep it short and concrete.

### `note(text)`
Non-executable note shown in the timeline/debug flow.

## Commands to avoid right now

These are disabled in the current prototype:
- `open_browser`
- `click_text`
- `type_text`
- `wait_for_text`
- `wait_for_navigation`
- `highlight_text`
- `press_key`
- `browser_back`
- `browser_forward`
- `browser_reload`

## Writing style guidance

- Prefer relative file paths from the selected project root.
- Use 1-2 code panels for most demos.
- Move panel focus intentionally.
- Highlight blocks first, then select key lines.
- Use `select_code_line()` before `select_code()` unless you truly need exact end columns.
- Use vendor framework files when they explain behavior.
- Prefer short TTS after each visual change.
- Add `pause()` between major beats.
- Keep scripts deterministic and explicit.

## Example pattern

```js
meta({
  title: "Example Walkthrough",
  startLayout: "two-column",
  rate: 1
})

layout("two-column")

new_panel("code1", "code")
focus_panel("code1")
open_code("code1", "routes/web.php", 40)
highlight_lines("code1", 40, 41)
tts("The login entry point is defined here.")
pause(0.5)

new_panel("code2", "code")
focus_panel("code2")
open_code("code2", "app/Http/Controllers/LoginCodeController.php", 14)
highlight_lines("code2", 14, 24)
select_code_line("code2", 22, 8)
tts("This line stores the login code in session state.")
```
