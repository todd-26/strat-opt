import { Settings as SettingsIcon } from 'lucide-react'

interface Props {
  ticker: string
  securities: string[]
  onTickerChange: (ticker: string) => void
  onOpenSettings: () => void
  startDate: string
  endDate: string
  onStartDateChange: (v: string) => void
  onEndDateChange: (v: string) => void
}

const inputStyle = {
  background: 'var(--bg-input)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
}

export function Header({ ticker, securities, onTickerChange, onOpenSettings, startDate, endDate, onStartDateChange, onEndDateChange }: Props) {
  return (
    <header
      className="flex items-center justify-between px-6 py-3 shadow"
      style={{ background: 'var(--bg-header)', color: 'var(--text-header)' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold tracking-tight">QuantEdge</span>
        <select
          value={ticker}
          onChange={(e) => onTickerChange(e.target.value)}
          className="rounded px-2 py-1 text-sm font-medium"
          style={inputStyle}
        >
          {securities.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          From
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="rounded px-2 py-1 text-sm"
            style={inputStyle}
          />
        </label>
        <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          To
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="rounded px-2 py-1 text-sm"
            style={inputStyle}
          />
        </label>
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
