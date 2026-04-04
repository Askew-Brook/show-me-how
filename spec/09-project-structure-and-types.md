# WIP 09 — Project Structure and Types

## 38. Suggested folder structure

```txt
show-me-how/
  package.json
  electron.vite.config.ts
  src/
    main/
      index.ts
      ipc/
        fs.ts
        config.ts
    preload/
      index.ts
      webview-preload.ts
    renderer/
      main.tsx
      App.tsx
      components/
        TopBar.tsx
        EditorPane.tsx
        TimelinePane.tsx
        DiagnosticsPane.tsx
        Workspace.tsx
        panels/
          CodePanel.tsx
          BrowserPanel.tsx
      runtime/
        player.ts
        executors/
          panel.ts
          code.ts
          browser.ts
          tts.ts
          timing.ts
        parser/
          tokenizer.ts
          parser.ts
          compiler.ts
          diagnostics.ts
        validation/
          validate.ts
        store/
          appStore.ts
      shared/
        actions.ts
        meta.ts
        diagnostics.ts
        logs.ts
```

---

## 39. TypeScript interface set

```ts
export interface PresentationMeta {
  title?: string;
  startLayout?: "single" | "two-column" | "grid";
  defaultPauseAfterTts?: number;
  voice?: string;
  rate?: number;
}

export interface PresentationDocument {
  meta: PresentationMeta;
  actions: Action[];
}

export interface ParseResult {
  meta: PresentationMeta;
  actions: Action[];
  diagnostics: Diagnostic[];
}

export interface ExecuteContext {
  runtime: RuntimeState;
  panelRegistry: PanelRegistry;
  tts: TtsService;
  config: AppConfig;
}
```
