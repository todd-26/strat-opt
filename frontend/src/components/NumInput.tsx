import { useState, useEffect, useRef } from 'react'

/**
 * Number input that allows typing intermediate values like "-", "0.", "-0.02"
 * without the value being clobbered by parseFloat during editing.
 * Commits the parsed number on blur or Enter.
 */
export function NumInput({
  value,
  onChange,
  step,
  className,
  style,
}: {
  value: number
  onChange: (n: number) => void
  step?: string
  className?: string
  style?: React.CSSProperties
}) {
  const [local, setLocal] = useState(String(value))
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setLocal(String(value))
  }, [value])

  function commit() {
    editing.current = false
    const n = parseFloat(local)
    if (!isNaN(n)) {
      onChange(n)
    } else {
      setLocal(String(value))
    }
  }

  return (
    <input
      type="number"
      value={editing.current ? local : String(value)}
      step={step}
      onFocus={() => { editing.current = true }}
      onChange={(e) => { editing.current = true; setLocal(e.target.value) }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
      className={className}
      style={style}
    />
  )
}
