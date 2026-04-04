import type { PrototypePanel } from '../store/appStore'

interface BrowserPanelProps {
  panel: PrototypePanel
}

export default function BrowserPanel({ panel }: BrowserPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-2 py-1 text-xs text-zinc-400">{panel.id} · browser (disabled)</div>
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Browser panels are disabled in this prototype.
      </div>
    </div>
  )
}
