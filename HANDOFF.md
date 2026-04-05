# ShowMeHow Alpha Handoff

## Current state
- Product name: **ShowMeHow**
- Owner/branding: **Askew Brook**
- License: **MIT-0**
- Version: **0.1.0 alpha**
- Main packaged app:
  - `/Users/spriggs/Documents/Projects/show-me-how/ShowMeHow.app`
- Main repo root:
  - `/Users/spriggs/Documents/Projects/show-me-how`

## What is working
- Electron app with React/TypeScript/Tailwind/Zustand
- Code-walkthrough-only prototype
- Project system backed by SQLite
- EYJ seeded as a project
- CLI control of running app
- Project skill added under:
  - `.agents/skills/show-me-how/`
- `.smh` file association / open-file flow
- Presentation mode with script hidden
- Code panels with syntax highlighting
- Internal code-panel scrolling
- `select_code_line(...)` DSL command
- Bundled macOS app build created
- Local TTS using macOS `say` + wav conversion
- Slim narration bar in presentation mode only
- `.smh` external open flow now attempts to auto-play when project is already selected

## Important files
### App/runtime
- `app/src/main/index.ts`
- `app/src/preload/index.ts`
- `app/src/renderer/src/App.tsx`
- `app/src/renderer/src/store/appStore.ts`
- `app/src/renderer/src/components/CodePanel.tsx`
- `app/src/renderer/src/components/ProjectSelector.tsx`
- `app/src/renderer/src/lib/remoteControl.ts`
- `app/bin/smh-cli.mjs`

### Packaging / metadata
- `app/package.json`
- `LICENSE`
- `README.md`
- `.gitignore`

### Skill
- `.agents/skills/show-me-how/SKILL.md`
- `.agents/skills/show-me-how/references/cli.md`
- `.agents/skills/show-me-how/references/smh-dsl.md`

## Saved demo script
- `/Users/spriggs/Documents/Projects/show-me-how/eyj-crm-enquiries-tour.smh`

This script tours EYJ CRM enquiries:
- schema/migrations
- `Enquiry` model
- website capture path via `ContactController`
- internal CRM dashboard creation path
- `EnquiryStatus` enum
- Filament resource/table/form
- follow-up / duplicate / convert-to-opportunity actions
- observer cleanup

## Recently changed behavior
### File open flow
The app store bootstrap and incoming external script handling were updated so that:
- if a project is already selected and an `.smh` is opened externally, the app should:
  - load the script
  - validate it
  - auto-play it
- if no project is selected, it should still require project choice, then auto-play after selection

Files changed for this:
- `app/src/renderer/src/store/appStore.ts`

## Known issues / caution
### 1. Restart/stop/TTS still needs real-world verification
There were multiple passes on TTS cancellation.
Current implementation includes:
- run-id invalidation
- active TTS session handle with explicit `stop()`
- reset of TTS state on abort

But this should still be tested carefully by:
- starting a script
- waiting for narration
- spamming Restart
- confirming no overlapping voices remain

Main file:
- `app/src/renderer/src/store/appStore.ts`

### 2. CLI `play` can time out
The app itself may play fine, but the CLI `play` command can time out if playback is interrupted or long-running while waiting on control response.
Useful workaround:
- push/validate via CLI
- press Play in app manually

### 3. Packaged app must be restarted after rebuilds
Because the user often leaves the app open, testing rebuilt behavior requires:
- fully quitting the app
- reopening `ShowMeHow.app`

### 4. Default Electron icon still used
No custom app icon yet.

## Packaging
Built with electron-builder.
Current package command used:
```bash
cd /Users/spriggs/Documents/Projects/show-me-how/app
npx electron-builder --mac dir --arm64 --config.directories.output=../bundle-output
```

App copied to repo root as:
- `ShowMeHow.app`

## Validation status at handoff
Last verified:
- `npm run typecheck` ✅
- `npm run build` ✅

## Suggested next steps
1. Test `.smh` double-click/open behavior end-to-end using the packaged app.
2. Re-test restart spam during TTS and harden if overlap still happens.
3. If needed, make CLI `play` fire-and-forget instead of waiting for a long synchronous response.
4. Add a proper app icon.
5. Optional UI cleanup pass on project selector.

## Quick commands
### CLI health
```bash
cd /Users/spriggs/Documents/Projects/show-me-how/app
node ./bin/smh-cli.mjs health
```

### Open EYJ
```bash
node ./bin/smh-cli.mjs open-project eyj
```

### Push a script
```bash
node ./bin/smh-cli.mjs push-script /path/to/file.smh
```

### Validate
```bash
node ./bin/smh-cli.mjs validate
```

## User preference reminders
- Wants a **working prototype / alpha**, not polish theater
- Wants very simple UI
- Wants lots of screen real estate
- Browser automation is intentionally out for now
- Prefers code-only walkthroughs
- Likes `select_code_line(...)`
