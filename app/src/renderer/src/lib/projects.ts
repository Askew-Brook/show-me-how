export interface ProjectRecord {
  id: number
  name: string
  rootPath: string
  defaultScriptPath: string | null
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
  defaultScriptPath: string
}
