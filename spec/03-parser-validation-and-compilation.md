# WIP 03 — Parser, Validation, and Compilation

## 12. Parser requirements

### 12.1 Parser inputs
- DSL source string

### 12.2 Parser outputs
```ts
interface ParseResult {
  meta: PresentationMeta;
  actions: Action[];
  diagnostics: Diagnostic[];
}
```

### 12.3 Diagnostic model
```ts
interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  line: number;
  column?: number;
  code: string;
}
```

### 12.4 Parser constraints
- reject unknown commands
- reject malformed argument counts
- reject unsupported literal shapes
- preserve source line mapping

### 12.5 Strategy
Do not parse by evaluating code.

Implement a small custom parser or use a restricted grammar parser.

Recommended v1 approach:
- tokenizer
- simple function-call parser
- object literal support only for `meta()`

---

## 13. Semantic validation rules

Validation happens after parsing and before playback.

### 13.1 Global validation
- no duplicate panel ids for `new_panel`
- every referenced panel id must exist earlier in the script
- command must match panel type
- metadata values must be valid enums / ranges

### 13.2 Code validation
- file exists
- line number exists if supplied
- selected line exists
- column ranges are valid for that line when file is available at validation time

### 13.3 Browser validation
- URL is syntactically valid
- commands reference browser panels
- click/type commands may only produce warnings at validation time if page not yet loaded

### 13.4 Timing validation
- pause seconds >= 0
- timeout values > 0

### 13.5 TTS validation
- text non-empty after trim

### 13.6 Notes
- `note()` never errors unless malformed

---

## 27. Parser-to-runtime compilation

### 27.1 Compile step responsibilities
- convert parsed command names to normalized action types
- assign action ids
- preserve source line
- lift metadata into `PresentationMeta`
- exclude `note()` from executable queue only if timeline wants non-runtime entries separated

Recommendation:
Keep `note()` in the timeline list but mark `isExecutable = false`.

---

## 28. Human-readable action summaries

Each action gets a generated summary for timeline display.

Examples:
- `Create code panel code1`
- `Open /Users/jack/project/file.php in code1 at line 33`
- `Select columns 0–122 on line 33 in code1`
- `Speak narration`
