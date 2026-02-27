import { useState, useEffect } from 'react'
import { useOptimizer } from '../../hooks/useOptimizer'
import { ParameterPanel, rangeToArray } from '../ParameterPanel'
import type { ParamRanges } from '../ParameterPanel'
import { OptimizerTable } from '../OptimizerTable'
import { EquityCurveChart } from '../EquityCurveChart'
import { MetricsCard } from '../MetricsCard'
import type { Settings, StrategyParams, BacktestResult } from '../../types'
import { streamOptimizer, runBuyHold } from '../../lib/api'

interface Props {
  settings: Settings
  ticker: string
  defaultRanges: ParamRanges
  paramDescriptions?: Partial<Record<keyof StrategyParams, string>>
}

export function OptimizerTab({ settings, ticker, defaultRanges, paramDescriptions }: Props) {
  const { result, progress, loading, error, run, cancel } = useOptimizer()
  const [ranges, setRanges] = useState<ParamRanges>(defaultRanges)
  const [inputType, setInputType] = useState(settings.inputType)
  const [cashRate, setCashRate] = useState(settings.cashRate)
  const [startInvested, setStartInvested] = useState(settings.startInvested)
  const [collapsed, setCollapsed] = useState(false)

  // Row highlight (independent of chart)
  const [selectedParams, setSelectedParams] = useState<StrategyParams | null>(null)
  // Chart open state (null = no chart showing)
  const [chartParams, setChartParams] = useState<StrategyParams | null>(null)
  const [drillResult, setDrillResult] = useState<BacktestResult | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [drillError, setDrillError] = useState<string | null>(null)
  const [buyholdResult, setBuyholdResult] = useState<BacktestResult | null>(null)
  const [buyholdError, setBuyholdError] = useState<string | null>(null)

  // Highlight the best row when results arrive (no chart loaded yet)
  useEffect(() => {
    if (result) {
      setSelectedParams(result.best_params)
    }
  }, [result])

  function handleRun() {
    const grids = {
      MA: rangeToArray(ranges.MA, 0).map(Math.round),
      DROP: rangeToArray(ranges.DROP),
      CHG4: rangeToArray(ranges.CHG4),
      RET3: rangeToArray(ranges.RET3),
      SPREAD_LVL: rangeToArray(ranges.SPREAD_LVL),
    }
    run(ticker, grids, startInvested, cashRate, inputType)
    setCollapsed(true)
    setSelectedParams(null)
    setChartParams(null)
    setDrillResult(null)
    setBuyholdResult(null)
    setBuyholdError(null)
    runBuyHold(ticker, cashRate, inputType)
      .then(setBuyholdResult)
      .catch((e) => setBuyholdError(String(e)))
  }

  async function handleToggleChart(params: StrategyParams) {
    // If this row's chart is already open, close it
    if (
      chartParams &&
      chartParams.MA === params.MA &&
      chartParams.DROP === params.DROP &&
      chartParams.CHG4 === params.CHG4 &&
      chartParams.RET3 === params.RET3 &&
      chartParams.SPREAD_LVL === params.SPREAD_LVL
    ) {
      setChartParams(null)
      setDrillResult(null)
      return
    }

    setChartParams(params)
    setDrillError(null)

    // Use cached best_result if params match the optimizer's best
    if (
      result &&
      result.best_params.MA === params.MA &&
      result.best_params.DROP === params.DROP &&
      result.best_params.CHG4 === params.CHG4 &&
      result.best_params.RET3 === params.RET3 &&
      result.best_params.SPREAD_LVL === params.SPREAD_LVL
    ) {
      setDrillResult(result.best_result)
      return
    }

    // Otherwise run a single-combo backtest via the optimizer endpoint
    setDrillResult(null)
    setDrillLoading(true)
    try {
      await new Promise<void>((resolve, reject) => {
        streamOptimizer(
          {
            ticker,
            MA: [params.MA],
            DROP: [params.DROP],
            CHG4: [params.CHG4],
            RET3: [params.RET3],
            SPREAD_LVL: [params.SPREAD_LVL],
            start_invested: startInvested,
            cash_rate: cashRate,
            input_type: inputType,
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
      {/* Parameter range panel */}
      <ParameterPanel
        mode="range"
        ranges={ranges}
        onChange={setRanges}
        collapsed={collapsed}
        descriptions={paramDescriptions}
      />

      {/* Options + Run */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
      >
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Cash Rate
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
              Start Position
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

          {loading ? (
            <button
              onClick={cancel}
              className="rounded px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--sell)', color: '#fff' }}
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="rounded px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
            >
              Run Optimizer
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {loading && progress && (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
        >
          <div className="mb-2 flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>Optimizing…</span>
            <span>
              {progress.current} / {progress.total} ({progressPct}%)
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-input)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%`, background: 'var(--accent)' }}
            />
          </div>
        </div>
      )}

      {/* Loading spinner (before first progress event) */}
      {loading && !progress && (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Starting optimizer…
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--sell)', background: '#fee2e2', color: '#991b1b' }}
        >
          {error}
        </div>
      )}
      {buyholdError && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--sell)', background: '#fee2e2', color: '#991b1b' }}
        >
          Buy &amp; Hold overlay failed: {buyholdError}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Best params summary */}
          <div
            className="rounded-lg border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
          >
            <h3 className="mb-3 font-semibold" style={{ color: 'var(--text)' }}>
              Best Parameters
            </h3>
            <div className="flex flex-wrap gap-3 text-sm">
              {Object.entries(result.best_params).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded px-2 py-1"
                  style={{ background: 'var(--bg-input)', color: 'var(--text)' }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                  <strong>{typeof v === 'number' ? v : String(v)}</strong>
                </span>
              ))}
            </div>
            <div className="mt-3">
              <MetricsCard apy={result.best_result.apy} finalValue={result.best_result.final_value} />
            </div>
          </div>

          {/* Sortable results table */}
          <div
            className="rounded-lg border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
          >
            <h3 className="mb-3 font-semibold" style={{ color: 'var(--text)' }}>
              All Results — click a row to select, click the chart icon to expand
            </h3>
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
            />
          </div>
        </>
      )}
    </div>
  )
}
