import type { PrototypePanel } from '../store/appStore'

interface BrowserPanelProps {
  panel: PrototypePanel
}

export default function BrowserPanel({ panel }: BrowserPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#1b1e22]">
      <div className="border-b border-[#34383e] px-3 py-2 text-xs text-[#c9d0d7]">{panel.id} · browser (disabled)</div>
      <div className="flex h-full items-center justify-center text-sm text-[#8b929c]">Browser panels are disabled in this prototype.</div>
    </div>
  )
}
