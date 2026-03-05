import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { themes } from '../lib/themes'
import { NumInput } from './NumInput'
import type { AppConfig, DefaultParams, ParamRanges, Settings } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
  config: AppConfig
  onSaveConfig: (c: AppConfig) => Promise<void>
  ticker: string
}

export function SettingsSheet({ open, onClose, settings, onUpdate, config, onSaveConfig, ticker }: Props) {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Sync localConfig when the drawer opens so it reflects latest saved state
  useEffect(() => {
    if (open) {
      setLocalConfig(config)
      setSaveStatus('idle')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  async function handleSavePermanently() {
    setSaveStatus('saving')
    try {
      await onSaveConfig(localConfig)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }

  function saveButtonLabel() {
    switch (saveStatus) {
      case 'saving': return 'Saving…'
      case 'saved':  return 'Saved!'
      case 'error':  return 'Error — try again'
      default:       return 'Save Permanently'
    }
  }

  const PARAM_KEYS = ['MA', 'DROP', 'CHG4', 'RET3', 'SPREAD_LVL'] as const
  type ParamKey = typeof PARAM_KEYS[number]
  const PARAM_STEPS: Record<ParamKey, string> = { MA: '1', DROP: '0.001', CHG4: '0.005', RET3: '0.0005', SPREAD_LVL: '0.5' }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-96 overflow-y-auto shadow-xl"
        style={{ background: 'var(--bg-card)', color: 'var(--text)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="font-semibold">Settings</span>
          <button onClick={onClose} className="rounded p-1 hover:opacity-70">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-4">
          {/* Theme */}
          <Section title="Theme">
            <div className="space-y-2">
              {themes.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5"
                  style={{
                    borderColor: settings.theme === t.id ? 'var(--accent)' : 'var(--border)',
                    background: settings.theme === t.id ? 'var(--bg-input)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={t.id}
                    checked={settings.theme === t.id}
                    onChange={() => onUpdate({ theme: t.id })}
                    className="sr-only"
                  />
                  {/* Color preview swatches */}
                  <div className="flex gap-1">
                    <Swatch color={t.vars['--bg-header']} />
                    <Swatch color={t.vars['--accent']} />
                    <Swatch color={t.vars['--bg']} />
                  </div>
                  <span className="text-sm">{t.label}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Data source */}
          <Section title="Data Source">
            <div className="flex gap-3">
              {(['csv', 'api'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="inputType"
                    value={v}
                    checked={settings.inputType === v}
                    onChange={() => onUpdate({ inputType: v })}
                  />
                  {v === 'csv' ? 'CSV (default)' : 'Live API'}
                </label>
              ))}
            </div>
          </Section>

          {/* Run defaults (per-security, saved to config.json) */}
          <Section title={`Run Defaults — ${ticker}`}>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Cash Rate (annual)
                </label>
                <NumInput
                  value={localConfig.cashRate}
                  step="0.0025"
                  onChange={(n) => setLocalConfig((prev) => ({ ...prev, cashRate: n }))}
                  className="w-32 rounded border px-2 py-1.5 text-sm"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Starting Position
                </label>
                <div className="flex gap-3">
                  {([1, 0] as const).map((v) => (
                    <label key={v} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="startInvested"
                        value={v}
                        checked={localConfig.startInvested === v}
                        onChange={() => setLocalConfig((prev) => ({ ...prev, startInvested: v }))}
                      />
                      {v === 1 ? 'Invested' : 'Cash'}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Disabled Factors */}
          <Section title={`Disabled Factors — ${ticker}`}>
            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Sell Factors</span>
                <div className="mt-1 space-y-1">
                  {(['SPREAD_LVL', 'CHG4', 'RET3'] as const).map((f) => (
                    <label key={f} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={localConfig.disabledFactors.includes(f)}
                        onChange={() =>
                          setLocalConfig((prev) => ({
                            ...prev,
                            disabledFactors: prev.disabledFactors.includes(f)
                              ? prev.disabledFactors.filter((x) => x !== f)
                              : [...prev.disabledFactors, f],
                          }))
                        }
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Buy Factors</span>
                <div className="mt-1 space-y-1">
                  {(['MA', 'DROP', 'SPREAD_DELTA'] as const).map((f) => (
                    <label key={f} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={localConfig.disabledFactors.includes(f)}
                        onChange={() =>
                          setLocalConfig((prev) => ({
                            ...prev,
                            disabledFactors: prev.disabledFactors.includes(f)
                              ? prev.disabledFactors.filter((x) => x !== f)
                              : [...prev.disabledFactors, f],
                          }))
                        }
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Default parameters */}
          <Section title={`Default Parameters — ${ticker}`}>
            <div className="space-y-3">
              <div
                className="grid gap-2 text-xs font-semibold uppercase tracking-wide"
                style={{ gridTemplateColumns: '5rem 6rem 1fr', color: 'var(--text-muted)' }}
              >
                <span>Param</span>
                <span>Value</span>
                <span>Description</span>
              </div>
              {PARAM_KEYS.map((key) => {
                const entry = localConfig.defaultParams[key as keyof DefaultParams]
                return (
                  <div key={key} className="grid items-center gap-2" style={{ gridTemplateColumns: '5rem 6rem 1fr' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{key}</span>
                    <NumInput
                      value={entry.value}
                      step={PARAM_STEPS[key]}
                      onChange={(n) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          defaultParams: {
                            ...prev.defaultParams,
                            [key]: { ...prev.defaultParams[key as keyof DefaultParams], value: n },
                          },
                        }))
                      }
                      className="w-full rounded border px-2 py-1 text-sm"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    />
                    <input
                      type="text"
                      value={entry.desc}
                      placeholder="description"
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          defaultParams: {
                            ...prev.defaultParams,
                            [key]: { ...prev.defaultParams[key as keyof DefaultParams], desc: e.target.value },
                          },
                        }))
                      }
                      className="w-full rounded border px-2 py-1 text-sm"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    />
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Default optimizer ranges */}
          <Section title={`Default Optimizer Ranges — ${ticker}`}>
            <div className="space-y-3">
              <div
                className="grid grid-cols-4 gap-2 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>Param</span>
                <span>Min</span>
                <span>Max</span>
                <span>Step</span>
              </div>
              {PARAM_KEYS.map((param) => {
                const r = localConfig.defaultRanges[param as keyof ParamRanges]
                return (
                  <div key={param} className="grid grid-cols-4 gap-2 items-center">
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {param}
                    </span>
                    {(['min', 'max', 'step'] as const).map((field) => (
                      <NumInput
                        key={field}
                        value={r[field]}
                        step={field === 'step' ? PARAM_STEPS[param as ParamKey] : String(r.step)}
                        onChange={(n) =>
                          setLocalConfig((prev) => ({
                            ...prev,
                            defaultRanges: {
                              ...prev.defaultRanges,
                              [param]: {
                                ...prev.defaultRanges[param as keyof ParamRanges],
                                [field]: n,
                              },
                            },
                          }))
                        }
                        className="w-full rounded border px-2 py-1 text-sm"
                        style={{
                          background: 'var(--bg-input)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                        }}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Save Permanently */}
          <button
            onClick={handleSavePermanently}
            disabled={saveStatus === 'saving'}
            className="w-full rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{
              background: saveStatus === 'error' ? 'var(--sell)' : saveStatus === 'saved' ? 'var(--buy)' : 'var(--accent)',
              color: saveStatus === 'saved' ? '#fff' : 'var(--accent-text)',
            }}
          >
            {saveButtonLabel()}
          </button>
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="mb-2 text-xs font-semibold uppercase tracking-widest"
        style={{ color: 'var(--text-muted)' }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border"
      style={{ background: color, borderColor: 'var(--border)' }}
    />
  )
}

