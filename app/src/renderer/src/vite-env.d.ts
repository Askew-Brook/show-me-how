/// <reference types="vite/client" />

import type { ProjectBootState, ProjectRecord } from './lib/projects'

declare global {
  interface Window {
    smh: {
      pickFile: (projectRootPath?: string | null) => Promise<string | null>
      pickFolder: () => Promise<string | null>
      readTextFile: (
        filePath: string,
        projectRootPath?: string | null
      ) => Promise<{ path: string; content: string; exists: boolean }>
      fileExists: (filePath: string, projectRootPath?: string | null) => Promise<boolean>
      resolvePath: (filePath: string, projectRootPath?: string | null) => Promise<string>
      getConfig: () => Promise<{ defaultBrowserTimeoutMs: number; defaultNavigationTimeoutMs: number; controlUrl: string }>
      synthesizeSpeechToFile: (
        text: string,
        options?: { voice?: string | null; rate?: number | null }
      ) => Promise<{ mimeType: string; base64Audio: string }>
      getBootState: () => Promise<ProjectBootState>
      createProject: (input: { name: string; rootPath: string; defaultScriptPath?: string | null }) => Promise<ProjectRecord>
      updateProject: (
        projectId: number,
        input: { name: string; rootPath: string; defaultScriptPath?: string | null }
      ) => Promise<ProjectRecord>
      deleteProject: (projectId: number) => Promise<ProjectBootState>
      setCurrentProject: (projectId: number) => Promise<ProjectRecord>
      clearPendingScript: () => Promise<void>
      onExternalScriptOpened: (callback: (scriptPath: string) => void) => () => void
      onControlCommand: (callback: (payload: { id: string; command: Record<string, unknown> }) => void) => () => void
      respondToControlCommand: (payload: { id: string; ok: boolean; result?: unknown; error?: string }) => void
    }
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        partition?: string
        allowpopups?: boolean
      }
    }
  }
}

export {}
