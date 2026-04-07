import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('smh', {
  pickFile: (projectRootPath?: string | null) => ipcRenderer.invoke('dialog:pickFile', projectRootPath),
  pickPresentationFile: (projectRootPath?: string | null) => ipcRenderer.invoke('dialog:pickPresentationFile', projectRootPath),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  readTextFile: (filePath: string, projectRootPath?: string | null) =>
    ipcRenderer.invoke('fs:readTextFile', filePath, projectRootPath),
  fileExists: (filePath: string, projectRootPath?: string | null) =>
    ipcRenderer.invoke('fs:fileExists', filePath, projectRootPath),
  resolvePath: (filePath: string, projectRootPath?: string | null) =>
    ipcRenderer.invoke('fs:resolvePath', filePath, projectRootPath),
  synthesizeSpeechToFile: (text: string, options?: { voice?: string | null; rate?: number | null }) =>
    ipcRenderer.invoke('tts:synthesizeToFile', text, options),
  primeTtsCache: (requests: Array<{ text: string; voice?: string | null; rate?: number | null }>) =>
    ipcRenderer.invoke('tts:primeCache', requests),
  getBootState: () => ipcRenderer.invoke('projects:getBootState'),
  createProject: (input: { name: string; rootPath: string }) => ipcRenderer.invoke('projects:create', input),
  updateProject: (projectId: number, input: { name: string; rootPath: string }) =>
    ipcRenderer.invoke('projects:update', projectId, input),
  importProjectsFromParent: (parentPath: string) => ipcRenderer.invoke('projects:importFromParent', parentPath),
  deleteProject: (projectId: number) => ipcRenderer.invoke('projects:delete', projectId),
  setCurrentProject: (projectId: number) => ipcRenderer.invoke('projects:setCurrent', projectId),
  clearCurrentProject: () => ipcRenderer.invoke('projects:clearCurrent'),
  getRecentPresentationPaths: () => ipcRenderer.invoke('app:getRecentPresentationPaths'),
  rememberRecentPresentationPath: (filePath: string, projectId?: number | null) =>
    ipcRenderer.invoke('app:rememberRecentPresentationPath', filePath, projectId),
  clearPendingScript: () => ipcRenderer.invoke('app:clearPendingScript'),
  openPath: (filePath: string, projectRootPath?: string | null) => ipcRenderer.invoke('app:openPath', filePath, projectRootPath),
  onExternalScriptOpened: (callback: (scriptPath: string) => void) => {
    const listener = (_event: unknown, scriptPath: string) => callback(scriptPath)
    ipcRenderer.on('app:externalScriptOpened', listener)
    return () => ipcRenderer.removeListener('app:externalScriptOpened', listener)
  },
  onControlCommand: (callback: (payload: { id: string; command: Record<string, unknown> }) => void) => {
    const listener = (_event: unknown, payload: { id: string; command: Record<string, unknown> }) => callback(payload)
    ipcRenderer.on('control:command', listener)
    return () => ipcRenderer.removeListener('control:command', listener)
  },
  respondToControlCommand: (payload: { id: string; ok: boolean; result?: unknown; error?: string }) => {
    ipcRenderer.send('control:response', payload)
  }
})
