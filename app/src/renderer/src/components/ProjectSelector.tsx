import { useEffect, useMemo, useState } from 'react'
import type { ProjectInput, ProjectRecord } from '../lib/projects'

interface ProjectSelectorProps {
  projects: ProjectRecord[]
  currentProjectId: number | null
  pendingScriptPath: string | null
  canClose: boolean
  onClose: () => void
  onSelect: (projectId: number) => Promise<void>
  onCreate: (input: ProjectInput) => Promise<void>
  onUpdate: (projectId: number, input: ProjectInput) => Promise<void>
  onDelete: (projectId: number) => Promise<void>
}

function inputClass() {
  return 'w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none'
}

function buttonClass() {
  return 'rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50'
}

function basename(input: string) {
  return input.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || input
}

function relativePath(filePath: string, rootPath: string) {
  const normalizedRoot = rootPath.endsWith('/') ? rootPath : `${rootPath}/`
  return filePath.startsWith(normalizedRoot) ? filePath.slice(normalizedRoot.length) : filePath
}

function createBlankProject(): ProjectInput {
  return {
    name: '',
    rootPath: '',
    defaultScriptPath: ''
  }
}

export default function ProjectSelector({
  projects,
  currentProjectId,
  pendingScriptPath,
  canClose,
  onClose,
  onSelect,
  onCreate,
  onUpdate,
  onDelete
}: ProjectSelectorProps) {
  const [newProject, setNewProject] = useState<ProjectInput>(createBlankProject())
  const [drafts, setDrafts] = useState<Record<number, ProjectInput>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    setDrafts((existing) => {
      const next: Record<number, ProjectInput> = {}
      for (const project of projects) {
        next[project.id] = existing[project.id] || {
          name: project.name,
          rootPath: project.rootPath,
          defaultScriptPath: project.defaultScriptPath || ''
        }
      }
      return next
    })
  }, [projects])

  const currentProject = useMemo(
    () => projects.find((project) => project.id === currentProjectId) || null,
    [projects, currentProjectId]
  )

  async function chooseNewFolder() {
    const folder = await window.smh.pickFolder()
    if (!folder) return

    setNewProject((state) => ({
      ...state,
      name: state.name || basename(folder),
      rootPath: folder
    }))
  }

  async function chooseExistingFolder(projectId: number) {
    const folder = await window.smh.pickFolder()
    if (!folder) return

    setDrafts((state) => ({
      ...state,
      [projectId]: {
        ...(state[projectId] || createBlankProject()),
        name: state[projectId]?.name || basename(folder),
        rootPath: folder
      }
    }))
  }

  async function chooseNewDefaultScript() {
    if (!newProject.rootPath.trim()) {
      setMessage('Choose the project root first so the default script can be stored as a relative path.')
      return
    }

    const filePath = await window.smh.pickFile(newProject.rootPath)
    if (!filePath) return

    setNewProject((state) => ({
      ...state,
      defaultScriptPath: relativePath(filePath, state.rootPath)
    }))
  }

  async function chooseExistingDefaultScript(projectId: number) {
    const draft = drafts[projectId]
    if (!draft?.rootPath.trim()) {
      setMessage('Choose the project root first so the default script can be stored as a relative path.')
      return
    }

    const filePath = await window.smh.pickFile(draft.rootPath)
    if (!filePath) return

    setDrafts((state) => ({
      ...state,
      [projectId]: {
        ...draft,
        defaultScriptPath: relativePath(filePath, draft.rootPath)
      }
    }))
  }

  async function handleCreate() {
    setBusyKey('create')
    setMessage('')
    try {
      await onCreate(newProject)
      setNewProject(createBlankProject())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create project')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8">
        <div className="mb-8 border-b border-zinc-800 pb-6">
          <div className="text-center">
            <div className="text-3xl font-semibold tracking-[0.2em] text-white">SHOW ME HOW</div>
            <div className="mt-2 text-sm text-zinc-400">Project selector for code walkthroughs</div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">
            <div>
              <div>Current project: {currentProject ? currentProject.name : 'none selected'}</div>
              <div className="text-xs text-zinc-500">Choose a project root before running a walkthrough.</div>
            </div>
            {canClose ? (
              <button className={buttonClass()} onClick={onClose}>
                Back to app
              </button>
            ) : null}
          </div>

          {pendingScriptPath ? (
            <div className="mt-4 rounded border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
              Opened presentation: <span className="font-mono text-xs">{pendingScriptPath}</span>
              <div className="mt-1 text-xs text-amber-300/80">Choose the project this script should run against.</div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-4 text-sm font-medium text-white">Add project</div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs text-zinc-400">Name</div>
                <input
                  className={inputClass()}
                  value={newProject.name}
                  onChange={(event) => setNewProject((state) => ({ ...state, name: event.target.value }))}
                  placeholder="eyj"
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-zinc-400">Project root</div>
                <div className="flex gap-2">
                  <input
                    className={inputClass()}
                    value={newProject.rootPath}
                    onChange={(event) => setNewProject((state) => ({ ...state, rootPath: event.target.value }))}
                    placeholder="/Users/spriggs/Documents/Projects/eyj"
                  />
                  <button className={buttonClass()} onClick={() => void chooseNewFolder()}>
                    Choose
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-zinc-400">Default .smh script</div>
                <div className="flex gap-2">
                  <input
                    className={inputClass()}
                    value={newProject.defaultScriptPath}
                    onChange={(event) => setNewProject((state) => ({ ...state, defaultScriptPath: event.target.value }))}
                    placeholder="demo.smh"
                  />
                  <button className={buttonClass()} onClick={() => void chooseNewDefaultScript()}>
                    Choose
                  </button>
                </div>
              </div>
              <button
                className={buttonClass()}
                onClick={() => void handleCreate()}
                disabled={busyKey === 'create' || !newProject.rootPath.trim()}
              >
                Add project
              </button>
            </div>
          </section>

          <section className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">Saved projects</div>
              <div className="text-xs text-zinc-500">Edit settings, remove projects, or choose one to run</div>
            </div>

            <div className="space-y-4">
              {projects.map((project) => {
                const draft = drafts[project.id] || {
                  name: project.name,
                  rootPath: project.rootPath,
                  defaultScriptPath: project.defaultScriptPath || ''
                }

                return (
                  <div key={project.id} className="rounded border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm text-white">{project.name}</div>
                        <div className="text-xs text-zinc-500">{project.id === currentProjectId ? 'current project' : 'saved project'}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className={buttonClass()}
                          disabled={busyKey === `open-${project.id}`}
                          onClick={async () => {
                            setBusyKey(`open-${project.id}`)
                            setMessage('')
                            try {
                              await onSelect(project.id)
                            } catch (error) {
                              setMessage(error instanceof Error ? error.message : 'Failed to open project')
                            } finally {
                              setBusyKey(null)
                            }
                          }}
                        >
                          {pendingScriptPath ? 'Run with this project' : 'Open'}
                        </button>
                        <button
                          className={buttonClass()}
                          disabled={busyKey === `delete-${project.id}`}
                          onClick={async () => {
                            setBusyKey(`delete-${project.id}`)
                            setMessage('')
                            try {
                              await onDelete(project.id)
                            } catch (error) {
                              setMessage(error instanceof Error ? error.message : 'Failed to delete project')
                            } finally {
                              setBusyKey(null)
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs text-zinc-400">Name</div>
                        <input
                          className={inputClass()}
                          value={draft.name}
                          onChange={(event) =>
                            setDrafts((state) => ({
                              ...state,
                              [project.id]: { ...draft, name: event.target.value }
                            }))
                          }
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-zinc-400">Project root</div>
                        <div className="flex gap-2">
                          <input
                            className={inputClass()}
                            value={draft.rootPath}
                            onChange={(event) =>
                              setDrafts((state) => ({
                                ...state,
                                [project.id]: { ...draft, rootPath: event.target.value }
                              }))
                            }
                          />
                          <button className={buttonClass()} onClick={() => void chooseExistingFolder(project.id)}>
                            Choose
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 text-xs text-zinc-400">Default .smh script</div>
                      <div className="flex gap-2">
                        <input
                          className={inputClass()}
                          value={draft.defaultScriptPath}
                          onChange={(event) =>
                            setDrafts((state) => ({
                              ...state,
                              [project.id]: { ...draft, defaultScriptPath: event.target.value }
                            }))
                          }
                        />
                        <button className={buttonClass()} onClick={() => void chooseExistingDefaultScript(project.id)}>
                          Choose
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <button
                        className={buttonClass()}
                        disabled={busyKey === `save-${project.id}`}
                        onClick={async () => {
                          setBusyKey(`save-${project.id}`)
                          setMessage('')
                          try {
                            await onUpdate(project.id, draft)
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : 'Failed to save project')
                          } finally {
                            setBusyKey(null)
                          }
                        }}
                      >
                        Save settings
                      </button>
                    </div>
                  </div>
                )
              })}

              {projects.length === 0 ? (
                <div className="rounded border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                  No projects yet. Add one on the left.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {message ? <div className="mt-4 text-sm text-amber-300">{message}</div> : null}
      </div>
    </div>
  )
}
