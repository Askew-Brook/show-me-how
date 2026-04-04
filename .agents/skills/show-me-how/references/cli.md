# ShowMeHow CLI Reference

Base command from repo root:

```bash
node app/bin/smh-cli.mjs <command>
```

## Commands

### `health`
Checks that the app control server is reachable.

### `projects`
Lists projects known to the app.

### `open-project <name-or-id>`
Chooses a project in the running app.

### `get-script`
Prints the current script loaded in the app.

### `push-script <file>`
Reads a local file and pushes it into the app.

### `push-script --stdin`
Reads script content from stdin and pushes it into the app.

### `load-sample`
Loads the app's built-in sample script for the current project.

### `validate`
Runs parser and validation in the app and returns diagnostics.

### `play`
Switches the app into presentation mode and starts playback.

### `pause`
Pauses playback.

### `resume`
Resumes playback.

### `restart`
Restarts playback from the beginning.

### `stop`
Stops playback and resets runtime state.

### `next-step`
Executes a single next action.

### `state`
Returns the current app state, including project, status, current action, diagnostics, and recent logs.

## JSON output

Use `--json` with:
- `projects`
- `state`
- `get-script`

Example:

```bash
node app/bin/smh-cli.mjs state --json
```

## Troubleshooting

If you get a connection failure:
1. Make sure the ShowMeHow app is running.
2. Retry `health`.
3. If needed, restart the app and try again.
