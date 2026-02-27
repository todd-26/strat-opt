import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { themes } from '../lib/themes'
import type { AppConfig, DefaultParams, ParamRanges, Settings } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
  config: AppConfig
  onSaveConfig: (c: AppConfig) => Promise<void>
}

export function SettingsSheet({ open, onClose, settings, onUpdate, config, onSaveConfig }: Props) {
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

          {/* Cash rate */}
          <Section title="Cash Rate (annual)">
            <input
              type="number"
              value={settings.cashRate}
              step="0.0025"
              onChange={(e) => onUpdate({ cashRate: parseFloat(e.target.value) || 0 })}
              className="w-32 rounded border px-2 py-1.5 text-sm"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
          </Section>

          {/* Starting position */}
          <Section title="Starting Position">
            <div className="flex gap-3">
              {([1, 0] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="startInvested"
                    value={v}
                    checked={settings.startInvested === v}
                    onChange={() => onUpdate({ startInvested: v })}
                  />
                  {v === 1 ? 'Invested' : 'Cash'}
                </label>
              ))}
            </div>
          </Section>

          {/* Default parameters */}
          <Section title="Default Parameters">
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
                    <input
                      type="number"
                      value={entry.value}
                      step={key === 'MA' ? '1' : '0.001'}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          defaultParams: {
                            ...prev.defaultParams,
                            [key]: { ...prev.defaultParams[key as keyof DefaultParams], value: parseFloat(e.target.value) || 0 },
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
          <Section title="Default Optimizer Ranges">
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
                      <input
                        key={field}
                        type="number"
                        value={r[field]}
                        step={param === 'MA' ? '1' : '0.0001'}
                        onChange={(e) =>
                          setLocalConfig((prev) => ({
                            ...prev,
                            defaultRanges: {
                              ...prev.defaultRanges,
                              [param]: {
                                ...prev.defaultRanges[param as keyof ParamRanges],
                                [field]: parseFloat(e.target.value) || 0,
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
