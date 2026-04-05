# AGENTS

ShowMeHow = small Electron app for playing `.smh` scripted walkthroughs with narration.

`.smh` is a new file type defined by this project: a plain-text DSL for deterministic demo/presentation steps (`meta`, panels, code opens/highlights, notes, pauses, `tts`, etc.).

## Shape
- `app/`: actual app code (Electron + React + TS)
- root: docs, example scripts, local build artifacts

## Commands
- `cd app && npm run dev`
- `cd app && npm run build`
- `cd app && npm test`

## Notes
- Current prototype is mainly code-walkthrough focused.
- `ShowMeHow.app/` and `bundle-output/` are local binaries/build output, not source.
