# WIP 06 — UI and Timeline

## 21. UI specification

## 21.1 Main application regions
1. Top bar
2. Left editor/timeline pane
3. Right workspace pane
4. Bottom log/status bar

### 21.2 Top bar
Contains:
- presentation title
- Validate button
- Play / Pause / Resume / Restart / Stop
- speed selector
- mute toggle

### 21.3 Editor pane
Tabs:
- Script
- Diagnostics
- Timeline

### 21.4 Workspace pane
Displays open panels.

### 21.5 Log bar
Shows:
- current step
- short status
- errors/warnings count

---

## 22. Timeline view

Each action appears as a row.

Fields:
- index
- source line
- action type
- human-friendly summary
- status: pending / running / done / failed / skipped

Example row:
- `12 · line 18 · click_text(web1, "Sign in") · failed`

---

## 34. Accessibility requirements

### v1 minimum
- keyboard-accessible controls
- visible focus states
- captions/transcript pane optional later, not required v1
- mute TTS available
- log/diagnostic text selectable

---

## 35. Persistence

### v1 saveables
- `.smh` source file
- window layout preferences
- mute/speed preference
- last opened presentations list optional

### Do not persist in v1
- browser cookies/session unless Electron default behavior already does so and you explicitly want it

Recommendation:
Prefer isolated session partition for demos if you want deterministic runs.
