import { useState } from 'react'
import { useSignal } from '../../hooks/useSignal'
import { ParameterPanel } from '../ParameterPanel'
import { SignalBadge } from '../SignalBadge'
import { TradeHistoryTable } from '../TradeHistoryTable'
import { MetricsCard } from '../MetricsCard'
import type { Settings, StrategyParams } from '../../types'

interface Props {
  settings: Settings
  ticker: string
  defaultParams: StrategyParams
  paramDescriptions?: Partial<Record<keyof StrategyParams, string>>
}

function fmt(v: number | null | undefined, decimals = 4): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(decimals)
}

export function SignalTab({ settings, ticker, defaultParams, paramDescriptions }: Props) {
  const { result, loading, error, run } = useSignal()
  const [params, setParams] = useState<StrategyParams>(defaultParams)
  const [startInvested, setStartInvested] = useState(settings.startInvested)
  const [cashRate, setCashRate] = useState(settings.cashRate)
  const [inputType, setInputType] = useState(settings.inputType)
  const [collapsed, setCollapsed] = useState(false)

  function handleRun() {
    run(ticker, params, startInvested, cashRate, inputType)
    setCollapsed(true)
  }

  return (
    <div className="space-y-4">
      {/* Parameter panel */}
      <ParameterPanel
        mode="single"
        params={params}
        onChange={setParams}
        collapsed={collapsed}
        descriptions={paramDescriptions}
      />

      {/* Options row */}
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
              step="0.0025"
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
              Starting Position
            </label>
            <select
              value={startInvested}
              onChange={(e) => setStartInvested(Number(e.target.value) as 0 | 1)}
              className="rounded border px-2 py-1.5 text-sm"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            >
              <option value={1}>Invested</option>
              <option value={0}>Cash</option>
            </select>
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
            {loading ? 'Running…' : 'Get Current Signal'}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Signal + metrics */}
            <div className="space-y-3">
              <SignalBadge signal={result.signal} />
              <div
                className="rounded-lg border p-4"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
              >
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Current Metrics
                </h3>
                <dl className="space-y-1.5 text-sm">
                  <MetricRow label="As of" value={result.metrics.last_date} />
                  <MetricRow label="Close" value={`$${fmt(result.metrics.close, 2)}`} />
                  <MetricRow label="MA" value={fmt(result.metrics.ma, 2)} />
                  <MetricRow label="Spread" value={fmt(result.metrics.spread, 2)} />
                  <MetricRow label="chg4" value={fmt(result.metrics.chg4, 4)} />
                  <MetricRow label="ret3" value={fmt(result.metrics.ret3, 4)} />
                  <MetricRow label="Δspread" value={fmt(result.metrics.spread_delta, 4)} />
                </dl>
              </div>
              <MetricsCard apy={result.apy} finalValue={result.final_value} />
            </div>

            {/* Trade history */}
            <div>
              <h3 className="mb-2 font-semibold" style={{ color: 'var(--text)' }}>
                Trade History
              </h3>
              <TradeHistoryTable trades={result.trade_history} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="font-medium" style={{ color: 'var(--text)' }}>
        {value}
      </dd>
    </div>
  )
}
