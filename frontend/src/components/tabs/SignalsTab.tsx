import { useState, useEffect } from 'react'
import { getConfig, saveConfig, runSignal } from '../../lib/api'
import type { AppConfig, Settings, StrategyParams } from '../../types'

type RowState = { signal: 'BUY' | 'SELL' | 'HOLD' } | { error: string } | 'running' | null

interface Props {
  securities: string[]
  settings: Settings
}

const SIGNAL_STYLE: Record<'BUY' | 'SELL' | 'HOLD', string> = {
  BUY:  'var(--buy)',
  SELL: 'var(--sell)',
  HOLD: 'var(--hold)',
}

const SIGNAL_LABEL: Record<'BUY' | 'SELL' | 'HOLD', string> = {
  BUY:  '▲ BUY',
  SELL: '▼ SELL',
  HOLD: '● HOLD',
}

export function SignalsTab({ securities, settings }: Props) {
  const [inputType, setInputType]   = useState(settings.inputType)
  const [checked, setChecked]       = useState<Set<string>>(new Set(securities))
  const [configs, setConfigs]       = useState<Map<string, AppConfig>>(new Map())
  const [results, setResults]       = useState<Map<string, RowState>>(new Map())
  const [running, setRunning]       = useState(false)

  useEffect(() => { setChecked(new Set(securities)) }, [securities])

  // Prefetch all configs on mount and when securities change
  useEffect(() => {
    securities.forEach(ticker => {
      getConfig(ticker).then(cfg => {
        setConfigs(prev => new Map(prev).set(ticker, cfg))
      }).catch(() => {/* ignore — run will surface the error */})
    })
  }, [securities])

  async function toggleInvested(ticker: string) {
    const cfg = configs.get(ticker)
    if (!cfg) return
    const updated = { ...cfg, start_invested: (cfg.start_invested === 1 ? 0 : 1) as 0 | 1 }
    setConfigs(prev => new Map(prev).set(ticker, updated))
    try {
      await saveConfig(ticker, updated)
    } catch {
      // Revert on failure
      setConfigs(prev => new Map(prev).set(ticker, cfg))
    }
  }

  const allChecked  = securities.length > 0 && securities.every(t => checked.has(t))
  const noneChecked = securities.every(t => !checked.has(t))

  function toggleTicker(t: string) {
    if (running) return
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t); else next.add(t)
      return next
    })
  }

  async function handleRun() {
    const toRun = securities.filter(t => checked.has(t))
    if (toRun.length === 0) return
    setRunning(true)
    setResults(prev => {
      const next = new Map(prev)
      toRun.forEach(t => next.set(t, 'running'))
      return next
    })
    for (let i = 0; i < toRun.length; i++) {
      if (i > 0 && inputType === 'api') {
        await new Promise(r => setTimeout(r, 1500))
      }
      const ticker = toRun[i]
      try {
        const config = configs.get(ticker) ?? await getConfig(ticker)
        const params: StrategyParams = {
          MA:           config.buy_conditions.MA.default,
          DROP:         config.buy_conditions.DROP.default,
          CHG4:         config.sell_triggers.CHG4.default,
          RET3:         config.sell_triggers.RET3.default,
          YIELD10_CHG4: config.sell_triggers.YIELD10_CHG4.default,
          YIELD2_CHG4:  config.sell_triggers.YIELD2_CHG4.default,
          CURVE_CHG4:   config.sell_triggers.CURVE_CHG4.default,
          SPREAD_DELTA: config.buy_conditions.SPREAD_DELTA.default,
          YIELD10_DELTA: config.buy_conditions.YIELD10_DELTA.default,
        }
        const disabled = [
          ...Object.entries(config.sell_triggers).filter(([, v]) => v.ignore).map(([k]) => k),
          ...Object.entries(config.buy_conditions).filter(([, v]) => v.ignore).map(([k]) => k),
        ]
        const res = await runSignal(
          ticker, params, config.start_invested, config.cash_rate,
          inputType, undefined, undefined, disabled
        )
        setResults(prev => new Map(prev).set(ticker, { signal: res.signal }))
      } catch (e) {
        setResults(prev => new Map(prev).set(ticker, { error: e instanceof Error ? e.message : String(e) }))
      }
    }
    setRunning(false)
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Controls */}
      <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Data Source
            </label>
            <select
              value={inputType}
              onChange={e => setInputType(e.target.value as 'csv' | 'api')}
              disabled={running}
              className="rounded border px-2 py-1.5 text-sm"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <option value="csv">CSV</option>
              <option value="api">Live API</option>
            </select>
          </div>

          <div className="flex flex-1 items-end justify-end gap-2">
            <button
              onClick={() => setChecked(new Set(securities))}
              disabled={running || allChecked}
              className="text-xs px-2 py-1.5 rounded"
              style={{ color: 'var(--text-muted)', opacity: allChecked ? 0.4 : 1 }}
            >
              Select All
            </button>
            <button
              onClick={() => setChecked(new Set())}
              disabled={running || noneChecked}
              className="text-xs px-2 py-1.5 rounded"
              style={{ color: 'var(--text-muted)', opacity: noneChecked ? 0.4 : 1 }}
            >
              Deselect All
            </button>
            <button
              onClick={handleRun}
              disabled={running || noneChecked}
              className="px-4 py-1.5 rounded text-sm font-medium"
              style={{
                background: running || noneChecked ? 'var(--border)' : 'var(--tab-active)',
                color:      running || noneChecked ? 'var(--text-muted)' : 'var(--tab-active-text)',
                cursor:     running || noneChecked ? 'not-allowed' : 'pointer',
              }}
            >
              {running ? 'Running…' : 'Run Signals'}
            </button>
          </div>
        </div>
      </div>

      {/* Securities rows */}
      <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {securities.map((ticker, i) => {
          const result    = results.get(ticker)
          const isChecked = checked.has(ticker)
          const cfg       = configs.get(ticker)
          const invested  = cfg?.start_invested === 1

          return (
            <div
              key={ticker}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderBottom: i < securities.length - 1 ? '1px solid var(--border)' : undefined,
                opacity: isChecked ? 1 : 0.45,
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleTicker(ticker)}
                disabled={running}
                className="h-4 w-4 cursor-pointer"
              />

              <span className="font-mono font-semibold w-16" style={{ color: 'var(--text)' }}>
                {ticker}
              </span>

              {/* Invested toggle */}
              <button
                onClick={() => toggleInvested(ticker)}
                disabled={running || !cfg}
                title="Click to toggle position"
                className="px-2 py-0.5 rounded text-xs font-medium transition-opacity"
                style={{
                  background: invested ? 'color-mix(in srgb, var(--buy) 20%, transparent)' : 'color-mix(in srgb, var(--hold) 15%, transparent)',
                  color:      invested ? 'var(--buy)' : 'var(--hold)',
                  border:     `1px solid ${invested ? 'var(--buy)' : 'var(--hold)'}`,
                  opacity:    !cfg ? 0.4 : 1,
                  cursor:     running || !cfg ? 'not-allowed' : 'pointer',
                  minWidth:   '7rem',
                }}
              >
                {!cfg ? '…' : invested ? 'Invested' : 'Not Invested'}
              </button>

              <div className="flex-1" />

              {result === 'running' && (
                <span className="text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>Running…</span>
              )}
              {result && result !== 'running' && 'signal' in result && (
                <span
                  className="px-3 py-1 rounded text-sm font-bold text-white"
                  style={{ background: SIGNAL_STYLE[result.signal] }}
                >
                  {SIGNAL_LABEL[result.signal]}
                </span>
              )}
              {result && result !== 'running' && 'error' in result && (
                <span className="text-xs max-w-xs truncate" style={{ color: 'var(--sell)' }} title={result.error}>
                  Error: {result.error}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
