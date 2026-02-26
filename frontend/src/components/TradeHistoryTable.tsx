import type { TradeEvent } from '../types'

interface Props {
  trades: TradeEvent[]
}

function fmt(v: number | null | undefined, decimals = 4): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(decimals)
}

export function TradeHistoryTable({ trades }: Props) {
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
              <Td>{fmt(t.price, 2)}</Td>
              <Td>{fmt(t.spread, 2)}</Td>
              <Td>{fmt(t.chg4, 4)}</Td>
              <Td>{fmt(t.ret3, 4)}</Td>
              <Td>{fmt(t.spread_delta, 4)}</Td>
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

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>
}
