import { useState } from 'react'
import { useBuyHold } from '../../hooks/useBuyHold'
import { EquityCurveChart } from '../EquityCurveChart'
import { MetricsCard } from '../MetricsCard'
import type { Settings } from '../../types'

interface Props {
  settings: Settings
  ticker: string
}

export function BuyHoldTab({ settings, ticker }: Props) {
  const { result, loading, error, run } = useBuyHold()
  const [cashRate, setCashRate] = useState(settings.cashRate)
  const [inputType, setInputType] = useState(settings.inputType)

  function handleRun() {
    run(ticker, cashRate, inputType)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
      >
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Cash Rate (annual)
            </label>
            <input
              type="number"
              value={cashRate}
              step="0.01"
              onChange={(e) => setCashRate(parseFloat(e.target.value) || 0)}
              className="w-28 rounded border px-2 py-1.5 text-sm"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Data Source
            </label>
            <select
              value={inputType}
              onChange={(e) => setInputType(e.target.value as 'csv' | 'api')}
              className="rounded border px-2 py-1.5 text-sm"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            >
              <option value="csv">CSV</option>
              <option value="api">Live API</option>
            </select>
          </div>

          <button
            onClick={handleRun}
            disabled={loading}
            className="rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            {loading ? 'Running…' : 'Run Buy & Hold'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--sell)', background: '#fee2e2', color: '#991b1b' }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          <MetricsCard apy={result.apy} finalValue={result.final_value} />
          <div
            className="rounded-lg border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
          >
            <h3 className="mb-3 font-semibold" style={{ color: 'var(--text)' }}>
              Equity Curve
            </h3>
            <EquityCurveChart
              equityCurve={result.equity_curve}
              id="buyhold-chart"
            />
          </div>
        </>
      )}
    </div>
  )
}
