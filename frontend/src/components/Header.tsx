import { useState } from 'react'
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

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
}

export function Header({ ticker, securities, onTickerChange, onOpenSettings, startDate, endDate, onStartDateChange, onEndDateChange, dateRange }: Props) {
  const [error, setError] = useState('')
  const hasCustomDates = startDate !== '' || endDate !== ''

  function validate(newStart: string, newEnd: string): boolean {
    const effStart = newStart || dateRange?.min || ''
    const effEnd = newEnd || dateRange?.max || ''
    if (newStart && dateRange?.min && newStart < dateRange.min) {
      setError(`Start date ${newStart} is before the earliest available data (${dateRange.min}). Date cleared.`)
      onStartDateChange('')
      return false
    }
    if (newEnd && dateRange?.max && newEnd > dateRange.max) {
      setError(`End date ${newEnd} is after the latest available data (${dateRange.max}). Date cleared.`)
      onEndDateChange('')
      return false
    }
    if (effStart && effEnd && effEnd < effStart) {
      setError(`End date (${effEnd}) cannot be before start date (${effStart}). End date cleared.`)
      onEndDateChange('')
      return false
    }
    return true
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

        <DateField
          label="From"
          value={startDate}
          defaultValue={dateRange?.min}
          min={dateRange?.min}
          max={dateRange?.max}
          onChange={onStartDateChange}
          onClear={() => onStartDateChange('')}
          onBlur={() => validate(startDate, endDate)}
        />
        <DateField
          label="To"
          value={endDate}
          defaultValue={dateRange?.max}
          min={dateRange?.min}
          max={dateRange?.max}
          onChange={onEndDateChange}
          onClear={() => onEndDateChange('')}
          onBlur={() => validate(startDate, endDate)}
        />

        {hasCustomDates && (
          <button
            onClick={() => { onStartDateChange(''); onEndDateChange('') }}
            className="rounded p-1 transition-opacity hover:opacity-70"
            title="Reset to full date range"
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

      {error && (
        <div
          className="flex items-center gap-3 rounded border px-4 py-3 shadow-lg"
          style={{
            position: 'fixed',
            top: '4.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'var(--bg-card)',
            borderColor: 'var(--sell)',
            maxWidth: '440px',
          }}
        >
          <span className="text-sm" style={{ color: 'var(--text)' }}>{error}</span>
          <button onClick={() => setError('')} className="flex-shrink-0 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>
      )}
    </header>
  )
}

interface DateFieldProps {
  label: string
  value: string
  defaultValue?: string
  min?: string
  max?: string
  onChange: (v: string) => void
  onClear: () => void
  onBlur: () => void
}

function DateField({ label, value, defaultValue, min, max, onChange, onClear, onBlur }: DateFieldProps) {
  const displayValue = value || defaultValue || ''

  return (
    <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
      {label}
      <input
        type="date"
        value={displayValue}
        onChange={(e) => { if (e.target.value) onChange(e.target.value) }}
        onBlur={onBlur}
        className="rounded px-2 py-1 text-sm"
        style={inputStyle}
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="rounded p-0.5 hover:opacity-70"
          title="Clear date"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={12} />
        </button>
      )}
    </label>
  )
}
