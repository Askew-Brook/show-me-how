import { useAppStore } from '../store/appStore'

export function registerRemoteControl(setPresentationMode: (value: boolean) => void) {
  return window.smh.onControlCommand((payload) => {
    void handleRemoteCommand(payload, setPresentationMode)
  })
}

async function handleRemoteCommand(
  payload: { id: string; command: Record<string, unknown> },
  setPresentationMode: (value: boolean) => void
) {
  try {
    const result = await executeRemoteCommand(payload.command, setPresentationMode)
    window.smh.respondToControlCommand({ id: payload.id, ok: true, result })
  } catch (error) {
    window.smh.respondToControlCommand({
      id: payload.id,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown remote control error'
    })
  }
}

async function executeRemoteCommand(command: Record<string, unknown>, setPresentationMode: (value: boolean) => void) {
  const store = useAppStore.getState()
  const type = String(command.type || '')

  switch (type) {
    case 'ping':
      return { ok: true }

    case 'get-state': {
      const currentProject = store.projects.find((project) => project.id === store.currentProjectId) || null
      const currentAction = store.actions[store.currentActionIndex] || null
      return {
        projectSelectorOpen: store.projectSelectorOpen,
        currentProject,
        status: store.status,
        meta: store.meta,
        currentActionIndex: store.currentActionIndex,
        currentAction,
        diagnostics: store.diagnostics,
        logs: store.logs.slice(-20),
        actionCount: store.actions.length,
        panelIds: store.panelOrder
      }
    }

    case 'get-script':
      return {
        script: store.script,
        scriptPath: store.scriptPath,
        currentProjectId: store.currentProjectId
      }

    case 'set-script': {
      const script = String(command.script ?? '')
      store.setScript(script)
      setPresentationMode(false)
      return {
        scriptLength: script.length
      }
    }

    case 'load-sample':
      store.loadSample()
      setPresentationMode(false)
      return { ok: true }

    case 'open-project': {
      const projectId = command.projectId == null ? null : Number(command.projectId)
      const projectName = command.projectName == null ? null : String(command.projectName)

      let targetId = projectId
      if (targetId == null && projectName) {
        const project = store.projects.find((entry) => entry.name.toLowerCase() === projectName.toLowerCase())
        targetId = project?.id ?? null
      }

      if (targetId == null) {
        throw new Error('Missing projectId or projectName')
      }

      await store.chooseProject(targetId)
      setPresentationMode(false)
      return {
        currentProjectId: useAppStore.getState().currentProjectId
      }
    }

    case 'validate': {
      const valid = await store.validate()
      return {
        valid,
        diagnostics: useAppStore.getState().diagnostics
      }
    }

    case 'play':
      setPresentationMode(true)
      await store.play()
      return { status: useAppStore.getState().status }

    case 'pause':
      store.pause()
      return { status: useAppStore.getState().status }

    case 'resume':
      setPresentationMode(true)
      store.resume()
      return { status: useAppStore.getState().status }

    case 'restart':
      setPresentationMode(true)
      await store.restart()
      return { status: useAppStore.getState().status }

    case 'stop':
      store.stop()
      return { status: useAppStore.getState().status }

    case 'next-step':
      setPresentationMode(true)
      await store.nextStep()
      return { status: useAppStore.getState().status }

    default:
      throw new Error(`Unsupported remote command: ${type}`)
  }
}
