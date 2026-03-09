import { useState, useEffect } from 'react'
import { useSignal } from '../../hooks/useSignal'
import { ParameterPanel } from '../ParameterPanel'
import { SignalBadge } from '../SignalBadge'
import { TradeHistoryTable } from '../TradeHistoryTable'
import { MetricsCard } from '../MetricsCard'
import { NumInput } from '../NumInput'
import type { Settings, StrategyParams } from '../../types'

interface Props {
  settings: Settings
  ticker: string
  defaultParams: StrategyParams
  paramDescriptions?: Partial<Record<keyof StrategyParams, string>>
  cashRate: number
  startInvested: 0 | 1
  startDate?: string
  endDate?: string
  defaultDisabledFactors?: string[]
}

function fmt(v: number | null | undefined, decimals = 4): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(decimals)
}

export function SignalTab({ settings, ticker, defaultParams, paramDescriptions, cashRate: cashRateProp, startInvested: startInvestedProp, startDate, endDate, defaultDisabledFactors }: Props) {
  const { result, loading, error, run } = useSignal()
  const [params, setParams] = useState<StrategyParams>(defaultParams)
  const [startInvested, setStartInvested] = useState<0 | 1>(startInvestedProp)
  const [cashRate, setCashRate] = useState(cashRateProp)
  const [inputType, setInputType] = useState(settings.inputType)

  useEffect(() => {
    setCashRate(cashRateProp)
    setStartInvested(startInvestedProp)
  }, [cashRateProp, startInvestedProp])
  const [collapsed, setCollapsed] = useState(false)
  const [disabledFactors, setDisabledFactors] = useState<Set<string>>(new Set(defaultDisabledFactors ?? []))
  function toggleFactor(f: string) {
    setDisabledFactors(prev => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n })
  }

  function handleRun() {
    run(ticker, params, startInvested, cashRate, inputType, startDate, endDate, disabledFactors.size ? [...disabledFactors] : undefined)
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
        disabledFactors={disabledFactors}
        onToggleFactor={toggleFactor}
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
            <NumInput
              value={cashRate}
              step="0.0025"
              onChange={setCashRate}
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

          {result && (
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Date Range Used
              </label>
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {result.data_start} – {result.data_end}
              </span>
            </div>
          )}

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
          {/* Signal + metrics row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <MetricRow label="10yr chg4" value={fmt(result.metrics.yield10_chg4, 4)} />
                  <MetricRow label="2yr chg4" value={fmt(result.metrics.yield2_chg4, 4)} />
                  <MetricRow label="Curve chg4" value={fmt(result.metrics.curve_chg4, 4)} />
                  <MetricRow label="Δyield10" value={fmt(result.metrics.yield10_delta, 4)} />
                </dl>
              </div>
              <MetricsCard apy={result.apy} finalValue={result.final_value} />
            </div>

            {/* Factor values panel */}
            <div
              className="rounded-lg border p-4 self-start"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
            >
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Factor Values
              </h3>

              <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sell — trigger if ANY true</div>
              <dl className="mb-4 space-y-1.5 text-sm">
                <ThresholdRow label="Spread"    value={result.metrics.spread}       disabled={disabledFactors.has('SPREAD_LVL')} />
                <ThresholdRow label="chg4"      value={result.metrics.chg4}          disabled={disabledFactors.has('CHG4')} pct />
                <ThresholdRow label="ret3"      value={result.metrics.ret3}          disabled={disabledFactors.has('RET3')} pct />
                <ThresholdRow label="10yr chg4" value={result.metrics.yield10_chg4}  disabled={disabledFactors.has('YIELD10_CHG4')} pct />
                <ThresholdRow label="2yr chg4"  value={result.metrics.yield2_chg4}   disabled={disabledFactors.has('YIELD2_CHG4')} pct />
                <ThresholdRow label="ΔCurve"    value={result.metrics.curve_chg4}    disabled={disabledFactors.has('CURVE_CHG4')} />
              </dl>

              <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Buy — ALL must be true</div>
              <dl className="space-y-1.5 text-sm">
                <ThresholdRow label="Close"    value={result.metrics.close}        disabled={disabledFactors.has('MA')} />
                <ThresholdRow label="MA"       value={result.metrics.ma}           disabled={disabledFactors.has('MA')} />
                <ThresholdRow label="4wk Spread Peak" value={result.metrics.spread_4wk_peak} disabled={disabledFactors.has('DROP')} />
                <ThresholdRow label="Drop"            value={result.metrics.spread_drop}    disabled={disabledFactors.has('DROP')} pct />
                <ThresholdRow label="Δspread"         value={result.metrics.spread_delta}   history={result.metrics.spread_delta_history} disabled={disabledFactors.has('SPREAD_DELTA')} />
                <ThresholdRow label="Δyield10" value={result.metrics.yield10_delta} history={result.metrics.yield10_delta_history} disabled={disabledFactors.has('YIELD10_DELTA')} />
              </dl>
            </div>
          </div>

          {/* Trade history — full width so all columns fit */}
          <div>
            <h3 className="mb-2 font-semibold" style={{ color: 'var(--text)' }}>
              Trade History
            </h3>
            <TradeHistoryTable trades={result.trade_history} params={params} disabledFactors={disabledFactors} />
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

function ThresholdRow({ label, value, history, disabled, pct }: {
  label: string
  value: number | null | undefined
  history?: number[] | null
  disabled?: boolean
  pct?: boolean
}) {
  const fmt = (v: number | null | undefined) =>
    v == null ? '—' : pct ? `${(v * 100).toFixed(2)}%` : v.toFixed(4)

  const display = fmt(value)

  const allPass = history != null && history.length > 0 && history.every(v => v != null && v < 0)
  const historyDisplay = history != null && history.length > 0
    ? history.map(fmt).join(', ')
    : null

  return (
    <div className="flex justify-between" style={{ opacity: disabled ? 0.35 : 1 }}>
      <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="font-medium tabular-nums" style={{ color: 'var(--text)' }}>
        {historyDisplay ?? display}
        {history != null && (
          <span className="ml-1.5 text-xs font-bold" style={{ color: allPass ? 'var(--buy)' : 'var(--sell)' }}>
            {allPass ? '✓' : '✗'}
          </span>
        )}
        {disabled && <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>(off)</span>}
      </dd>
    </div>
  )
}
