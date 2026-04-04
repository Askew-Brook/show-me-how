# WIP 10 — Testing and Acceptance

## 37. Test plan

## 37.1 Unit tests
- tokenizer
- parser
- compiler
- validators
- action summary generation
- DOM matching heuristics in isolation

## 37.2 Integration tests
- open code file and select range
- open browser and wait for text
- type text into labeled input
- click button by text
- TTS action resolves

## 37.3 Manual acceptance scenarios
1. basic code walkthrough
2. basic login form demo
3. browser ambiguity failure
4. file not found failure
5. pause/resume during TTS

---

## 40. MVP acceptance criteria

The MVP is complete when all of the following are true:

1. A user can create or open a `.smh` file.
2. The parser accepts valid scripts and surfaces line-based diagnostics for invalid ones.
3. The validator catches duplicate panels, missing panels, wrong panel types, invalid paths, and invalid numeric ranges.
4. The app can render at least one code panel and one browser panel simultaneously.
5. The app can open a local text file in a code panel and highlight lines/ranges.
6. The app can open a URL in a browser panel.
7. The app can type into a labeled browser input and click a text-matched button.
8. The app can wait for text to appear after navigation or form submission.
9. The app can speak narration using TTS.
10. The app can play, pause, resume, restart, and stop a presentation.
11. On runtime failure, the app highlights the failing action and shows a readable error.
