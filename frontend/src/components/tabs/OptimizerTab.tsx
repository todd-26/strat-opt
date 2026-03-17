import { useState, useEffect } from 'react'
import { useOptimizer } from '../../hooks/useOptimizer'
import { ParameterPanel, rangeToArray } from '../ParameterPanel'
import type { ParamRanges } from '../ParameterPanel'
import { OptimizerTable } from '../OptimizerTable'
import { EquityCurveChart } from '../EquityCurveChart'
import { MetricsCard } from '../MetricsCard'
import { NumInput } from '../NumInput'
import type { Settings, StrategyParams, BacktestResult, AppConfig } from '../../types'
import { streamOptimizer, runBuyHold, saveConfig } from '../../lib/api'

interface Props {
  settings: Settings
  ticker: string
  defaultRanges: ParamRanges
  paramDescriptions?: Partial<Record<keyof StrategyParams, string>>
  cashRate: number
  startInvested: 0 | 1
  startDate?: string
  endDate?: string
  defaultDisabledFactors?: string[]
  config: AppConfig
  onSaveConfig: (config: AppConfig) => Promise<void>
}

function setsEqual(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every(v => b.has(v))
}

function rangesEqual(a: ParamRanges, b: ParamRanges) {
  return (Object.keys(a) as (keyof ParamRanges)[]).every(
    k => a[k].min === b[k].min && a[k].max === b[k].max && a[k].step === b[k].step
  )
}

