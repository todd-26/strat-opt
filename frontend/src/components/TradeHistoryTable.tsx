import { useState, useEffect } from 'react'
import { Info } from 'lucide-react'
import type { TradeEvent, StrategyParams } from '../types'

interface Props {
  trades: TradeEvent[]
  params?: StrategyParams
  disabledFactors?: Set<string>
}

interface Popup {
  title: string
  lines: string[]
  x: number
  y: number
}

function fmt(v: number | null | undefined, decimals = 4): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(decimals)
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return (v * 100).toFixed(2) + '%'
}

const COL_FACTOR_MAP: Partial<Record<keyof TradeEvent, string>> = {
  spread: 'SPREAD_LVL',
  chg4: 'CHG4',
  ret3: 'RET3',
  price: 'MA',
  ma_value: 'MA',
  spread_drop: 'DROP',
  spread_delta: 'SPREAD_DELTA',
  yield10_chg4: 'YIELD10_CHG4',
  yield2_chg4: 'YIELD2_CHG4',
  curve_chg4: 'CURVE_CHG4',
  yield10_delta: 'YIELD10_DELTA',
}

function isBoldCell(t: TradeEvent, col: keyof TradeEvent, params?: StrategyParams, disabledFactors?: Set<string>): boolean {
  if (!params) return false
  const factor = COL_FACTOR_MAP[col]
  if (factor && disabledFactors?.has(factor)) return false
  if (t.action === 'SELL') {
    if (col === 'spread')       return t.spread != null && t.spread > params.SPREAD_LVL
    if (col === 'chg4')         return t.chg4 != null && t.chg4 > params.CHG4
    if (col === 'ret3')         return t.ret3 != null && t.ret3 < params.RET3
    if (col === 'yield10_chg4') return t.yield10_chg4 != null && t.yield10_chg4 > params.YIELD10_CHG4
    if (col === 'yield2_chg4')  return t.yield2_chg4 != null && t.yield2_chg4 > params.YIELD2_CHG4
    if (col === 'curve_chg4')   return t.curve_chg4 != null && t.curve_chg4 < -params.CURVE_CHG4
  }
  if (t.action === 'BUY') {
    if (col === 'price' || col === 'ma_value') return true
    if (col === 'spread_delta')  return t.spread_delta != null && t.spread_delta < 0
    if (col === 'spread_drop')   return t.spread_drop != null && t.spread_drop >= params.DROP
    if (col === 'yield10_delta') return t.yield10_delta != null && t.yield10_delta < 0
  }
  return false
}

