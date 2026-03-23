import { useState, useRef } from 'react'
import { streamWalkForward } from '../../lib/api'
import type {
  Settings,
  WalkForwardResponse,
  ValidateWindowResult,
  DiscoverWindowResult,
  FactorStability,
} from '../../types'

interface Props {
  ticker: string
  settings: Settings
}

const INT_PARAM_KEYS = new Set(['MA', 'SPREAD_DELTA', 'YIELD10_DELTA'])
const PARAM_ORDER = [
  'MA', 'DROP', 'CHG4', 'RET3',
  'YIELD10_CHG4', 'YIELD2_CHG4', 'CURVE_CHG4',
  'SPREAD_DELTA', 'YIELD10_DELTA',
]

function fmtPeriod(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function fmtApy(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(2)}%`
}

function fmtStdev(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(2)}%`
}

function edgeColor(edge: number | null | undefined): string {
  if (edge == null) return 'var(--text)'
  return edge >= 0 ? 'var(--buy)' : 'var(--sell)'
}

function fmtParamVal(key: string, v: number): string {
  if (INT_PARAM_KEYS.has(key)) return String(Math.round(v))
  if (key === 'RET3') return v.toFixed(4)
  return v.toFixed(3)
}

function fmtKeyParams(params: Record<string, number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${fmtParamVal(k, v)}`)
    .join(', ') || '—'
}

const thCls = 'px-3 py-2 text-left uppercase tracking-wide whitespace-nowrap'
const thStyle = { color: 'var(--text-muted)', fontSize: '0.73rem', fontWeight: 600 }
const tdCls = 'px-3 py-2 text-sm'

function ValidateTable({ rows }: { rows: ValidateWindowResult[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--bg-input)' }}>
            {['Test Period', 'Strategy APY', 'B&H APY', 'Edge', 'Trades', 'Std Dev (Strat)', 'Std Dev (B&H)'].map(h => (
              <th key={h} className={thCls} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-input)', color: 'var(--text)' }}>
              <td className={tdCls + ' whitespace-nowrap'}>
                {fmtPeriod(row.test_start, row.test_end)}
                {row.is_partial && <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>*</span>}
              </td>
              <td className={tdCls}>{fmtApy(row.strategy_apy)}</td>
              <td className={tdCls}>{fmtApy(row.buyhold_apy)}</td>
              <td className={tdCls} style={{ color: edgeColor(row.edge) }}>{fmtApy(row.edge)}</td>
              <td className={tdCls}>{row.trades}</td>
              <td className={tdCls}>{fmtStdev(row.stdev_strategy)}</td>
              <td className={tdCls}>{fmtStdev(row.stdev_buyhold)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DiscoverTable({ rows }: { rows: DiscoverWindowResult[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-sm" style={{ minWidth: '860px' }}>
        <thead>
          <tr style={{ background: 'var(--bg-input)' }}>
            {['Train Period', 'Test Period', 'Active Factors', 'Key Params', 'In-Sample APY', 'OOS APY', 'B&H APY', 'Edge', 'Trades'].map(h => (
              <th key={h} className={thCls} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-input)', color: 'var(--text)' }}>
              <td className={tdCls + ' whitespace-nowrap'}>{fmtPeriod(row.train_start, row.train_end)}</td>
              <td className={tdCls + ' whitespace-nowrap'}>
                {fmtPeriod(row.test_start, row.test_end)}
                {row.is_partial && <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>*</span>}
              </td>
              <td className={tdCls} style={{ fontSize: '0.73rem' }}>{row.active_factors.join(', ')}</td>
              <td className={tdCls} style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{fmtKeyParams(row.key_params)}</td>
              <td className={tdCls}>{fmtApy(row.insample_apy)}</td>
              <td className={tdCls}>{fmtApy(row.outsample_apy)}</td>
              <td className={tdCls}>{fmtApy(row.buyhold_apy)}</td>
              <td className={tdCls} style={{ color: edgeColor(row.edge) }}>{fmtApy(row.edge)}</td>
              <td className={tdCls}>{row.trades}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FactorStabilityPanel({ stability }: { stability: Record<string, FactorStability> }) {
  const ordered = PARAM_ORDER.filter(k => stability[k])
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
        Factor Stability — windows survived elimination
      </p>
      <div className="grid grid-cols-3 gap-2">
        {ordered.map(k => {
          const s = stability[k]
          const pct = s.total > 0 ? s.survived / s.total : 0
          const barWidth = `${Math.round(pct * 100)}%`
          return (
            <div key={k} className="rounded px-3 py-2 space-y-1" style={{ background: 'var(--bg-input)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{k}</span>
                <span className="text-xs" style={{ color: pct >= 0.5 ? 'var(--buy)' : 'var(--sell)' }}>
                  {s.survived}/{s.total}
                </span>
              </div>
              <div className="rounded-full h-1.5 overflow-hidden" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: barWidth, background: pct >= 0.5 ? 'var(--buy)' : 'var(--sell)' }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WalkForwardTab({ ticker, settings }: Props) {
  const [windowSize, setWindowSize]         = useState(12)
  const [windowType, setWindowType]         = useState<'anchored' | 'rolling'>('anchored')
  const [initialTraining, setInitialTraining] = useState(36)
  const [trainingWindow, setTrainingWindow] = useState(36)
  const [mode, setMode]                     = useState<'validate' | 'discover'>('validate')
  const [apyTolBps, setApyTolBps]           = useState(10)
  const [maxCombos, setMaxCombos]           = useState(3000)
  const [seedSource, setSeedSource]         = useState<'saved' | 'previous'>('saved')

  const [loading, setLoading]   = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number; status: string } | null>(null)
  const [result, setResult]     = useState<WalkForwardResponse | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function handleRun() {
    if (abortRef.current) abortRef.current.abort()
    setLoading(true)
    setError(null)
    setResult(null)
    setProgress(null)

    const controller = streamWalkForward(
      {
        ticker,
        input_type: settings.inputType,
        window_size_months: windowSize,
        window_type: windowType,
        initial_training_months: initialTraining,
        training_window_months: trainingWindow,
        mode,
        apy_tolerance_bps: apyTolBps,
        max_combinations: maxCombos,
        seed_source: seedSource,
      },
      {
        onProgress(current, total, status) { setProgress({ current, total, status }) },
        onResult(data) { setResult(data); setLoading(false); setProgress(null) },
        onError(msg) { setError(msg); setLoading(false); setProgress(null) },
      },
    )
    abortRef.current = controller
  }

  function handleCancel() {
    abortRef.current?.abort()
    setLoading(false)
    setProgress(null)
  }

  const inputStyle = { background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }
  const labelStyle = { color: 'var(--text-muted)', fontSize: '0.8125rem' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function TogBtn({ value, current, onSet, label }: { value: string; current: string; onSet: (v: any) => void; label: string }) {
    const active = value === current
    return (
      <button
        onClick={() => onSet(value)}
        className="px-3 py-1 text-sm transition-colors"
        style={{
          background: active ? 'var(--accent)' : 'var(--bg-input)',
          color:      active ? 'var(--accent-text)' : 'var(--text-muted)',
        }}
      >
        {label}
      </button>
    )
  }

  function TogGroup({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        {children}
      </div>
    )
  }

  const numInput = (value: number, onChange: (n: number) => void, min: number, max: number, step = 1, w = 'w-20') => (
    <input
      type="number" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Math.max(min, parseFloat(e.target.value) || min))}
      className={`rounded border px-2 py-1 text-sm ${w}`}
      style={inputStyle}
    />
  )

  const hasValidate = result?.mode === 'validate' && result.validate_results
  const hasDiscover = result?.mode === 'discover' && result.discover_results
  const isEmpty = result && ((hasValidate && result.validate_results!.length === 0) || (hasDiscover && result.discover_results!.length === 0))
  const anyPartial = (hasValidate && result!.validate_results!.some(r => r.is_partial)) ||
                     (hasDiscover && result!.discover_results!.some(r => r.is_partial))

  return (
    <div className="space-y-5">
      {/* Settings card */}
      <div className="rounded-lg border p-4 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Security</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{ticker}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">

          {/* Left: window settings */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Window Settings</p>

            <div className="flex items-center gap-3">
              <span className="text-sm shrink-0 w-44" style={labelStyle}>Window size (months)</span>
              {numInput(windowSize, n => setWindowSize(Math.round(n)), 1, 120)}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm shrink-0 w-44" style={labelStyle}>Window type</span>
              <TogGroup>
                <TogBtn value="anchored" current={windowType} onSet={setWindowType} label="Anchored" />
                <TogBtn value="rolling"  current={windowType} onSet={setWindowType} label="Rolling" />
              </TogGroup>
            </div>

            {windowType === 'anchored' ? (
              <div className="flex items-center gap-3">
                <span className="text-sm shrink-0 w-44" style={labelStyle}>Initial training (months)</span>
                {numInput(initialTraining, n => setInitialTraining(Math.round(n)), 6, 240)}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm shrink-0 w-44" style={labelStyle}>Training window (months)</span>
                {numInput(trainingWindow, n => setTrainingWindow(Math.round(n)), 6, 240)}
              </div>
            )}
          </div>

          {/* Right: mode settings */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Mode</p>

            <div className="flex items-center gap-3">
              <span className="text-sm shrink-0 w-44" style={labelStyle}>Mode</span>
              <TogGroup>
                <TogBtn value="validate" current={mode} onSet={setMode} label="Validate" />
                <TogBtn value="discover" current={mode} onSet={setMode} label="Discover" />
              </TogGroup>
            </div>

            {mode === 'discover' && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-sm shrink-0 w-44" style={labelStyle}>APY tolerance (bps)</span>
                  {numInput(apyTolBps, setApyTolBps, 0, 200, 1)}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm shrink-0 w-44" style={labelStyle}>Max combinations</span>
                  {numInput(maxCombos, n => setMaxCombos(Math.round(n)), 100, 50000, 100, 'w-24')}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm shrink-0 w-44" style={labelStyle}>Seed source</span>
                  <TogGroup>
                    <TogBtn value="saved"    current={seedSource} onSet={setSeedSource} label="Saved params" />
                    <TogBtn value="previous" current={seedSource} onSet={setSeedSource} label="Prev window" />
                  </TogGroup>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Run / cancel / progress */}
        <div className="flex items-center gap-4 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
          {!loading ? (
            <button
              onClick={handleRun}
              className="px-4 py-2 rounded text-sm font-medium"
              style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
            >
              Run Walk-Forward
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded text-sm font-medium"
              style={{ background: 'var(--sell)', color: '#fff' }}
            >
              Cancel
            </button>
          )}

          {loading && progress && (
            <div className="flex flex-col gap-1 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ background: 'var(--accent)', width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                  />
                </div>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {progress.current} / {progress.total}
                </span>
              </div>
              {progress.status && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{progress.status}</span>
              )}
            </div>
          )}
          {loading && !progress && (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading data…</span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm rounded p-3 border" style={{ color: 'var(--sell)', background: 'var(--bg-card)', borderColor: 'var(--sell)' }}>
          {error}
        </p>
      )}

      {/* Empty result */}
      {isEmpty && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No windows were generated — try a shorter window size or smaller initial training period.
        </p>
      )}

      {/* Validate results */}
      {hasValidate && result!.validate_results!.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {result!.validate_results!.length} test window{result!.validate_results!.length !== 1 ? 's' : ''} — current saved parameters applied to each window
          </p>
          <ValidateTable rows={result!.validate_results!} />
          {anyPartial && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>* Partial window — shorter than the configured window size</p>
          )}
        </div>
      )}

      {/* Discover results */}
      {hasDiscover && result!.discover_results!.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {result!.discover_results!.length} test window{result!.discover_results!.length !== 1 ? 's' : ''} — parameters optimized on training data, tested out-of-sample
          </p>
          <DiscoverTable rows={result!.discover_results!} />
          {result!.factor_stability && Object.keys(result!.factor_stability).length > 0 && (
            <FactorStabilityPanel stability={result!.factor_stability} />
          )}
          {anyPartial && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>* Partial window — shorter than the configured window size</p>
          )}
        </div>
      )}
    </div>
  )
}
