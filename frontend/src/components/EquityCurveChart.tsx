import { useRef, useState } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { EquityPoint } from '../types'

interface ChartPoint {
  date: string
  strategy: number
  buyhold?: number
  isBuy: boolean
  isSell: boolean
}

interface Props {
  equityCurve: EquityPoint[]
  buydates?: string[]
  selldates?: string[]
  buyholdCurve?: EquityPoint[]
  showBuyHoldToggle?: boolean
  id?: string
}

const OFFSET = 12
const SIZE = 7

// Called by Recharts for each data point on the strategy line.
// Returns a triangle marker for buy/sell dates, nothing otherwise.
function StrategyDot(props: any) {
  const { cx, cy, payload } = props
  if (!cx || !cy) return <g />

  if (payload?.isBuy) {
    // Up-pointing triangle below the line
    const top = cy + OFFSET
    const pts = `${cx},${top - SIZE} ${cx - SIZE},${top + SIZE} ${cx + SIZE},${top + SIZE}`
    return <polygon points={pts} fill="var(--buy)" opacity={0.9} />
  }
  if (payload?.isSell) {
    // Down-pointing triangle above the line
    const top = cy - OFFSET
    const pts = `${cx},${top + SIZE} ${cx - SIZE},${top - SIZE} ${cx + SIZE},${top - SIZE}`
    return <polygon points={pts} fill="var(--sell)" opacity={0.9} />
  }
  return <g />
}

export function EquityCurveChart({
  equityCurve,
  buydates = [],
  selldates = [],
  buyholdCurve,
  showBuyHoldToggle = false,
  id = 'equity-chart',
}: Props) {
  const [showBuyHold, setShowBuyHold] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)

  const buyholdByDate = new Map((buyholdCurve ?? []).map((p) => [p.date, p.strategy]))
  const buySet = new Set(buydates)
  const sellSet = new Set(selldates)

  // Embed buy/sell flags directly into each data point so the Line's
  // custom dot renderer can position markers exactly on the curve.
  const chartData: ChartPoint[] = equityCurve.map((p) => ({
    date: p.date,
    strategy: p.strategy,
    buyhold: buyholdByDate.get(p.date),
    isBuy: buySet.has(p.date),
    isSell: sellSet.has(p.date),
  }))

  function exportCsv() {
    const rows = ['date,strategy' + (showBuyHold && buyholdCurve ? ',buyhold' : '')]
    for (const p of chartData) {
      let row = `${p.date},${p.strategy}`
      if (showBuyHold && buyholdCurve) row += `,${p.buyhold ?? ''}`
      rows.push(row)
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'equity_curve.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportPng() {
    if (!chartRef.current) return
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(chartRef.current, { backgroundColor: null })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = 'equity_curve.png'
      a.click()
    } catch {
      alert('PNG export requires html2canvas. Run: npm install html2canvas')
    }
  }

  const tickFormatter = (val: string) => val?.slice(0, 4) ?? ''

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        {showBuyHoldToggle && (
          <label className="flex items-center gap-2 text-sm" style={{ color: buyholdCurve ? 'var(--text)' : 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={showBuyHold}
              onChange={(e) => setShowBuyHold(e.target.checked)}
              disabled={!buyholdCurve}
              className="rounded"
            />
            {buyholdCurve ? 'Show Buy & Hold' : 'Show Buy & Hold (loading…)'}
          </label>
        )}
        <button
          onClick={exportCsv}
          className="rounded px-3 py-1 text-sm font-medium"
          style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          Export CSV
        </button>
        <button
          onClick={exportPng}
          className="rounded px-3 py-1 text-sm font-medium"
          style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          Export PNG
        </button>
      </div>

      <div ref={chartRef} id={id} style={{ background: 'var(--bg-card)' }}>
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => `${v.toFixed(1)}x`}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              width={52}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                `${value.toFixed(4)}x`,
                name === 'strategy' ? 'Strategy' : 'Buy & Hold',
              ]}
            />
            <Legend
              formatter={(val) => (val === 'strategy' ? 'Strategy' : 'Buy & Hold')}
              wrapperStyle={{ color: 'var(--text)', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="strategy"
              stroke="var(--accent)"
              dot={StrategyDot}
              activeDot={{ r: 3 }}
              strokeWidth={2}
              name="strategy"
            />
            {showBuyHold && buyholdCurve && (
              <Line
                type="monotone"
                dataKey="buyhold"
                stroke="var(--text-muted)"
                dot={false}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                name="buyhold"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
