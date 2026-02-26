interface Props {
  signal: 'BUY' | 'SELL' | 'HOLD'
}

const config = {
  BUY: { bg: 'var(--buy)', label: '▲ BUY' },
  SELL: { bg: 'var(--sell)', label: '▼ SELL' },
  HOLD: { bg: 'var(--hold)', label: '● HOLD' },
}

export function SignalBadge({ signal }: Props) {
  const { bg, label } = config[signal]
  return (
    <div
      className="flex h-32 w-full items-center justify-center rounded-xl text-4xl font-black tracking-widest text-white shadow-lg"
      style={{ background: bg }}
    >
      {label}
    </div>
  )
}
