# ShowMeHow

ShowMeHow is owned and branded by **Askew Brook**, a UK-based web firm.
The source code is licensed under **MIT-0**.

## Summary

> Alpha update: the current 0.1.0 alpha is focused on **code walkthroughs only**. Browser panels and browser automation are deferred.

**SHOW ME HOW** is a desktop Electron application for playing scripted AI-guided presentations.

A presentation consists of a sequence of actions such as:
- opening panels
- loading code files
- scrolling or selecting code
- opening web pages
- filling forms
- clicking UI controls
- pausing
- speaking narration through TTS

The app executes the script step-by-step as a deterministic timeline.

The core goal is to let AI generate a demo/presentation that can visually walk a viewer through code and browser flows while narrating what is happening.

### v1 in scope
- Electron desktop app
- Local presentation files
- Script editor
- Play / pause / resume / restart / next step
- Panel layout manager
- Code panel
- TTS narration
- Action validation before run
- Deterministic sequential playback
- Local file access for code panels
- Basic logging / debug output

### Prototype focus right now
- code walkthroughs only
- no browser panel in the current prototype
- no browser automation in the current prototype

### v1 out of scope
- Collaboration / multi-user editing
- Cloud sync
- Video export
- Screen recording
- Branching timelines
- Rich animations beyond essential transitions
- Multi-voice narration
- Automatic recovery from every browser failure
- Arbitrary plugin marketplace
- General-purpose agent autonomy

### Product goals
1. AI can generate a demo script in a constrained language.
2. A human can read and edit that script.
3. The app can validate and run the script predictably.
4. A viewer can follow the presentation visually and via TTS.
5. Failures are understandable and debuggable.

### High-level architecture
The application has five main layers:

1. **Script authoring layer**
   - text editor
   - syntax highlighting later if desired
   - save/load presentation files

2. **Compiler / parser layer**
   - converts DSL into normalized actions
   - validates schema and command arguments

3. **Runtime player**
   - executes actions in order
   - maintains presentation state
   - handles pauses, TTS completion, panel lifecycle

4. **Panel subsystem**
   - code panel implementation
   - browser panel implementation
   - layout management

5. **System integration layer**
   - file system access
   - TTS engine
   - Electron IPC
   - browser preload automation bridge

### Technology choices
#### Required stack
- Electron
- TypeScript
- React
- Zustand for renderer state
- Monaco Editor for code panel and script editor

#### Recommended
- Zod for schema validation
- Prettier for formatting script/JSON output
- Vitest for unit tests
- Playwright only later if you want broader browser automation testing, not required for v1 runtime

#### TTS v1
- Use macOS system TTS (`say`) through the Electron main process
- Optional script voice can be set with `meta({ voice: "Voice Name" })`

#### Browser panel v1
- Use Electron `webview` with preload script

## Appendix

### Presentation file extension
Use:
- `.smh` for the DSL source

### Example source file
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

### Example complete script
```js
meta({
  title: "Auth Flow Demo",
  startLayout: "two-column",
  rate: 1
})

layout("two-column")

new_panel("code1", "code")
focus_panel("code1")
open_code("code1", "/Users/jack/app/Http/Controllers/Auth/LoginController.php", 33)
highlight_lines("code1", 33, 42)
tts("This controller receives the login form and forwards the credentials to the auth service.")
pause(0.5)
select_code("code1", 37, 8, 48)
tts("This is the key call. Once authentication succeeds, the response is redirected to the dashboard.")
clear_code_selection("code1")

new_panel("web1", "browser")
focus_panel("web1")
open_browser("web1", "https://example.test/login")
wait_for_text("web1", "Sign in", 8000)
tts("Now I will show the same flow from the user side.")
type_text("web1", "Email", "jack@example.com")
type_text("web1", "Password", "secret123")
click_text("web1", "Sign in")
wait_for_text("web1", "Dashboard", 8000)
tts("As soon as the form is submitted, the app signs the user in and redirects to the dashboard.")
```

### Example compiled output
```json
{
  "meta": {
    "title": "Auth Flow Demo",
    "startLayout": "two-column",
    "rate": 1
  },
  "actions": [
    { "id": "a1", "type": "layout.set", "mode": "two-column", "sourceLine": 7 },
    { "id": "a2", "type": "panel.new", "panelId": "code1", "panelType": "code", "sourceLine": 9 },
    { "id": "a3", "type": "panel.focus", "panelId": "code1", "sourceLine": 10 },
    { "id": "a4", "type": "code.open", "panelId": "code1", "path": "/Users/jack/app/Http/Controllers/Auth/LoginController.php", "line": 33, "sourceLine": 11 }
  ]
}
```

### Suggested folder structure
```txt
show-me-how/
  package.json
  electron.vite.config.ts
  src/
    main/
      index.ts
      ipc/
        fs.ts
        config.ts
    preload/
      index.ts
      webview-preload.ts
    renderer/
      main.tsx
      App.tsx
      components/
        TopBar.tsx
        EditorPane.tsx
        TimelinePane.tsx
        DiagnosticsPane.tsx
        Workspace.tsx
        panels/
          CodePanel.tsx
          BrowserPanel.tsx
      runtime/
        player.ts
        executors/
          panel.ts
          code.ts
          browser.ts
          tts.ts
          timing.ts
        parser/
          tokenizer.ts
          parser.ts
          compiler.ts
          diagnostics.ts
        validation/
          validate.ts
        store/
          appStore.ts
      shared/
        actions.ts
        meta.ts
        diagnostics.ts
        logs.ts
```

### TypeScript interface set
```ts
export interface PresentationMeta {
  title?: string;
  startLayout?: "single" | "two-column" | "grid";
  defaultPauseAfterTts?: number;
  voice?: string;
  rate?: number;
}

export interface PresentationDocument {
  meta: PresentationMeta;
  actions: Action[];
}

export interface ParseResult {
  meta: PresentationMeta;
  actions: Action[];
  diagnostics: Diagnostic[];
}

export interface ExecuteContext {
  runtime: RuntimeState;
  panelRegistry: PanelRegistry;
  tts: TtsService;
  config: AppConfig;
}
```

### Final product definition
**SHOW ME HOW v1** is a deterministic scripted desktop demo player for code and web workflows. It uses a constrained DSL to define panel actions, narration, and timing, then executes those steps in sequence inside an Electron app with a code viewer, embedded browser, timeline, and TTS.
