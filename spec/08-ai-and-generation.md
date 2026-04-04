# WIP 08 — AI and Generation

## 29. Initial AI integration contract

v1 does not require direct model integration, but the app should define a generation target shape.

### 29.1 AI output target
Preferred AI output:
- valid `.smh` DSL only
- no prose outside code block when using an integrated generator

### 29.2 AI generation prompt rules
The model should be told:
- only use supported commands
- always create panels before using them
- use explicit panel ids
- keep TTS short and clear
- prefer `wait_for_text` after actions that trigger a page update

### 29.3 Validation after generation
All AI-generated scripts must pass parser + validator before playback.
