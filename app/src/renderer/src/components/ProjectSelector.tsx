import { useEffect, useState } from 'react'
import showMeHowIcon from '../assets/showmehow-icon.svg'
import type { ProjectImportResult, ProjectInput, ProjectRecord } from '../lib/projects'
import { badgeClass, buttonClass, inputClass } from '../lib/ui'

interface ProjectSelectorProps {
  projects: ProjectRecord[]
  pendingScriptPath: string | null
  onSelect: (projectId: number) => Promise<void>
  onCreate: (input: ProjectInput) => Promise<ProjectRecord>
  onImportFromParent: (parentPath: string) => Promise<ProjectImportResult>
  onUpdate: (projectId: number, input: ProjectInput) => Promise<void>
  onDelete: (projectId: number) => Promise<void>
}

const pageClass = 'flex h-full flex-col bg-[#17181b] text-[#eef1f4]'
const panelClass = 'rounded-md border border-[#34383e] bg-[#202327]'
const rowClass = 'rounded-md border border-[#34383e] bg-[#1b1e22]'
const fieldLabelClass = 'mb-1 block text-xs text-[#a7adb6]'
const helperTextClass = 'text-xs text-[#8b929c]'

function basename(input: string) {
  return input.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || input
}

function dirname(input: string) {
  const normalized = input.replace(/[\\/]+$/, '')
  const parts = normalized.split(/[\\/]/)
  parts.pop()
  return parts.join('/') || '/'
}

function createBlankProject(): ProjectInput {
  return {
    name: '',
    rootPath: ''
  }
}

