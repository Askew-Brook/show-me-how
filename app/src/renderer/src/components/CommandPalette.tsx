import { useEffect, useMemo, useState } from 'react'

export type PaletteItem = {
  id: string
  title: string
  subtitle?: string
  hint?: string
  section?: string
  keywords?: string[]
  symbol?: string
  onSelect: () => void | Promise<void>
}

interface CommandPaletteProps {
  open: boolean
  items: PaletteItem[]
  onClose: () => void
}

function matches(item: PaletteItem, query: string) {
  if (!query) return true
  const haystack = [item.title, item.subtitle || '', item.hint || '', item.section || '', ...(item.keywords || [])].join(' ').toLowerCase()
  return haystack.includes(query.toLowerCase())
}

function groupItems(items: PaletteItem[]) {
  const groups = new Map<string, PaletteItem[]>()

  for (const item of items) {
    const key = item.section || 'Other'
    const group = groups.get(key) || []
    group.push(item)
    groups.set(key, group)
  }

  return Array.from(groups.entries())
}

export default function CommandPalette({ open, items, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const filteredItems = useMemo(() => items.filter((item) => matches(item, query)), [items, query])
  const groupedItems = useMemo(() => groupItems(filteredItems), [filteredItems])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
      return
    }

    setActiveIndex(0)
  }, [open, query])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((value) => Math.min(value + 1, Math.max(filteredItems.length - 1, 0)))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((value) => Math.max(value - 1, 0))
        return
      }

      if (event.key === 'Enter') {
        const item = filteredItems[activeIndex]
        if (!item) return
        event.preventDefault()
        void Promise.resolve(item.onSelect()).finally(() => onClose())
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, filteredItems, onClose, open])

  if (!open) return null

  let runningIndex = -1

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-[12vh]" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-md border border-[#34383e] bg-[#202327] shadow-2xl shadow-black/30"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#34383e] px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-[#8b929c]">⌘K</div>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects, scripts, and actions"
              className="w-full bg-transparent text-sm text-[#eef1f4] outline-none placeholder:text-[#7f8791]"
            />
          </div>
        </div>

        <div className="max-h-[440px] overflow-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="px-2 py-8 text-center text-sm text-[#8b929c]">No matches.</div>
          ) : (
            <div className="space-y-3">
              {groupedItems.map(([section, sectionItems]) => (
                <section key={section}>
                  <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#8b929c]">{section}</div>
                  <div className="space-y-1">
                    {sectionItems.map((item) => {
                      runningIndex += 1
                      const active = runningIndex === activeIndex

                      return (
                        <button
                          key={item.id}
                          onClick={() => void Promise.resolve(item.onSelect()).finally(() => onClose())}
                          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                            active ? 'bg-[#2b3036] text-[#f4f6f8]' : 'text-[#d7dde3] hover:bg-[#25292e]'
                          }`}
                        >
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                              active
                                ? 'border-[#4a5058] bg-[#2f343a] text-[#eef1f4]'
                                : 'border-[#34383e] bg-[#1a1d21] text-[#8b929c]'
                            }`}
                          >
                            {item.symbol || '•'}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">{item.title}</div>
                            {item.subtitle ? <div className="truncate text-[11px] text-[#8b929c]">{item.subtitle}</div> : null}
                          </div>

                          {item.hint ? <div className="ml-4 shrink-0 text-[10px] text-[#8b929c]">{item.hint}</div> : null}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#34383e] bg-[#1a1d21] px-3 py-2 text-[10px] text-[#8b929c]">
          <div className="flex items-center gap-3">
            <span>↵ Open</span>
            <span>↑↓ Move</span>
            <span>Esc Close</span>
          </div>
          <div>{filteredItems.length} results</div>
        </div>
      </div>
    </div>
  )
}
