import { useState } from 'react'
import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import type { StrategyParams, ParamRange, ParamRanges } from '../types'

export type { ParamRange, ParamRanges }

type Descriptions = Partial<Record<keyof StrategyParams, string>>

// ── Single-value mode ──────────────────────────────────────────────────────

interface SingleProps {
  mode: 'single'
  params: StrategyParams
  onChange: (p: StrategyParams) => void
  collapsed?: boolean
  descriptions?: Descriptions
  disabledFactors?: Set<string>
  onToggleFactor?: (factor: string) => void
}

interface RangeProps {
  mode: 'range'
  ranges: ParamRanges
  onChange: (r: ParamRanges) => void
  collapsed?: boolean
  descriptions?: Descriptions
  disabledFactors?: Set<string>
  onToggleFactor?: (factor: string) => void
}

type Props = SingleProps | RangeProps

// Convert min/max/step → array of values
export function rangeToArray(r: ParamRange, decimals = 6): number[] {
  const out: number[] = []
  const steps = Math.round((r.max - r.min) / r.step)
  for (let i = 0; i <= steps; i++) {
    out.push(parseFloat((r.min + i * r.step).toFixed(decimals)))
  }
  return out
}

export function ParameterPanel(props: Props) {
  const [open, setOpen] = useState(!props.collapsed)

  return (
    <div
      className="rounded-lg border"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
    >
      <button
        className="flex w-full items-center justify-between px-4 py-3 font-semibold"
        style={{ color: 'var(--text)' }}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Parameters</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--border)' }}>
          {props.mode === 'single' ? (
            <SingleForm params={props.params} onChange={props.onChange} descriptions={props.descriptions} disabledFactors={props.disabledFactors} onToggleFactor={props.onToggleFactor} />
          ) : (
            <RangeForm ranges={props.ranges} onChange={props.onChange} descriptions={props.descriptions} disabledFactors={props.disabledFactors} onToggleFactor={props.onToggleFactor} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Single form ─────────────────────────────────────────────────────────────

const SINGLE_FIELDS: { key: keyof StrategyParams; factor: string; label: string; step: string }[] = [
  { key: 'CHG4',       factor: 'CHG4',       label: 'CHG4',             step: '0.001'  },
  { key: 'RET3',       factor: 'RET3',       label: 'RET3',             step: '0.0005' },
  { key: 'YIELD10_CHG4', factor: 'YIELD10_CHG4', label: 'YIELD10_CHG4',      step: '0.01'   },
  { key: 'YIELD2_CHG4',  factor: 'YIELD2_CHG4',  label: 'YIELD2_CHG4',       step: '0.01'   },
  { key: 'CURVE_CHG4', factor: 'CURVE_CHG4', label: 'CURVE_CHG4',      step: '0.05'   },
  { key: 'MA',         factor: 'MA',         label: 'MA (weeks)',       step: '1'      },
  { key: 'DROP',       factor: 'DROP',       label: 'DROP',             step: '0.001'  },
  { key: 'SPREAD_DELTA',factor: 'SPREAD_DELTA',label: 'Δspread (weeks)',step: '1'      },
  { key: 'YIELD10_DELTA', factor: 'YIELD10_DELTA', label: 'Δyield10 (weeks)',step: '1'     },
]

const SELL_FACTORS  = ['CHG4', 'RET3', 'YIELD10_CHG4', 'YIELD2_CHG4', 'CURVE_CHG4']
const BUY_FACTORS   = ['MA', 'DROP', 'SPREAD_DELTA', 'YIELD10_DELTA']

function SingleForm({
  params,
  onChange,
  descriptions,
  disabledFactors,
  onToggleFactor,
}: {
  params: StrategyParams
  onChange: (p: StrategyParams) => void
  descriptions?: Descriptions
  disabledFactors?: Set<string>
  onToggleFactor?: (factor: string) => void
}) {
  function set<K extends keyof StrategyParams>(key: K, val: string) {
    onChange({ ...params, [key]: parseFloat(val) || 0 })
  }

  const showCheckboxes = disabledFactors !== undefined && onToggleFactor !== undefined

  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sell Factors</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-3">
        {SINGLE_FIELDS.filter(f => SELL_FACTORS.includes(f.factor)).map(f => {
          const off = disabledFactors?.has(f.factor)
          return (
            <div key={f.key} className="flex items-end gap-2" style={{ opacity: off ? 0.45 : 1 }}>
              {showCheckboxes && <FactorCheckbox checked={!off} onChange={() => onToggleFactor!(f.factor)} />}
              <div className="flex-1">
                <Field label={f.label} value={String(params[f.key])} onChange={(v) => set(f.key, v)} step={f.step} tooltip={descriptions?.[f.key]} disabled={off} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Buy Factors</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SINGLE_FIELDS.filter(f => BUY_FACTORS.includes(f.factor)).map(f => {
          const off = disabledFactors?.has(f.factor)
          return (
            <div key={f.key} className="flex items-end gap-2" style={{ opacity: off ? 0.45 : 1 }}>
              {showCheckboxes && <FactorCheckbox checked={!off} onChange={() => onToggleFactor!(f.factor)} />}
              <div className="flex-1">
                <Field label={f.label} value={String(params[f.key])} onChange={(v) => set(f.key, v)} step={f.step} tooltip={descriptions?.[f.key]} disabled={off} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Range form ──────────────────────────────────────────────────────────────

const PARAM_LABELS: Record<keyof ParamRanges, string> = {
  MA:          'MA (weeks)',
  DROP:        'DROP',
  CHG4:        'CHG4',
  RET3:        'RET3',
  YIELD10_CHG4:  'YIELD10_CHG4',
  YIELD2_CHG4:   'YIELD2_CHG4',
  CURVE_CHG4:  'CURVE_CHG4',
  SPREAD_DELTA:'Δspread (weeks)',
  YIELD10_DELTA: 'Δyield10 (weeks)',
}

const RANGE_SELL_KEYS: (keyof ParamRanges)[] = ['CHG4', 'RET3', 'YIELD10_CHG4', 'YIELD2_CHG4', 'CURVE_CHG4']
const RANGE_BUY_KEYS:  (keyof ParamRanges)[] = ['MA', 'DROP', 'SPREAD_DELTA', 'YIELD10_DELTA']

function RangeForm({
  ranges,
  onChange,
  descriptions,
  disabledFactors,
  onToggleFactor,
}: {
  ranges: ParamRanges
  onChange: (r: ParamRanges) => void
  descriptions?: Descriptions
  disabledFactors?: Set<string>
  onToggleFactor?: (factor: string) => void
}) {
  const showCheckboxes = disabledFactors !== undefined && onToggleFactor !== undefined

  function setField(param: keyof ParamRanges, field: keyof ParamRange, val: string) {
    onChange({
      ...ranges,
      [param]: { ...ranges[param], [field]: parseFloat(val) || 0 },
    })
  }

  function renderRow(param: keyof ParamRanges) {
    const off = disabledFactors?.has(param)
    return (
      <div key={param} className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 items-center" style={{ opacity: off ? 0.45 : 1 }}>
        <div className="flex items-center gap-1" style={{ minWidth: showCheckboxes ? 130 : 110 }}>
          {showCheckboxes && <FactorCheckbox checked={!off} onChange={() => onToggleFactor!(param)} />}
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {PARAM_LABELS[param]}
          </span>
          {descriptions?.[param] && <InfoTooltip text={descriptions[param]!} />}
        </div>
        <Field value={String(ranges[param].min)}  onChange={(v) => setField(param, 'min',  v)} step={String(ranges[param].step)} disabled={off} />
        <Field value={String(ranges[param].max)}  onChange={(v) => setField(param, 'max',  v)} step={String(ranges[param].step)} disabled={off} />
        <Field value={String(ranges[param].step)} onChange={(v) => setField(param, 'step', v)} step={param === 'MA' ? '1' : '0.0001'} disabled={off} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        <span style={{ minWidth: showCheckboxes ? 130 : 110 }}>Parameter</span>
        <span>Min</span>
        <span>Max</span>
        <span>Step</span>
      </div>

      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sell Factors</div>
      {RANGE_SELL_KEYS.map(renderRow)}

      <div className="text-xs font-semibold uppercase tracking-wide pt-1" style={{ color: 'var(--text-muted)' }}>Buy Factors</div>
      {RANGE_BUY_KEYS.map(renderRow)}
    </div>
  )
}

// ── Shared input field ───────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  step,
  tooltip,
  disabled,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  step?: string
  tooltip?: string
  disabled?: boolean
}) {
  const [local, setLocal] = useState(value)
  const [editing, setEditing] = useState(false)

  if (!editing && local !== value) setLocal(value)

  function commit() {
    setEditing(false)
    const n = parseFloat(local)
    if (!isNaN(n)) {
      onChange(String(n))
    } else {
      setLocal(value)
    }
  }

  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {label}
          </label>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
      )}
      <input
        type="number"
        value={editing ? local : value}
        step={step}
        disabled={disabled}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          setEditing(true)
          setLocal(e.target.value)
          const n = parseFloat(e.target.value)
          if (!isNaN(n)) onChange(String(n))
        }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
        className="w-full rounded border px-2 py-1.5 text-sm disabled:opacity-50"
        style={{
          background: 'var(--bg-input)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      />
    </div>
  )
}

// ── Checkbox ─────────────────────────────────────────────────────────────────

function FactorCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border mb-1 shrink-0 cursor-pointer accent-[var(--accent)]"
      style={{ borderColor: 'var(--border)' }}
      title={checked ? 'Factor enabled — click to disable' : 'Factor disabled — click to enable'}
    />
  )
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Info size={11} style={{ color: 'var(--text-muted)', cursor: 'default', flexShrink: 0 }} />
      {show && (
        <span
          className="absolute bottom-full left-1/2 mb-1.5 w-56 -translate-x-1/2 rounded border px-2 py-1.5 text-xs shadow-lg"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
            zIndex: 50,
            lineHeight: '1.45',
            pointerEvents: 'none',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
