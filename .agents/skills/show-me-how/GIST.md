---
name: smh-authoring
description: Writes .smh walkthrough scripts using the ShowMeHow DSL.
---

# SMH Authoring

Use this skill to write `.smh` walkthrough scripts.

## Goal

Write a short, deterministic code walkthrough that:
- opens the right file(s)
- highlights the important block(s)
- calls out the key line(s)
- explains what the viewer is seeing and why it matters
- pauses between major beats

## Rules

- Prefer project-relative paths in `open_code()`.
- Prefer 1-2 code panels.
- Keep the walkthrough focused and easy to follow.
- Keep narration short, concrete, and technical.
- Use `highlight_lines()` before precise selections.
- Use `select_code_line()` more often than `select_code()`.
- Open supporting framework or library files only when they materially clarify behavior.

## Core commands

```js
meta({ title: "Walkthrough", startLayout: "two-column", rate: 1 })
layout("two-column")
new_panel("code1", "code")
focus_panel("code1")
open_code("code1", "path/to/file.ts", 1)
highlight_lines("code1", 10, 20)
select_code_line("code1", 14, 3)
select_code("code1", 14, 3, 22)
clear_code_selection("code1")
pause(0.5)
tts("This line is the key state change.")
note("This walkthrough focuses on the main implementation path.")
```

## TTS style

Good TTS is:
- short
- factual
- tied to the highlighted code
- focused on why the code matters
- written like an engineer explaining code to another engineer

Good examples:

```js
tts("The flow starts here in the route definition.")
tts("This guard prevents duplicate processing.")
tts("This line is the key state change. The value is persisted before follow-up work begins.")
```

Avoid:
- marketing speak
- hype language
- vague commentary
- long paragraphs
- reading large chunks of code aloud
- explaining too many files in one beat

## Default template

```js
meta({
  title: "<walkthrough title>",
  startLayout: "two-column",
  rate: 1
})

layout("two-column")
note("This walkthrough explains the relevant code path.")

new_panel("code1", "code")
focus_panel("code1")
open_code("code1", "<relative/path/to/file>", <line>)
highlight_lines("code1", <start>, <end>)
tts("Explain what this block does.")
pause(0.5)

new_panel("code2", "code")
focus_panel("code2")
open_code("code2", "<relative/path/to/other-file>", <line>)
highlight_lines("code2", <start>, <end>)
tts("Explain the next important part of the flow.")
pause(0.5)

focus_panel("code2")
select_code_line("code2", <line>, <startCol>)
tts("Explain why this line matters.")
pause(0.75)
```

## Quality checklist

Before finishing, make sure the script:
- has a clear title
- uses relative paths
- has short narration per beat
- includes pauses between major transitions
- does not bounce across too many unrelated files
- would make sense to someone following the code for the first time

## Prompt block

> Write a `.smh` walkthrough script. Prefer relative file paths, keep narration short and technical, and explain the most important code path, state changes, and guardrails. Use 1-2 code panels unless a third is clearly necessary.
