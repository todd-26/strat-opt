import { Settings as SettingsIcon } from 'lucide-react'

interface Props {
  ticker: string
  securities: string[]
  onTickerChange: (ticker: string) => void
  onOpenSettings: () => void
}

export function Header({ ticker, securities, onTickerChange, onOpenSettings }: Props) {
  return (
    <header
      className="flex items-center justify-between px-6 py-3 shadow"
      style={{ background: 'var(--bg-header)', color: 'var(--text-header)' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold tracking-tight">strat-opt</span>
        <select
          value={ticker}
          onChange={(e) => onTickerChange(e.target.value)}
          className="rounded px-2 py-1 text-sm font-medium"
          style={{
            background: 'var(--bg-input)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          {securities.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
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
