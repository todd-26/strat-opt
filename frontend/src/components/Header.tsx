import { Settings as SettingsIcon, X } from 'lucide-react'

interface Props {
  ticker: string
  securities: string[]
  onTickerChange: (ticker: string) => void
  onOpenSettings: () => void
  startDate: string
  endDate: string
  onStartDateChange: (v: string) => void
  onEndDateChange: (v: string) => void
  dateRange?: { min: string; max: string } | null
}

const inputStyle = {
  background: 'var(--bg-input)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
}

export function Header({ ticker, securities, onTickerChange, onOpenSettings, startDate, endDate, onStartDateChange, onEndDateChange, dateRange }: Props) {
  const hasCustomDates = startDate !== '' || endDate !== ''

  function clearDates() {
    onStartDateChange('')
    onEndDateChange('')
  }

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
          <DateInput
            value={startDate}
            placeholder={dateRange?.min}
            onChange={onStartDateChange}
          />
        </label>
        <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          To
          <DateInput
            value={endDate}
            placeholder={dateRange?.max}
            onChange={onEndDateChange}
          />
        </label>
        {hasCustomDates && (
          <button
            onClick={clearDates}
            className="rounded p-1 transition-opacity hover:opacity-70"
            title="Clear date filter"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        )}
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

function DateInput({ value, placeholder, onChange }: { value: string; placeholder?: string; onChange: (v: string) => void }) {
  // When empty, show the data-range placeholder as a text overlay
  // The native date input sits behind it; clicking focuses the real input
  const empty = value === ''
  return (
    <span className="relative inline-block">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded px-2 py-1 text-sm"
        style={{
          ...inputStyle,
          ...(empty && placeholder ? { color: 'transparent' } : {}),
        }}
      />
      {empty && placeholder && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center px-2 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          {placeholder}
        </span>
      )}
    </span>
  )
}
