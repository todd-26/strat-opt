import { useRef, useState } from 'react'
import {
  ComposedChart,
  Line,
  Scatter,
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
}

interface MarkerPoint {
  date: string
  value: number
}

interface Props {
  equityCurve: EquityPoint[]
  buydates?: string[]
  selldates?: string[]
  buyholdCurve?: EquityPoint[]
  showBuyHoldToggle?: boolean
  id?: string
}

// Custom triangle dots for buy/sell scatter
const BuyDot = (props: { cx?: number; cy?: number }) => {
  const { cx = 0, cy = 0 } = props
  const size = 8
  const points = `${cx},${cy - size} ${cx - size},${cy + size} ${cx + size},${cy + size}`
  return <polygon points={points} fill="var(--buy)" opacity={0.85} />
}

const SellDot = (props: { cx?: number; cy?: number }) => {
  const { cx = 0, cy = 0 } = props
  const size = 8
  const points = `${cx},${cy + size} ${cx - size},${cy - size} ${cx + size},${cy - size}`
  return <polygon points={points} fill="var(--sell)" opacity={0.85} />
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

  // Build merged chart data
  const buyholdByDate = new Map((buyholdCurve ?? []).map((p) => [p.date, p.strategy]))

  const chartData: ChartPoint[] = equityCurve.map((p) => ({
    date: p.date,
    strategy: p.strategy,
    buyhold: buyholdByDate.get(p.date),
  }))

  // Build buy/sell marker datasets aligned to strategy values
  const strategyByDate = new Map(equityCurve.map((p) => [p.date, p.strategy]))

  const buyMarkers: MarkerPoint[] = buydates
    .map((d) => ({ date: d, value: strategyByDate.get(d) ?? 0 }))
    .filter((m) => m.value > 0)

  const sellMarkers: MarkerPoint[] = selldates
    .map((d) => ({ date: d, value: strategyByDate.get(d) ?? 0 }))
    .filter((m) => m.value > 0)

  // CSV export
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

  // PNG export via html2canvas
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

  // X-axis tick formatter: show year only
  const tickFormatter = (val: string) => val?.slice(0, 4) ?? ''

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        {showBuyHoldToggle && buyholdCurve && (
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input
              type="checkbox"
              checked={showBuyHold}
              onChange={(e) => setShowBuyHold(e.target.checked)}
              className="rounded"
            />
            Show Buy &amp; Hold
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
              dot={false}
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
            {buyMarkers.length > 0 && (
              <Scatter
                data={buyMarkers}
                dataKey="value"
                name="Buy"
                shape={<BuyDot />}
                legendType="none"
              />
            )}
            {sellMarkers.length > 0 && (
              <Scatter
                data={sellMarkers}
                dataKey="value"
                name="Sell"
                shape={<SellDot />}
                legendType="none"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
