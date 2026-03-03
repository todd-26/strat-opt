import type { TradeEvent, StrategyParams } from '../types'

interface Props {
  trades: TradeEvent[]
  params?: StrategyParams
}

function fmt(v: number | null | undefined, decimals = 4): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(decimals)
}

function isBoldCell(t: TradeEvent, col: keyof TradeEvent, params?: StrategyParams): boolean {
  if (!params) return false
  if (t.action === 'SELL') {
    if (col === 'spread')      return t.spread != null && t.spread > params.SPREAD_LVL
    if (col === 'chg4')        return t.chg4 != null && t.chg4 > params.CHG4
    if (col === 'ret3')        return t.ret3 != null && t.ret3 < params.RET3
  }
  if (t.action === 'BUY') {
    if (col === 'price' || col === 'ma_value') return true
    if (col === 'spread_delta') return t.spread_delta != null && t.spread_delta < 0
  }
  return false
}

export function TradeHistoryTable({ trades, params }: Props) {
  if (!trades.length) {
    return <p style={{ color: 'var(--text-muted)' }}>No trades recorded.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
            <Th>Date</Th>
            <Th>Action</Th>
            <Th>Price</Th>
            <Th>MA</Th>
            <Th>Spread</Th>
            <Th>chg4</Th>
            <Th>ret3</Th>
            <Th>Δspread</Th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr
              key={i}
              style={{
                background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-input)',
                color: 'var(--text)',
              }}
            >
              <Td>{t.date}</Td>
              <Td>
                <span
                  className="rounded px-2 py-0.5 text-xs font-bold text-white"
                  style={{ background: t.action === 'BUY' ? 'var(--buy)' : 'var(--sell)' }}
                >
                  {t.action}
                </span>
              </Td>
              <Td bold={isBoldCell(t, 'price', params)}>{fmt(t.price, 2)}</Td>
              <Td bold={isBoldCell(t, 'ma_value', params)}>{fmt(t.ma_value, 2)}</Td>
              <Td bold={isBoldCell(t, 'spread', params)}>{fmt(t.spread, 2)}</Td>
              <Td bold={isBoldCell(t, 'chg4', params)}>{fmt(t.chg4, 4)}</Td>
              <Td bold={isBoldCell(t, 'ret3', params)}>{fmt(t.ret3, 4)}</Td>
              <Td bold={isBoldCell(t, 'spread_delta', params)}>{fmt(t.spread_delta, 4)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-xs">{children}</th>
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td className="px-3 py-2" style={bold ? { fontWeight: 700 } : undefined}>
      {children}
    </td>
  )
}
