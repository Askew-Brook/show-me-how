# WIP 01 — Product and Scope

## 2. Scope

### v1 in scope
- Electron desktop app
- Local presentation files
- Script editor
- Play / pause / resume / restart / next step
- Panel layout manager
- Code panel
- Browser panel
- TTS narration
- Action validation before run
- Deterministic sequential playback
- Local file access for code panels
- Browser automation within embedded browser panels
- Basic logging / debug output

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

---

## 3. Product goals

1. AI can generate a demo script in a constrained language.
2. A human can read and edit that script.
3. The app can validate and run the script predictably.
4. A viewer can follow the presentation visually and via TTS.
5. Failures are understandable and debuggable.

### Non-goals
- Not a full IDE
- Not a browser test runner
- Not a slide deck tool like PowerPoint
- Not a general RPA platform

---

## 4. Primary user stories

### 4.1 Create a presentation
As a user, I can create a presentation file and write commands in a simple script.

### 4.2 Generate from AI
As a user, I can ask AI to generate a draft presentation script for a demo.

### 4.3 Review and fix
As a user, I can validate the script and fix any broken steps before playing it.

### 4.4 Play the demo
As a user, I can play the presentation and have the app carry out actions in order.

### 4.5 Step through failures
As a user, I can inspect which action failed and why.

### 4.6 Re-run reliably
As a user, I can restart a presentation and get the same sequence again.

---

## 5. High-level architecture

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

---

## 6. Technology choices

### Required stack
- Electron
- TypeScript
- React
- Zustand for renderer state
- Monaco Editor for code panel and script editor

### Recommended
- Zod for schema validation
- Prettier for formatting script/JSON output
- Vitest for unit tests
- Playwright only later if you want broader browser automation testing, not required for v1 runtime

### TTS v1
- Use browser `speechSynthesis`

### Browser panel v1
- Use Electron `webview` with preload script

Reasoning:
- `webview` is fast to integrate for a controlled embedded browser experience.
- preload script can expose constrained DOM automation helpers.
- v1 should optimize for shipping, not maximum Electron purity.

---

## 7. Process model

Every presentation follows this flow:

1. Author writes or AI generates script.
2. Script is parsed to an AST-like intermediate structure.
3. Structure is normalized into an action queue.
4. Validator checks semantics.
5. Player runs actions sequentially.
6. Each action resolves only when complete.
7. Runtime updates UI state and logs.
