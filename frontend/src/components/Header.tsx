import { Settings as SettingsIcon } from 'lucide-react'

interface Props {
  ticker: string
  onOpenSettings: () => void
}

export function Header({ ticker, onOpenSettings }: Props) {
  return (
    <header
      className="flex items-center justify-between px-6 py-3 shadow"
      style={{ background: 'var(--bg-header)', color: 'var(--text-header)' }}
    >
      <div>
        <span className="text-lg font-bold tracking-tight">strat-opt</span>
        <span className="ml-2 text-sm opacity-70">— {ticker}</span>
      </div>
      <button
        onClick={onOpenSettings}
        className="rounded p-1.5 transition-opacity hover:opacity-70"
        aria-label="Settings"
      >
        <SettingsIcon size={20} />
      </button>
    </header>
  )
}