export default function ProjectSelector({
  projects,
  pendingScriptPath,
  onSelect,
  onCreate,
  onImportFromParent,
  onUpdate,
  onDelete
}: ProjectSelectorProps) {
  const [newProject, setNewProject] = useState<ProjectInput>(createBlankProject())
  const [drafts, setDrafts] = useState<Record<number, ProjectInput>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setDrafts((existing) => {
      const next: Record<number, ProjectInput> = {}
      for (const project of projects) {
        next[project.id] = existing[project.id] || {
          name: project.name,
          rootPath: project.rootPath
        }
      }
      return next
    })
  }, [projects])

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

  async function handleCreate() {
    setBusyKey('create')
    setMessage('')
    try {
      const project = await onCreate(newProject)
      setNewProject(createBlankProject())
      await onSelect(project.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create project')
    } finally {
      setBusyKey(null)
    }
  }

  async function handleImportFromParent() {
    const parentPath = await window.smh.pickFolder()
    if (!parentPath) return

    setBusyKey('import')
    setMessage('')
    try {
      const result = await onImportFromParent(parentPath)
      const parts = [`Imported ${result.imported}`]
      if (result.skippedExisting) parts.push(`ignored ${result.skippedExisting} existing`)
      if (result.skippedInvalid) parts.push(`skipped ${result.skippedInvalid} invalid`)
      setMessage(parts.join(' · '))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to import projects')
    } finally {
      setBusyKey(null)
    }
  }

  if (pendingScriptPath) {
    return (
      <div className={pageClass}>
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-8">
          <header className="mb-6" data-dev-label="project-selector.brand">
            <div className="mb-3 flex items-center gap-3">
              <img src={showMeHowIcon} alt="ShowMeHow" className="h-11 w-11 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.35)]" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8b07e]">ShowMeHow</div>
                <h1 className="text-base font-semibold text-[#f4f6f8]">Choose project</h1>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-[#34383e] bg-[#202327] px-4 py-3">
              <div className="text-sm text-[#eef1f4]">{basename(pendingScriptPath)}</div>
              <div className="mt-1 text-xs text-[#8b929c]">{dirname(pendingScriptPath)}</div>
            </div>
          </header>

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <section className={`${panelClass} min-h-0 p-3`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[#f4f6f8]">Saved projects</div>
                  <div className={helperTextClass}>Choose the codebase this walkthrough should run against.</div>
                </div>
                <span className={badgeClass()}>{projects.length}</span>
              </div>

              <div className="space-y-2 overflow-auto">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    className="flex w-full items-center justify-between rounded-md border border-[#34383e] bg-[#1b1e22] px-3 py-3 text-left transition-colors hover:bg-[#22262b]"
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
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-[#f4f6f8]">{project.name}</span>
                        {project.gitRemoteSlug ? <span className={badgeClass()}>{project.gitRemoteSlug}</span> : null}
                      </div>
                      <div className="mt-1 truncate text-xs text-[#8b929c]">{project.rootPath}</div>
                    </div>
                    <span className="ml-4 shrink-0 text-[11px] text-[#b1b7c0]">Run</span>
                  </button>
                ))}

                {projects.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#34383e] bg-[#1b1e22] px-4 py-8 text-center text-sm text-[#8b929c]">
                    No projects yet.
                  </div>
                ) : null}
              </div>
            </section>

            <aside className={`${panelClass} p-4`}>
              <div className="mb-1 text-sm font-medium text-[#f4f6f8]">New project</div>
              <div className={`mb-4 ${helperTextClass}`}>Add one manually or import a parent folder of repos.</div>

              <div className="space-y-3">
                <div>
                  <label className={fieldLabelClass}>Name</label>
                  <input
                    className={inputClass()}
                    value={newProject.name}
                    onChange={(event) => setNewProject((state) => ({ ...state, name: event.target.value }))}
                    placeholder="EYJ"
                  />
                </div>

                <div>
                  <label className={fieldLabelClass}>Project root</label>
                  <div className="flex gap-2">
                    <input
                      className={inputClass()}
                      value={newProject.rootPath}
                      onChange={(event) => setNewProject((state) => ({ ...state, rootPath: event.target.value }))}
                      placeholder="/Users/spriggs/Documents/Projects/eyj"
                    />
                    <button className={buttonClass('ghost', 'sm')} onClick={() => void chooseNewFolder()}>
                      Browse…
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    className={buttonClass('primary')}
                    onClick={() => void handleCreate()}
                    disabled={busyKey === 'create' || !newProject.rootPath.trim()}
                  >
                    Add
                  </button>
                  <button className={buttonClass('secondary')} onClick={() => void handleImportFromParent()} disabled={busyKey === 'import'}>
                    Import…
                  </button>
                </div>
              </div>
            </aside>
          </div>

          {message ? <div className="mt-4 text-sm text-[#c9d1d9]">{message}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div className={pageClass}>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-5">
        <header className="mb-5 border-b border-[#34383e] pb-4" data-dev-label="project-selector.brand">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={showMeHowIcon} alt="ShowMeHow" className="h-11 w-11 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.35)]" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8b07e]">ShowMeHow</div>
                <h1 className="text-base font-semibold text-[#f4f6f8]">Projects</h1>
                <div className="mt-1 text-sm text-[#a7adb6]">Pick a codebase or import a set of repos.</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[#8b929c]">
              <span className="rounded-md border border-[#34383e] bg-[#202327] px-2 py-1">⌘K</span>
              <span>Quick switch</span>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[320px_1fr]">
          <section className={`${panelClass} p-4`}>
            <div className="mb-1 text-sm font-medium text-[#f4f6f8]">Add project</div>
            <div className={`mb-4 ${helperTextClass}`}>Store the project name and root folder only.</div>

            <div className="space-y-3">
              <div>
                <label className={fieldLabelClass}>Name</label>
                <input
                  className={inputClass()}
                  value={newProject.name}
                  onChange={(event) => setNewProject((state) => ({ ...state, name: event.target.value }))}
                  placeholder="EYJ"
                />
              </div>

              <div>
                <label className={fieldLabelClass}>Project root</label>
                <div className="flex gap-2">
                  <input
                    className={inputClass()}
                    value={newProject.rootPath}
                    onChange={(event) => setNewProject((state) => ({ ...state, rootPath: event.target.value }))}
                    placeholder="/Users/spriggs/Documents/Projects/eyj"
                  />
                  <button className={buttonClass('ghost', 'sm')} onClick={() => void chooseNewFolder()}>
                    Browse…
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  className={buttonClass('primary')}
                  onClick={() => void handleCreate()}
                  disabled={busyKey === 'create' || !newProject.rootPath.trim()}
                >
                  Add project
                </button>
                <button className={buttonClass('secondary')} onClick={() => void handleImportFromParent()} disabled={busyKey === 'import'}>
                  Import projects…
                </button>
              </div>
            </div>
          </section>

          <section className={`${panelClass} min-h-0 p-4`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[#f4f6f8]">Saved projects</div>
                <div className={helperTextClass}>Projects stay compact until you open their settings.</div>
              </div>
              <span className={badgeClass()}>{projects.length} saved</span>
            </div>

            <div className="space-y-3 overflow-auto">
              {projects.map((project) => {
                const draft = drafts[project.id] || {
                  name: project.name,
                  rootPath: project.rootPath
                }

                const expanded = expandedProjectId === project.id

                return (
                  <div key={project.id} className={rowClass}>
                    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-medium text-[#f4f6f8]">{project.name}</div>
                          {project.gitRemoteSlug ? <span className={badgeClass()}>{project.gitRemoteSlug}</span> : null}
                        </div>
                        <div className="mt-1 truncate text-xs text-[#8b929c]">{project.rootPath}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className={buttonClass('secondary', 'sm')}
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
                          Use
                        </button>
                        <button className={buttonClass('ghost', 'sm')} onClick={() => setExpandedProjectId(expanded ? null : project.id)}>
                          {expanded ? 'Close' : 'Edit'}
                        </button>
                        <button
                          className={buttonClass('danger', 'sm')}
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

                    {expanded ? (
                      <div className="border-t border-[#34383e] px-4 py-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className={fieldLabelClass}>Name</label>
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
                            <label className={fieldLabelClass}>Project root</label>
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
                              <button className={buttonClass('ghost', 'sm')} onClick={() => void chooseExistingFolder(project.id)}>
                                Browse…
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end">
                          <button
                            className={buttonClass('secondary', 'sm')}
                            disabled={busyKey === `save-${project.id}`}
                            onClick={async () => {
                              setBusyKey(`save-${project.id}`)
                              setMessage('')
                              try {
                                await onUpdate(project.id, draft)
                                setExpandedProjectId(null)
                              } catch (error) {
                                setMessage(error instanceof Error ? error.message : 'Failed to save project')
                              } finally {
                                setBusyKey(null)
                              }
                            }}
                          >
                            Save changes
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}

              {projects.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#34383e] bg-[#1b1e22] px-4 py-8 text-center text-sm text-[#8b929c]">
                  No projects yet. Add one to continue.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {message ? <div className="mt-4 text-sm text-[#c9d1d9]">{message}</div> : null}
      </div>
    </div>
  )
}
