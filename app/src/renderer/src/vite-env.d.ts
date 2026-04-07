/// <reference types="vite/client" />

import type { ProjectBootState, ProjectRecord, RecentPresentationEntry } from './lib/projects'

declare module 'monaco-editor/esm/vs/editor/editor.api' {
  export * from 'monaco-editor'
}

declare global {
  interface Window {
    smh: {
      pickFile: (projectRootPath?: string | null) => Promise<string | null>
      pickPresentationFile: (projectRootPath?: string | null) => Promise<string | null>
      pickFolder: () => Promise<string | null>
      readTextFile: (
        filePath: string,
        projectRootPath?: string | null
      ) => Promise<{ path: string; content: string; exists: boolean }>
      fileExists: (filePath: string, projectRootPath?: string | null) => Promise<boolean>
      resolvePath: (filePath: string, projectRootPath?: string | null) => Promise<string>
      synthesizeSpeechToFile: (
        text: string,
        options?: { voice?: string | null; rate?: number | null }
      ) => Promise<{ mimeType: string; base64Audio: string }>
      primeTtsCache: (
        requests: Array<{ text: string; voice?: string | null; rate?: number | null }>
      ) => Promise<{ warmed: number }>
      getBootState: () => Promise<ProjectBootState>
      createProject: (input: { name: string; rootPath: string }) => Promise<ProjectRecord>
      updateProject: (projectId: number, input: { name: string; rootPath: string }) => Promise<ProjectRecord>
      importProjectsFromParent: (parentPath: string) => Promise<import('./lib/projects').ProjectImportResult>
      deleteProject: (projectId: number) => Promise<ProjectBootState>
      setCurrentProject: (projectId: number) => Promise<ProjectRecord>
      clearCurrentProject: () => Promise<ProjectBootState>
      getRecentPresentationPaths: () => Promise<RecentPresentationEntry[]>
      rememberRecentPresentationPath: (filePath: string, projectId?: number | null) => Promise<RecentPresentationEntry[]>
      clearPendingScript: () => Promise<void>
      openPath: (filePath: string, projectRootPath?: string | null) => Promise<{ ok: boolean; error: string | null }>
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