function getPopup(t: TradeEvent, col: keyof TradeEvent, params: StrategyParams, disabledFactors?: Set<string>): { title: string; lines: string[] } | null {
  const factor = COL_FACTOR_MAP[col]
  if (factor && disabledFactors?.has(factor)) return null
  if (t.action === 'SELL') {
    if (col === 'spread') return {
      title: 'Sell Rule: Spread Level',
      lines: [
        `Spread:     ${fmt(t.spread, 2)}`,
        `Threshold:  ${fmt(params.SPREAD_LVL, 2)}`,
        `${fmt(t.spread, 2)} > ${fmt(params.SPREAD_LVL, 2)}  →  sell triggered`,
      ],
    }
    if (col === 'chg4') {
      const lines = [
        `4-wk change:  ${fmtPct(t.chg4)}`,
        `Threshold:    ${fmtPct(params.CHG4)}`,
        `${fmtPct(t.chg4)} > ${fmtPct(params.CHG4)}  →  sell triggered`,
      ]
      if (t.spread_4wk_ago != null && t.spread != null)
        lines.push(`Spread: ${fmt(t.spread_4wk_ago, 2)} (4 wks ago)  →  ${fmt(t.spread, 2)} (now)`)
      return { title: 'Sell Rule: 4-Week Spread Change', lines }
    }
    if (col === 'ret3') {
      const lines = [
        `3-wk return:  ${fmtPct(t.ret3)}`,
        `Threshold:    ${fmtPct(params.RET3)}`,
        `${fmtPct(t.ret3)} < ${fmtPct(params.RET3)}  →  sell triggered`,
      ]
      if (t.close_3wk_ago != null)
        lines.push(`Price: $${fmt(t.close_3wk_ago, 2)} (3 wks ago)  →  $${fmt(t.price, 2)} (now)`)
      return { title: 'Sell Rule: 3-Week Price Return', lines }
    }
  }
  if (t.action === 'BUY') {
    if (col === 'price' || col === 'ma_value') return {
      title: 'Buy Rule: Price Above MA',
      lines: [
        `Close:  $${fmt(t.price, 4)}`,
        `MA:      $${fmt(t.ma_value, 4)}`,
        `$${fmt(t.price, 4)} > $${fmt(t.ma_value, 4)}  →  uptrend confirmed`,
      ],
    }
    if (col === 'spread_drop') return {
      title: 'Buy Rule: Spread Drop from Peak',
      lines: [
        `4-wk peak:   ${fmt(t.spread_4wk_peak, 2)}`,
        `Current:     ${fmt(t.spread, 2)}`,
        `Drop:        ${fmtPct(t.spread_drop)}`,
        `Threshold:   ${fmtPct(params.DROP)}`,
        `${fmtPct(t.spread_drop)} ≥ ${fmtPct(params.DROP)}  →  spread retreated enough`,
      ],
    }
    if (col === 'spread_delta') {
      const n = params?.SPREAD_DELTA ?? 2
      const lines: string[] = []
      if (t.spread_delta_history?.length) {
        t.spread_delta_history.forEach((v, i) => {
          const label = i === t.spread_delta_history!.length - 1 ? 'This week' : `${t.spread_delta_history!.length - 1 - i} week(s) ago`
          lines.push(`${label}:  ${fmt(v, 4)}`)
        })
      } else {
        lines.push(`Δspread:  ${fmt(t.spread_delta, 4)}`)
      }
      lines.push(`All ${n} negative  →  spreads actively falling`)
      return { title: 'Buy Rule: Falling Spreads', lines }
    }
    if (col === 'yield10_delta') {
      const n = params?.YIELD10_DELTA ?? 2
      const lines: string[] = []
      if (t.yield10_delta_history?.length) {
        t.yield10_delta_history.forEach((v, i) => {
          const label = i === t.yield10_delta_history!.length - 1 ? 'This week' : `${t.yield10_delta_history!.length - 1 - i} week(s) ago`
          lines.push(`${label}:  ${fmt(v, 4)}`)
        })
      } else {
        lines.push(`Δyield10:  ${fmt(t.yield10_delta, 4)}`)
      }
      lines.push(`All ${n} negative  →  10yr yield actively falling`)
      return { title: 'Buy Rule: Falling 10yr Yield', lines }
    }
  }
  if (t.action === 'SELL') {
    if (col === 'yield10_chg4') {
      const lines = [
        `4-wk change:  ${fmtPct(t.yield10_chg4)}`,
        `Threshold:    ${fmtPct(params.YIELD10_CHG4)}`,
        `${fmtPct(t.yield10_chg4)} > ${fmtPct(params.YIELD10_CHG4)}  →  sell triggered`,
      ]
      if (t.yield10_4wk_ago != null && t.yield10_delta != null)
        lines.push(`10yr yield: ${fmt(t.yield10_4wk_ago, 2)}% (4 wks ago)  →  current`)
      return { title: 'Sell Rule: 10yr Yield 4-Week Change', lines }
    }
    if (col === 'yield2_chg4') {
      const lines = [
        `4-wk change:  ${fmtPct(t.yield2_chg4)}`,
        `Threshold:    ${fmtPct(params.YIELD2_CHG4)}`,
        `${fmtPct(t.yield2_chg4)} > ${fmtPct(params.YIELD2_CHG4)}  →  sell triggered`,
      ]
      if (t.yield2_4wk_ago != null)
        lines.push(`2yr yield: ${fmt(t.yield2_4wk_ago, 2)}% (4 wks ago)  →  current`)
      return { title: 'Sell Rule: 2yr Yield 4-Week Change', lines }
    }
    if (col === 'curve_chg4') {
      const lines = [
        `4-wk change:  ${fmt(t.curve_chg4, 4)}`,
        `Threshold:    −${fmt(params.CURVE_CHG4, 2)}`,
        `${fmt(t.curve_chg4, 4)} < −${fmt(params.CURVE_CHG4, 2)}  →  sell triggered`,
      ]
      if (t.curve_4wk_ago != null)
        lines.push(`Yield curve: ${fmt(t.curve_4wk_ago, 2)} (4 wks ago)  →  current`)
      return { title: 'Sell Rule: Yield Curve Flattening', lines }
    }
  }
  return null
}