export function OptimizerTab({ settings, ticker, defaultRanges, paramDescriptions, cashRate: cashRateProp, startInvested: startInvestedProp, startDate, endDate, defaultDisabledFactors, config, onSaveConfig }: Props) {
  const { result, progress, loading, error, run, cancel } = useOptimizer()
  const [ranges, setRanges]           = useState<ParamRanges>(defaultRanges)
  const [inputType, setInputType]     = useState(settings.inputType)
  const [cashRate, setCashRate]       = useState(cashRateProp)
  const [startInvested, setStartInvested] = useState<0 | 1>(startInvestedProp)
  const [collapsed, setCollapsed]         = useState(false)
  const [disabledFactors, setDisabledFactors] = useState<Set<string>>(new Set(defaultDisabledFactors ?? []))
  const [saveStatus, setSaveStatus]   = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const hasChanges =
    cashRate !== cashRateProp ||
    startInvested !== startInvestedProp ||
    !setsEqual(disabledFactors, new Set(defaultDisabledFactors ?? [])) ||
    !rangesEqual(ranges, defaultRanges)

  function handleResetFromSettings() {
    setRanges(defaultRanges)
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
          CHG4:         { ...config.sell_triggers.CHG4,         range: ranges.CHG4,         ignore: disabledFactors.has('CHG4') },
          RET3:         { ...config.sell_triggers.RET3,         range: ranges.RET3,         ignore: disabledFactors.has('RET3') },
          SPREAD_LVL:   { ...config.sell_triggers.SPREAD_LVL,   range: ranges.SPREAD_LVL,   ignore: disabledFactors.has('SPREAD_LVL') },
          YIELD10_CHG4: { ...config.sell_triggers.YIELD10_CHG4, range: ranges.YIELD10_CHG4, ignore: disabledFactors.has('YIELD10_CHG4') },
          YIELD2_CHG4:  { ...config.sell_triggers.YIELD2_CHG4,  range: ranges.YIELD2_CHG4,  ignore: disabledFactors.has('YIELD2_CHG4') },
          CURVE_CHG4:   { ...config.sell_triggers.CURVE_CHG4,   range: ranges.CURVE_CHG4,   ignore: disabledFactors.has('CURVE_CHG4') },
        },
        buy_conditions: {
          MA:           { ...config.buy_conditions.MA,           range: ranges.MA,           ignore: disabledFactors.has('MA') },
          DROP:         { ...config.buy_conditions.DROP,         range: ranges.DROP,         ignore: disabledFactors.has('DROP') },
          SPREAD_DELTA: { ...config.buy_conditions.SPREAD_DELTA, range: ranges.SPREAD_DELTA, ignore: disabledFactors.has('SPREAD_DELTA') },
          YIELD10_DELTA:{ ...config.buy_conditions.YIELD10_DELTA,range: ranges.YIELD10_DELTA,ignore: disabledFactors.has('YIELD10_DELTA') },
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

  const [selectedParams, setSelectedParams] = useState<StrategyParams | null>(null)
  const [chartParams, setChartParams]       = useState<StrategyParams | null>(null)
  const [drillResult, setDrillResult]       = useState<BacktestResult | null>(null)
  const [drillLoading, setDrillLoading]     = useState(false)
  const [drillError, setDrillError]         = useState<string | null>(null)
  const [buyholdResult, setBuyholdResult]   = useState<BacktestResult | null>(null)
  const [buyholdError, setBuyholdError]     = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (result) setSelectedParams(result.best_params)
  }, [result])

  function handleRun() {
    const invalid = (Object.entries(ranges) as [string, { min: number; max: number }][])
      .filter(([k, r]) => r.max < r.min && !disabledFactors.has(k))
      .map(([k]) => k)
    if (invalid.length > 0) {
      setValidationError(`Max cannot be less than Min for: ${invalid.join(', ')}`)
      return
    }
    setValidationError(null)

    const disabledArr = disabledFactors.size ? [...disabledFactors] : undefined
    const grids = {
      MA:          disabledFactors.has('MA')          ? [0] : rangeToArray(ranges.MA, 0).map(Math.round),
      DROP:        disabledFactors.has('DROP')        ? [0] : rangeToArray(ranges.DROP),
      CHG4:        disabledFactors.has('CHG4')        ? [0] : rangeToArray(ranges.CHG4),
      RET3:        disabledFactors.has('RET3')        ? [0] : rangeToArray(ranges.RET3),
      SPREAD_LVL:  disabledFactors.has('SPREAD_LVL') ? [0] : rangeToArray(ranges.SPREAD_LVL),
      YIELD10_CHG4:  disabledFactors.has('YIELD10_CHG4') ? [0] : rangeToArray(ranges.YIELD10_CHG4),
      YIELD2_CHG4:   disabledFactors.has('YIELD2_CHG4')  ? [0] : rangeToArray(ranges.YIELD2_CHG4),
      CURVE_CHG4:  disabledFactors.has('CURVE_CHG4') ? [0] : rangeToArray(ranges.CURVE_CHG4),
      SPREAD_DELTA:disabledFactors.has('SPREAD_DELTA')? [0] : rangeToArray(ranges.SPREAD_DELTA, 0).map(Math.round),
      YIELD10_DELTA: disabledFactors.has('YIELD10_DELTA') ? [0] : rangeToArray(ranges.YIELD10_DELTA, 0).map(Math.round),
    }
    run(ticker, grids, startInvested, cashRate, inputType, startDate, endDate, disabledArr)
    setCollapsed(true)
    setSelectedParams(null)
    setChartParams(null)
    setDrillResult(null)
    setBuyholdResult(null)
    setBuyholdError(null)
    runBuyHold(ticker, cashRate, inputType, startDate, endDate)
      .then(setBuyholdResult)
      .catch((e) => setBuyholdError(String(e)))
  }

  function paramsEqual(a: StrategyParams, b: StrategyParams) {
    return a.MA === b.MA && a.DROP === b.DROP && a.CHG4 === b.CHG4 && a.RET3 === b.RET3 &&
      a.SPREAD_LVL === b.SPREAD_LVL && a.YIELD10_CHG4 === b.YIELD10_CHG4 &&
      a.YIELD2_CHG4 === b.YIELD2_CHG4 && a.CURVE_CHG4 === b.CURVE_CHG4 &&
      a.SPREAD_DELTA === b.SPREAD_DELTA && a.YIELD10_DELTA === b.YIELD10_DELTA
  }

  async function handleToggleChart(params: StrategyParams) {
    if (chartParams && paramsEqual(chartParams, params)) {
      setChartParams(null)
      setDrillResult(null)
      return
    }

    setChartParams(params)
    setDrillError(null)

    if (result && paramsEqual(result.best_params, params)) {
      setDrillResult(result.best_result)
      return
    }

    setDrillResult(null)
    setDrillLoading(true)
    try {
      await new Promise<void>((resolve, reject) => {
        streamOptimizer(
          {
            ticker,
            MA:          [params.MA],
            DROP:        [params.DROP],
            CHG4:        [params.CHG4],
            RET3:        [params.RET3],
            SPREAD_LVL:  [params.SPREAD_LVL],
            YIELD10_CHG4:  [params.YIELD10_CHG4],
            YIELD2_CHG4:   [params.YIELD2_CHG4],
            CURVE_CHG4:  [params.CURVE_CHG4],
            SPREAD_DELTA:[params.SPREAD_DELTA],
            YIELD10_DELTA: [params.YIELD10_DELTA],
            start_invested: startInvested,
            cash_rate:   cashRate,
            input_type:  inputType,
            start_date:  startDate || undefined,
            end_date:    endDate   || undefined,
            disabled_factors: disabledFactors.size ? [...disabledFactors] : undefined,
          },
          {
            onProgress() {},
            onResult(r) { setDrillResult(r.best_result); resolve() },
            onError(msg) { setDrillError(msg); reject(new Error(msg)) },
          },
        )
      })
    } catch (err) {
      setDrillError(String(err))
    } finally {
      setDrillLoading(false)
    }
  }

  const progressPct = progress ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="space-y-4">
      <ParameterPanel
        mode="range"
        ranges={ranges}
        onChange={setRanges}
        collapsed={collapsed}
        descriptions={paramDescriptions}
        disabledFactors={disabledFactors}
        onToggleFactor={toggleFactor}
      />

      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cash Rate</label>
            <NumInput value={cashRate} step="0.0025" onChange={setCashRate}
              className="w-28 rounded border px-2 py-1.5 text-sm"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Start Position</label>
            <select value={startInvested} onChange={(e) => setStartInvested(Number(e.target.value) as 0 | 1)}
              className="rounded border px-2 py-1.5 text-sm"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value={1}>Invested</option>
              <option value={0}>Not Invested</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Data Source</label>
            <select value={inputType} onChange={(e) => setInputType(e.target.value as 'csv' | 'api')}
              className="rounded border px-2 py-1.5 text-sm"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="csv">CSV</option>
              <option value="api">Live API</option>
            </select>
          </div>

          {result && (
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Date Range Used</label>
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {result.best_result.equity_curve[0]?.date} – {result.best_result.equity_curve[result.best_result.equity_curve.length - 1]?.date}
              </span>
            </div>
          )}

          {loading ? (
            <button onClick={cancel} className="rounded px-4 py-2 text-sm font-semibold" style={{ background: 'var(--sell)', color: '#fff' }}>Cancel</button>
          ) : (
            <button onClick={handleRun} className="rounded px-4 py-2 text-sm font-semibold" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>Run Backtester</button>
          )}

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

      {loading && progress && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <div className="mb-2 flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>Optimizing…</span>
            <span>{progress.current} / {progress.total} ({progressPct}%)</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-input)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%`, background: 'var(--accent)' }} />
          </div>
        </div>
      )}

      {loading && !progress && <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Starting optimizer…</div>}

      {validationError && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--sell)', background: '#fee2e2', color: '#991b1b' }}>{validationError}</div>
      )}
      {error && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--sell)', background: '#fee2e2', color: '#991b1b' }}>{error}</div>
      )}
      {buyholdError && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--sell)', background: '#fee2e2', color: '#991b1b' }}>Buy &amp; Hold overlay failed: {buyholdError}</div>
      )}

      {result && (
        <>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <h3 className="mb-3 font-semibold" style={{ color: 'var(--text)' }}>Best Parameters</h3>
            <div className="flex flex-wrap gap-3 text-sm">
              {Object.entries(result.best_params).map(([k, v]) => (
                <span key={k} className="rounded px-2 py-1" style={{ background: 'var(--bg-input)', color: 'var(--text)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                  <strong>{typeof v === 'number' ? v : String(v)}</strong>
                </span>
              ))}
            </div>
            <div className="mt-3">
              <MetricsCard apy={result.best_result.apy} finalValue={result.best_result.final_value} />
            </div>
          </div>

          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <h3 className="mb-3 font-semibold" style={{ color: 'var(--text)' }}>All Results — click a row to select, click the chart icon to expand</h3>
            <OptimizerTable
              rows={result.all_results}
              selectedRow={selectedParams}
              onSelectRow={setSelectedParams}
              chartParams={chartParams}
              chartResult={drillResult}
              chartLoading={drillLoading}
              chartError={drillError}
              onToggleChart={handleToggleChart}
              buyholdResult={buyholdResult}
              ticker={ticker}
            />
          </div>
        </>
      )}
    </div>
  )
}
