interface Props {
  apy: number
  finalValue: number
  extra?: Array<{ label: string; value: string }>
}

export function MetricsCard({ apy, finalValue, extra }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Metric label="APY" value={`${(apy * 100).toFixed(2)}%`} highlight />
      <Metric label="Final Value" value={`${finalValue.toFixed(4)}x`} />
      {extra?.map((e) => (
        <Metric key={e.label} label={e.label} value={e.value} />
      ))}
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-lg border p-3 text-center"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div
        className="mt-1 text-xl font-bold"
        style={{ color: highlight ? 'var(--accent)' : 'var(--text)' }}
      >
        {value}
      </div>
    </div>
  )
}
