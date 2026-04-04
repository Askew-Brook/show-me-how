# WIP 11 — Roadmap and Decisions

> Prototype note: the active prototype has been narrowed to **code walkthroughs only**. Browser panel work is deferred until the code-focused experience is solid.

## 41. Explicit v1 build order

### Phase 1
- data types
- tokenizer
- parser
- compiler
- diagnostics UI

### Phase 2
- runtime player
- timeline UI
- pause / restart / next step

### Phase 3
- code panel
- file IPC
- line selection / highlighting

### Phase 4
- TTS
- mute / speed support

### Phase 5
- validation polish
- log panel
- error handling polish

### Phase 6
- AI generation entry point

### Deferred after code prototype
- browser panel
- preload bridge
- click/type/wait actions

---

## 42. Recommended v1 defaults

- start layout: `two-column`
- TTS rate: `1`
- stop on first error: `true`
- columns in `select_code`: 0-based in DSL

---

## 43. Open decisions still to choose

These are the remaining product choices, but none block the current prototype:

1. Should file access be unrestricted or rooted?
2. Should `note()` appear in exported timelines?
3. Should the app support hidden utility panels in v1?
4. Should integrated AI output DSL directly or JSON that gets re-rendered as DSL?
5. When should browser support come back after the code-focused prototype is stable?

Recommendation for the current prototype:
- rooted file access if practical
- notes visible in timeline
- no hidden panels
- AI outputs DSL directly
- defer browser work until the code walkthrough flow feels reliable
