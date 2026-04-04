# WIP 04 — Runtime and Controls

## 14. Runtime execution model

### 14.1 Player behavior
The player executes actions sequentially.

Pseudo-flow:
```ts
for (const action of actions) {
  if (runtime.stopRequested) break;
  await executeAction(action, runtime);
}
```

### 14.2 Execution contract
Each action executor must return a Promise that resolves only when the action is complete.

### 14.3 Runtime state
```ts
interface RuntimeState {
  status: "idle" | "playing" | "paused" | "completed" | "error";
  currentActionIndex: number;
  panels: Record<string, RuntimePanelState>;
  logs: RuntimeLogEntry[];
  muteTts: boolean;
  speedMultiplier: number;
}
```

### 14.4 Action timing
Apply `speedMultiplier` to:
- pauses
- optional UI animation durations

Do not apply `speedMultiplier` to:
- actual page load time
- external navigation time
- file I/O

May optionally apply to TTS rate if implemented simply.

---

## 15. Runtime controls

### v1 required controls
- Play
- Pause
- Resume
- Restart
- Next step
- Stop
- Mute TTS toggle
- Speed selector: `0.75x`, `1x`, `1.25x`, `1.5x`, `2x`

### v1 optional
- Previous step

Recommendation:
Do not implement true reverse execution in v1.
If previous step is added, rebuild state from action 0 to target index.

---

## 23. Error model

### 23.1 Error categories
- ParseError
- ValidationError
- RuntimeError
- TimeoutError
- AmbiguityError
- UnsupportedActionError

### 23.2 Runtime error shape
```ts
interface RuntimeErrorInfo {
  category: string;
  actionId: string;
  actionType: string;
  message: string;
  detail?: string;
  sourceLine?: number;
}
```

### 23.3 Runtime failure behavior
Default v1 behavior:
- stop playback on first runtime error
- highlight failing action
- keep current UI state visible
- write structured log entry

Optional later:
- continue-on-error mode

---

## 24. Logging

### 24.1 Log levels
- info
- warn
- error
- debug

### 24.2 Log entry model
```ts
interface RuntimeLogEntry {
  timestamp: number;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  actionId?: string;
}
```

### 24.3 Example logs
- `Loaded file /path/to/file`
- `Clicked button 'Sign in'`
- `TTS completed`
- `Ambiguous match for click_text: 2 candidates`

---

## 32. State machines

## 32.1 Player state machine
States:
- idle
- validating
- ready
- playing
- paused
- completed
- error

Transitions:
- idle -> validating
- validating -> ready | error
- ready -> playing
- playing -> paused | completed | error | idle
- paused -> playing | idle

### 32.2 Action state machine
- pending
- running
- success
- failed
- skipped

---

## 33. Performance requirements

### v1 targets
- parse 500-line script in under 100 ms on normal dev hardware
- open 200 KB text file in under 250 ms
- action transition overhead under 50 ms excluding I/O and page loads
- timeline render remains responsive for 300 actions

---

## 36. Determinism rules

For reliable demos:
- require explicit waits after page-changing actions where needed
- fail on ambiguous DOM targets
- avoid fuzzy hidden-state assumptions
- use exact panel ids everywhere
- do not silently skip failed actions
