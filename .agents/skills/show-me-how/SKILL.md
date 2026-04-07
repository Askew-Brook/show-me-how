---
name: show-me-how
description: Controls the local ShowMeHow app via CLI, manages projects, pushes scripts into the running app, and writes SMH scripts for code walkthroughs. Use when authoring or operating ShowMeHow demos.
---

# ShowMeHow

Use this skill when you need to:
- inspect available ShowMeHow projects
- open a project in the running app
- pull the current script from the app
- push a new script into the app
- validate or play a script
- author `.smh` walkthrough scripts for code-focused demos

## Important assumptions

- The **ShowMeHow app must already be running**.
- The current prototype is **code walkthroughs only**.
- Project-relative file paths are preferred in `open_code()`.
- The app now supports external `.smh` open flow and will try to auto-play after opening when project selection is already resolved.

## CLI location

From the repository root:

```bash
node app/bin/smh-cli.mjs health
```

If that fails, ask the user to open the ShowMeHow app first.

## Useful app/build paths

- Main packaged app: `bundle-output/mac-arm64/ShowMeHow.app`
- Package command: `cd app && npm run dist`
- Dev build only: `cd app && npm run build`

If testing packaged behavior after a rebuild, fully quit the app and reopen the packaged app.

## Core CLI commands

### Health check
```bash
node app/bin/smh-cli.mjs health
```

### List projects
```bash
node app/bin/smh-cli.mjs projects
node app/bin/smh-cli.mjs projects --json
```

### Open a project
```bash
node app/bin/smh-cli.mjs open-project eyj
node app/bin/smh-cli.mjs open-project 1
```

### Read the current script from the app
```bash
node app/bin/smh-cli.mjs get-script
node app/bin/smh-cli.mjs get-script --json
```

### Push a script into the app
From a file:
```bash
node app/bin/smh-cli.mjs push-script path/to/demo.smh
```

From stdin:
```bash
cat path/to/demo.smh | node app/bin/smh-cli.mjs push-script --stdin
```

### Load the app sample
```bash
node app/bin/smh-cli.mjs load-sample
```

### Validate and play
```bash
node app/bin/smh-cli.mjs validate
node app/bin/smh-cli.mjs play
node app/bin/smh-cli.mjs pause
node app/bin/smh-cli.mjs resume
node app/bin/smh-cli.mjs restart
node app/bin/smh-cli.mjs stop
node app/bin/smh-cli.mjs next-step
```

Note: `play` can still be less reliable from the CLI on long-running or interrupted sessions. If it times out, validate/push via CLI and press Play in the app manually.

### Read app state
```bash
node app/bin/smh-cli.mjs state
node app/bin/smh-cli.mjs state --json
```

## Recommended workflow for the agent

1. Check the app is reachable.
   ```bash
   node app/bin/smh-cli.mjs health
   ```
2. List projects.
   ```bash
   node app/bin/smh-cli.mjs projects
   ```
3. Open the target project.
   ```bash
   node app/bin/smh-cli.mjs open-project eyj
   ```
4. Write or update a `.smh` script in the repo or a temp file.
5. Push it into the running app.
   ```bash
   node app/bin/smh-cli.mjs push-script my-script.smh
   ```
6. Validate it.
   ```bash
   node app/bin/smh-cli.mjs validate
   ```
7. If valid, play it.
   ```bash
   node app/bin/smh-cli.mjs play
   ```

## Script authoring rules for the current prototype

When editing UI code or adding any new visual control while working on ShowMeHow itself, also keep the dev-mode overlay labels up to date.

Read the DSL notes in [references/smh-dsl.md](references/smh-dsl.md).

### Use these commands heavily
- `meta({...})`
- `layout("two-column")`
- `new_panel(id, "code")`
- `focus_panel(id)`
- `open_code(id, "relative/path.php", line)`
- `highlight_lines(id, startLine, endLine)`
- `select_code_line(id, line, startCol?)`
- `select_code(id, line, startCol, endCol)` only when you need a precise subrange
- `clear_code_selection(id)`
- `pause(seconds)`
- `tts(text)`
- `note(text)`

## Good script style

- Prefer **relative paths** from the selected project root.
- Use **two code panels max** unless a third is truly necessary.
- Use `highlight_lines()` to move attention between blocks.
- Use `select_code_line()` for important single-line callouts.
- Keep TTS short and explanatory.
- Add `pause()` between major moments.
- Put the most relevant file in the focused panel.
- Use vendor Laravel files when they clarify framework behavior.

## Example operator loop

```bash
node app/bin/smh-cli.mjs open-project eyj
node app/bin/smh-cli.mjs push-script auth-walkthrough.smh
node app/bin/smh-cli.mjs validate
node app/bin/smh-cli.mjs play
```

## References

- [CLI reference](references/cli.md)
- [SMH DSL reference](references/smh-dsl.md)
