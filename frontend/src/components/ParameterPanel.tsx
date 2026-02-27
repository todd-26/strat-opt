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
}

interface RangeProps {
  mode: 'range'
  ranges: ParamRanges
  onChange: (r: ParamRanges) => void
  collapsed?: boolean
  descriptions?: Descriptions
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
            <SingleForm params={props.params} onChange={props.onChange} descriptions={props.descriptions} />
          ) : (
            <RangeForm ranges={props.ranges} onChange={props.onChange} descriptions={props.descriptions} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Single form ─────────────────────────────────────────────────────────────

function SingleForm({
  params,
  onChange,
  descriptions,
}: {
  params: StrategyParams
  onChange: (p: StrategyParams) => void
  descriptions?: Descriptions
}) {
  function set<K extends keyof StrategyParams>(key: K, val: string) {
    onChange({ ...params, [key]: parseFloat(val) || 0 })
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Field label="MA (weeks)" value={String(params.MA)} onChange={(v) => set('MA', v)} step="1" tooltip={descriptions?.MA} />
      <Field label="DROP" value={String(params.DROP)} onChange={(v) => set('DROP', v)} step="0.001" tooltip={descriptions?.DROP} />
      <Field label="CHG4" value={String(params.CHG4)} onChange={(v) => set('CHG4', v)} step="0.001" tooltip={descriptions?.CHG4} />
      <Field label="RET3" value={String(params.RET3)} onChange={(v) => set('RET3', v)} step="0.001" tooltip={descriptions?.RET3} />
      <Field label="SPREAD_LVL" value={String(params.SPREAD_LVL)} onChange={(v) => set('SPREAD_LVL', v)} step="0.1" tooltip={descriptions?.SPREAD_LVL} />
    </div>
  )
}

// ── Range form ──────────────────────────────────────────────────────────────

const PARAM_LABELS: Record<keyof ParamRanges, string> = {
  MA: 'MA (weeks)',
  DROP: 'DROP',
  CHG4: 'CHG4',
  RET3: 'RET3',
  SPREAD_LVL: 'SPREAD_LVL',
}

function RangeForm({
  ranges,
  onChange,
  descriptions,
}: {
  ranges: ParamRanges
  onChange: (r: ParamRanges) => void
  descriptions?: Descriptions
}) {
  function setField(param: keyof ParamRanges, field: keyof ParamRange, val: string) {
    onChange({
      ...ranges,
      [param]: { ...ranges[param], [field]: parseFloat(val) || 0 },
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        <span>Parameter</span>
        <span>Min</span>
        <span>Max</span>
        <span>Step</span>
      </div>
      {(Object.keys(ranges) as (keyof ParamRanges)[]).map((param) => (
        <div key={param} className="grid grid-cols-4 gap-2 items-center">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {PARAM_LABELS[param]}
            </span>
            {descriptions?.[param] && <InfoTooltip text={descriptions[param]!} />}
          </div>
          <Field
            value={String(ranges[param].min)}
            onChange={(v) => setField(param, 'min', v)}
            step={String(ranges[param].step)}
          />
          <Field
            value={String(ranges[param].max)}
            onChange={(v) => setField(param, 'max', v)}
            step={String(ranges[param].step)}
          />
          <Field
            value={String(ranges[param].step)}
            onChange={(v) => setField(param, 'step', v)}
            step={param === 'MA' ? '1' : '0.0001'}
          />
        </div>
      ))}
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
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  step?: string
  tooltip?: string
}) {
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
        value={value}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border px-2 py-1.5 text-sm"
        style={{
          background: 'var(--bg-input)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      />
    </div>
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