export function TradeHistoryTable({ trades, params, disabledFactors }: Props) {
  const [popup, setPopup] = useState<Popup | null>(null)

  useEffect(() => {
    if (!popup) return
    const dismiss = () => setPopup(null)
    document.addEventListener('click', dismiss)
    return () => document.removeEventListener('click', dismiss)
  }, [popup])

  if (!trades.length) {
    return <p style={{ color: 'var(--text-muted)' }}>No trades recorded.</p>
  }

  function handleBoldClick(e: React.MouseEvent, t: TradeEvent, col: keyof TradeEvent) {
    if (!params) return
    const info = getPopup(t, col, params, disabledFactors)
    if (!info) return
    e.stopPropagation()
    // Keep popup on screen
    const x = Math.min(e.clientX + 8, window.innerWidth - 300)
    const y = Math.min(e.clientY + 8, window.innerHeight - 180)
    setPopup({ ...info, x, y })
  }

  function boldClick(t: TradeEvent, col: keyof TradeEvent) {
    if (!isBoldCell(t, col, params, disabledFactors) || !params) return undefined
    return (e: React.MouseEvent) => handleBoldClick(e, t, col)
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
              <Th>Date</Th>
              <Th>Action</Th>
              <Th tooltip="Closing price at trade date. Bold on BUY: close must be above MA.">Price</Th>
              <Th tooltip="n-week moving average of close price. Bold on BUY: close must be above MA.">MA</Th>
              <Th tooltip="Credit spread at trade date. Sell rule: triggers if spread > SPREAD_LVL threshold.">Spread</Th>
              <Th tooltip="% drop from 4-week spread peak. Buy rule: must drop at least DROP threshold.">Drop</Th>
              <Th tooltip={`4-week % change in credit spread (BAMLH0A0HYM2). Sell rule: triggers if chg4 > ${params?.CHG4 ?? 'CHG4'} threshold.`}>chg4</Th>
              <Th tooltip="3-week price return. Sell rule: triggers if ret3 < RET3 threshold.">ret3</Th>
              <Th tooltip={`Week-over-week change in credit spread. Buy rule: last ${params?.SPREAD_DELTA ?? 2} consecutive values must all be negative.`}>Δspread</Th>
              <Th tooltip={`4-week % change in 10yr Treasury yield (DGS10), not the credit spread. Sell rule: triggers if > ${params?.YIELD10_CHG4 ?? 'YIELD10_CHG4'} threshold.`}>Δ10yr%</Th>
              <Th tooltip={`4-week % change in 2yr Treasury yield (DGS2), not the credit spread. Sell rule: triggers if > ${params?.YIELD2_CHG4 ?? 'YIELD2_CHG4'} threshold.`}>Δ2yr%</Th>
              <Th tooltip="4-week absolute change in yield curve (10y-2y). Sell rule: triggers if flattens more than CURVE_CHG4.">ΔCurve</Th>
              <Th tooltip={`Week-over-week change in 10yr yield. Buy rule: last ${params?.YIELD10_DELTA ?? 2} consecutive values must all be negative.`} tooltipAlign="right">Δyield10</Th>
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
                <Td bold={isBoldCell(t, 'price', params)} onClick={boldClick(t, 'price')}>{fmt(t.price, 2)}</Td>
                <Td bold={isBoldCell(t, 'ma_value', params)} onClick={boldClick(t, 'ma_value')}>{fmt(t.ma_value, 2)}</Td>
                <Td bold={isBoldCell(t, 'spread', params)} onClick={boldClick(t, 'spread')}>{fmt(t.spread, 2)}</Td>
                <Td bold={isBoldCell(t, 'spread_drop', params)} onClick={boldClick(t, 'spread_drop')}>{fmtPct(t.spread_drop)}</Td>
                <Td bold={isBoldCell(t, 'chg4', params)} onClick={boldClick(t, 'chg4')}>{fmt(t.chg4, 4)}</Td>
                <Td bold={isBoldCell(t, 'ret3', params)} onClick={boldClick(t, 'ret3')}>{fmt(t.ret3, 4)}</Td>
                <Td bold={isBoldCell(t, 'spread_delta', params)} onClick={boldClick(t, 'spread_delta')}>{fmt(t.spread_delta, 4)}</Td>
                <Td bold={isBoldCell(t, 'yield10_chg4', params)} onClick={boldClick(t, 'yield10_chg4')}>{fmt(t.yield10_chg4, 4)}</Td>
                <Td bold={isBoldCell(t, 'yield2_chg4', params)} onClick={boldClick(t, 'yield2_chg4')}>{fmt(t.yield2_chg4, 4)}</Td>
                <Td bold={isBoldCell(t, 'curve_chg4', params)} onClick={boldClick(t, 'curve_chg4')}>{fmt(t.curve_chg4, 4)}</Td>
                <Td bold={isBoldCell(t, 'yield10_delta', params)} onClick={boldClick(t, 'yield10_delta')}>{fmt(t.yield10_delta, 4)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {popup && (
        <div
          style={{
            position: 'fixed',
            left: popup.x,
            top: popup.y,
            zIndex: 1000,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '10px 14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            minWidth: 220,
            maxWidth: 290,
            pointerEvents: 'none',
          }}
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {popup.title}
          </div>
          {popup.lines.map((line, i) => (
            <div key={i} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text)', lineHeight: 1.8 }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Th({ children, tooltip, tooltipAlign }: { children: React.ReactNode; tooltip?: string; tooltipAlign?: 'center' | 'right' }) {
  return (
    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-xs">
      <span className="inline-flex items-center gap-1">
        {children}
        {tooltip && <InfoTooltip text={tooltip} align={tooltipAlign} />}
      </span>
    </th>
  )
}

function InfoTooltip({ text, align = 'center' }: { text: string; align?: 'center' | 'right' }) {
  const [show, setShow] = useState(false)
  const posClass = align === 'right'
    ? 'absolute top-full right-0 mt-1.5 w-56 rounded border px-2 py-1.5 text-xs shadow-lg'
    : 'absolute top-full left-1/2 mt-1.5 w-56 -translate-x-1/2 rounded border px-2 py-1.5 text-xs shadow-lg'
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Info size={11} style={{ color: 'var(--text-muted)', cursor: 'default', flexShrink: 0 }} />
      {show && (
        <span
          className={posClass}
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
            zIndex: 50,
            lineHeight: '1.45',
            pointerEvents: 'none',
            fontWeight: 'normal',
            textTransform: 'none',
            letterSpacing: 'normal',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}

function Td({ children, bold, onClick }: { children: React.ReactNode; bold?: boolean; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <td
      className="px-3 py-2"
      style={{
        fontWeight: bold ? 700 : undefined,
        cursor: bold && onClick ? 'pointer' : undefined,
        textDecoration: bold && onClick ? 'underline dotted' : undefined,
      }}
      onClick={onClick}
    >
      {children}
    </td>
  )
}
