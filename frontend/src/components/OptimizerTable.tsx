import { useState, Fragment } from 'react'
import { LineChart, X, ChevronUp, ChevronDown } from 'lucide-react'
import type { OptimizerResultRow, StrategyParams, BacktestResult } from '../types'
import { EquityCurveChart } from './EquityCurveChart'

type SortKey = keyof OptimizerResultRow
type SortDir = 'asc' | 'desc'

interface Props {
  rows: OptimizerResultRow[]
  selectedRow: StrategyParams | null
  onSelectRow: (params: StrategyParams) => void
  chartParams: StrategyParams | null
  chartResult: BacktestResult | null
  chartLoading: boolean
  chartError: string | null
  onToggleChart: (params: StrategyParams) => void
}

function toParams(row: OptimizerResultRow): StrategyParams {
  return { MA: row.MA, DROP: row.DROP, CHG4: row.CHG4, RET3: row.RET3, SPREAD_LVL: row.SPREAD_LVL }
}

function paramsMatch(a: StrategyParams, b: StrategyParams): boolean {
  return a.MA === b.MA && a.DROP === b.DROP && a.CHG4 === b.CHG4 && a.RET3 === b.RET3 && a.SPREAD_LVL === b.SPREAD_LVL
}

const cols: { key: SortKey; label: string; fmt: (v: number) => string }[] = [
  { key: 'MA',          label: 'MA',          fmt: (v) => String(v) },
  { key: 'DROP',        label: 'DROP',        fmt: (v) => v.toFixed(3) },
  { key: 'CHG4',        label: 'CHG4',        fmt: (v) => v.toFixed(3) },
  { key: 'RET3',        label: 'RET3',        fmt: (v) => v.toFixed(4) },
  { key: 'SPREAD_LVL',  label: 'SPREAD_LVL',  fmt: (v) => v.toFixed(1) },
  { key: 'APY',         label: 'APY %',       fmt: (v) => `${(v * 100).toFixed(2)}%` },
  { key: 'final_value', label: 'Final Value', fmt: (v) => v.toFixed(6) },
]

const TOTAL_COLS = cols.length + 1 // data cols + chart icon col

export function OptimizerTable({
  rows,
  selectedRow,
  onSelectRow,
  chartParams,
  chartResult,
  chartLoading,
  chartError,
  onToggleChart,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('APY')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] as number
    const bv = b[sortKey] as number
    return sortDir === 'asc' ? av - bv : bv - av
  })

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--bg-input)' }}>
            {cols.map((c) => (
              <th
                key={c.key}
                className="cursor-pointer select-none px-3 py-2 text-left font-semibold uppercase tracking-wide text-xs"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => handleSort(c.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sortKey === c.key
                    ? sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    : null}
                </span>
              </th>
            ))}
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Chart
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const params = toParams(row)
            const sel = selectedRow ? paramsMatch(params, selectedRow) : false
            const chartOpen = chartParams ? paramsMatch(params, chartParams) : false
            const rowBg = sel ? 'var(--accent)' : i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-input)'
            const rowColor = sel ? 'var(--accent-text)' : 'var(--text)'

            return (
              <Fragment key={i}>
                <tr
                  className="cursor-pointer transition-colors"
                  style={{ background: rowBg, color: rowColor }}
                  onClick={() => onSelectRow(params)}
                >
                  {cols.map((c) => (
                    <td key={c.key} className="px-3 py-2">
                      {c.fmt(row[c.key] as number)}
                    </td>
                  ))}
                  <td
                    className="px-3 py-2"
                    onClick={(e) => { e.stopPropagation(); onToggleChart(params) }}
                  >
                    {chartOpen
                      ? <X size={16} className="transition-opacity hover:opacity-60" style={{ color: sel ? 'var(--accent-text)' : 'var(--sell)' }} />
                      : <LineChart size={16} className="transition-opacity hover:opacity-60" style={{ color: sel ? 'var(--accent-text)' : 'var(--accent)' }} />
                    }
                  </td>
                </tr>

                {chartOpen && (
                  <tr style={{ background: 'var(--bg-card)' }}>
                    <td colSpan={TOTAL_COLS} className="px-4 py-4">
                      {chartLoading && (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading chart…</p>
                      )}
                      {chartError && (
                        <p className="text-sm" style={{ color: 'var(--sell)' }}>{chartError}</p>
                      )}
                      {chartResult && (
                        <EquityCurveChart
                          equityCurve={chartResult.equity_curve}
                          buydates={chartResult.buy_dates}
                          selldates={chartResult.sell_dates}
                          id={`chart-${i}`}
                        />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
