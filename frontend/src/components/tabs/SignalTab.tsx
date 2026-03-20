import { useState, useEffect } from 'react'
import { useSignal } from '../../hooks/useSignal'
import { ParameterPanel } from '../ParameterPanel'
import { SignalBadge } from '../SignalBadge'
import { TradeHistoryTable } from '../TradeHistoryTable'
import { MetricsCard } from '../MetricsCard'
import { NumInput } from '../NumInput'
import type { Settings, StrategyParams, AppConfig } from '../../types'

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
  config: AppConfig
  onSaveConfig: (config: AppConfig) => Promise<void>
}

function fmt(v: number | null | undefined, decimals = 4): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(decimals)
}

function paramsEqual(a: StrategyParams, b: StrategyParams) {
  return (Object.keys(a) as (keyof StrategyParams)[]).every(k => a[k] === b[k])
}

export function SignalTab({ settings, ticker, defaultParams, paramDescriptions, cashRate: cashRateProp, startInvested: startInvestedProp, startDate, endDate, defaultDisabledFactors, config, onSaveConfig }: Props) {
  const { result, loading, error, run } = useSignal()
  const [params, setParams] = useState<StrategyParams>(defaultParams)
  const [startInvested, setStartInvested] = useState<0 | 1>(startInvestedProp)
  const [cashRate, setCashRate] = useState(cashRateProp)
  const [inputType, setInputType] = useState(settings.inputType)
  const [collapsed, setCollapsed] = useState(false)
  const [disabledFactors, setDisabledFactors] = useState<Set<string>>(new Set(defaultDisabledFactors ?? []))
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const hasChanges =
    cashRate !== cashRateProp ||
    startInvested !== startInvestedProp ||
    !paramsEqual(params, defaultParams) ||
    disabledFactors.size !== (defaultDisabledFactors ?? []).length ||
    !(defaultDisabledFactors ?? []).every(f => disabledFactors.has(f))

  function handleResetFromSettings() {
    setParams(defaultParams)
    setDisabledFactors(new Set(defaultDisabledFactors ?? []))
    setCashRate(cashRateProp)
    setStartInvested(startInvestedProp)
  }

  async function handleSaveToSettings() {
    setSaveStatus('saving')
    try {
      const updated: AppConfig = {
        ...config,
        cash_rate: cashRate,
        start_invested: startInvested,
        sell_triggers: {
          CHG4:         { ...config.sell_triggers.CHG4,         default: params.CHG4,         ignore: disabledFactors.has('CHG4') },
          RET3:         { ...config.sell_triggers.RET3,         default: params.RET3,         ignore: disabledFactors.has('RET3') },
          YIELD10_CHG4: { ...config.sell_triggers.YIELD10_CHG4, default: params.YIELD10_CHG4, ignore: disabledFactors.has('YIELD10_CHG4') },
          YIELD2_CHG4:  { ...config.sell_triggers.YIELD2_CHG4,  default: params.YIELD2_CHG4,  ignore: disabledFactors.has('YIELD2_CHG4') },
          CURVE_CHG4:   { ...config.sell_triggers.CURVE_CHG4,   default: params.CURVE_CHG4,   ignore: disabledFactors.has('CURVE_CHG4') },
        },
        buy_conditions: {
          MA:           { ...config.buy_conditions.MA,           default: params.MA,           ignore: disabledFactors.has('MA') },
          DROP:         { ...config.buy_conditions.DROP,         default: params.DROP,         ignore: disabledFactors.has('DROP') },
          SPREAD_DELTA: { ...config.buy_conditions.SPREAD_DELTA, default: params.SPREAD_DELTA, ignore: disabledFactors.has('SPREAD_DELTA') },
          YIELD10_DELTA:{ ...config.buy_conditions.YIELD10_DELTA,default: params.YIELD10_DELTA,ignore: disabledFactors.has('YIELD10_DELTA') },
        },
      }
      await onSaveConfig(updated)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

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
              <option value={0}>Not Invested</option>
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

          <div className="ml-auto flex gap-2">
            <button
              onClick={handleResetFromSettings}
              disabled={!hasChanges}
              className="rounded px-3 py-1.5 text-sm disabled:opacity-40"
              style={hasChanges
                ? { background: 'var(--accent)', color: 'var(--accent-text)' }
                : { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              Reset from Settings
            </button>
            <button
              onClick={handleSaveToSettings}
              disabled={!hasChanges || saveStatus === 'saving'}
              className="rounded px-3 py-1.5 text-sm disabled:opacity-40"
              style={saveStatus === 'error'
                ? { background: 'var(--sell)', color: '#fff' }
                : saveStatus === 'saved'
                ? { background: 'var(--buy)', color: '#fff' }
                : hasChanges
                ? { background: 'var(--accent)', color: 'var(--accent-text)' }
                : { background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save to Settings'}
            </button>
          </div>
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
                <ThresholdRow label="chg4"      value={result.metrics.chg4}          disabled={disabledFactors.has('CHG4')} pct />
                <ThresholdRow label="ret3"      value={result.metrics.ret3}          disabled={disabledFactors.has('RET3')} pct />
                <ThresholdRow label="10yr chg4" value={result.metrics.yield10_chg4}  disabled={disabledFactors.has('YIELD10_CHG4')} pct />
                <ThresholdRow label="2yr chg4"  value={result.metrics.yield2_chg4}   disabled={disabledFactors.has('YIELD2_CHG4')} pct />
                <ThresholdRow label="Curve now"  value={result.metrics.yield_curve}   disabled={disabledFactors.has('CURVE_CHG4')} />
                <ThresholdRow label="Curve 4wk"  value={result.metrics.curve_4wk_ago} disabled={disabledFactors.has('CURVE_CHG4')} />
                <ThresholdRow label="ΔCurve"    value={result.metrics.curve_chg4}    disabled={disabledFactors.has('CURVE_CHG4')} hint="<0 flatten · >0 widen" />
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

function ThresholdRow({ label, value, history, disabled, pct, hint }: {
  label: string
  value: number | null | undefined
  history?: number[] | null
  disabled?: boolean
  pct?: boolean
  hint?: string
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
      <dt style={{ color: 'var(--text-muted)' }}>{label}{hint && <span className="ml-1 text-xs font-normal" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{hint}</span>}</dt>
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
