import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('smh', {
  pickFile: (projectRootPath?: string | null) => ipcRenderer.invoke('dialog:pickFile', projectRootPath),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  readTextFile: (filePath: string, projectRootPath?: string | null) =>
    ipcRenderer.invoke('fs:readTextFile', filePath, projectRootPath),
  fileExists: (filePath: string, projectRootPath?: string | null) =>
    ipcRenderer.invoke('fs:fileExists', filePath, projectRootPath),
  resolvePath: (filePath: string, projectRootPath?: string | null) =>
    ipcRenderer.invoke('fs:resolvePath', filePath, projectRootPath),
  getConfig: () => ipcRenderer.invoke('app:getConfig'),
  synthesizeSpeechToFile: (text: string, options?: { voice?: string | null; rate?: number | null }) =>
    ipcRenderer.invoke('tts:synthesizeToFile', text, options),
  getBootState: () => ipcRenderer.invoke('projects:getBootState'),
  createProject: (input: { name: string; rootPath: string; defaultScriptPath?: string | null }) =>
    ipcRenderer.invoke('projects:create', input),
  updateProject: (projectId: number, input: { name: string; rootPath: string; defaultScriptPath?: string | null }) =>
    ipcRenderer.invoke('projects:update', projectId, input),
  deleteProject: (projectId: number) => ipcRenderer.invoke('projects:delete', projectId),
  setCurrentProject: (projectId: number) => ipcRenderer.invoke('projects:setCurrent', projectId),
  clearPendingScript: () => ipcRenderer.invoke('app:clearPendingScript'),
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
