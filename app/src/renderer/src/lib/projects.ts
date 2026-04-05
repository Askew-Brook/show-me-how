export interface ProjectRecord {
  id: number
  name: string
  rootPath: string
  gitRemoteSlug: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectBootState {
  projects: ProjectRecord[]
  currentProjectId: number | null
  pendingScriptPath: string | null
}

export interface ProjectInput {
  name: string
  rootPath: string
}

export interface ProjectImportResult {
  projects: ProjectRecord[]
  imported: number
  skippedExisting: number
  skippedInvalid: number
}

export interface RecentPresentationEntry {
  path: string
  projectId: number | null
}
