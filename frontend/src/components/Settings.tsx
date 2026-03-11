import { useState, useEffect } from 'react'
import { X, Trash2, RefreshCw } from 'lucide-react'
import { themes } from '../lib/themes'
import { NumInput } from './NumInput'
import type { AppConfig, Settings } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
  config: AppConfig
  onSaveConfig: (c: AppConfig) => Promise<void>
  ticker: string
  securities: string[]
  onAddSecurity: (ticker: string, name: string, template: string) => Promise<void>
  onRemoveSecurity: (ticker: string) => Promise<void>
  onFetchData: (ticker: string) => Promise<void>
}

export function SettingsSheet({ open, onClose, settings, onUpdate, config, onSaveConfig, ticker, securities, onAddSecurity, onRemoveSecurity, onFetchData }: Props) {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config)
  const [saveStatus, setSaveStatus]   = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Manage Securities state
  const [confirmDelete, setConfirmDelete]   = useState<string | null>(null)
  const [updatingTickers, setUpdatingTickers] = useState<Set<string>>(new Set())
  const [addTicker, setAddTicker]           = useState('')
  const [addName, setAddName]               = useState('')
  const [addTemplate, setAddTemplate]       = useState('')
  const [manageStatus, setManageStatus]     = useState<string | null>(null)
  const [manageError, setManageError]       = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLocalConfig(config)
      setSaveStatus('idle')
      setConfirmDelete(null)
      setAddTicker('')
      setAddName('')
      setAddTemplate(securities[0] ?? '')
      setManageStatus(null)
      setManageError(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Default template to first security when list loads
  useEffect(() => {
    if (!addTemplate && securities.length > 0) setAddTemplate(securities[0])
  }, [securities]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(t: string) {
    setManageError(null)
    try {
      await onRemoveSecurity(t)
      setConfirmDelete(null)
      setManageStatus(`${t} removed.`)
      setTimeout(() => setManageStatus(null), 3000)
    } catch (e) {
      setManageError(String(e))
      setConfirmDelete(null)
    }
  }

  async function handleUpdate(t: string) {
    setManageError(null)
    setUpdatingTickers(prev => new Set(prev).add(t))
    try {
      await onFetchData(t)
      setManageStatus(`${t} data updated.`)
      setTimeout(() => setManageStatus(null), 3000)
    } catch (e) {
      setManageError(String(e))
    } finally {
      setUpdatingTickers(prev => { const s = new Set(prev); s.delete(t); return s })
    }
  }

  async function handleAdd() {
    setManageError(null)
    const t = addTicker.trim().toUpperCase()
    if (!t) { setManageError('Ticker is required.'); return }
    if (!addName.trim()) { setManageError('Name is required.'); return }
    if (!addTemplate) { setManageError('Template is required.'); return }
    try {
      await onAddSecurity(t, addName.trim(), addTemplate)
      setAddTicker('')
      setAddName('')
      setManageStatus(`${t} added.`)
      setTimeout(() => setManageStatus(null), 3000)
    } catch (e) {
      setManageError(String(e))
    }
  }

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

  function toggleSell(key: string) {
    setLocalConfig(prev => ({
      ...prev,
      sell_triggers: {
        ...prev.sell_triggers,
        [key]: { ...prev.sell_triggers[key as keyof typeof prev.sell_triggers], ignore: !prev.sell_triggers[key as keyof typeof prev.sell_triggers].ignore },
      },
    }))
  }

  function toggleBuy(key: string) {
    setLocalConfig(prev => ({
      ...prev,
      buy_conditions: {
        ...prev.buy_conditions,
        [key]: { ...prev.buy_conditions[key as keyof typeof prev.buy_conditions], ignore: !prev.buy_conditions[key as keyof typeof prev.buy_conditions].ignore },
      },
    }))
  }

  function setSellField(key: string, field: 'default' | 'description', value: number | string) {
    setLocalConfig(prev => ({
      ...prev,
      sell_triggers: {
        ...prev.sell_triggers,
        [key]: { ...prev.sell_triggers[key as keyof typeof prev.sell_triggers], [field]: value },
      },
    }))
  }

  function setBuyField(key: string, field: 'default' | 'description', value: number | string) {
    setLocalConfig(prev => ({
      ...prev,
      buy_conditions: {
        ...prev.buy_conditions,
        [key]: { ...prev.buy_conditions[key as keyof typeof prev.buy_conditions], [field]: value },
      },
    }))
  }

  function setSellRange(key: string, field: 'min' | 'max' | 'step', value: number) {
    setLocalConfig(prev => ({
      ...prev,
      sell_triggers: {
        ...prev.sell_triggers,
        [key]: { ...prev.sell_triggers[key as keyof typeof prev.sell_triggers], range: { ...prev.sell_triggers[key as keyof typeof prev.sell_triggers].range, [field]: value } },
      },
    }))
  }

  function setBuyRange(key: string, field: 'min' | 'max' | 'step', value: number) {
    setLocalConfig(prev => ({
      ...prev,
      buy_conditions: {
        ...prev.buy_conditions,
        [key]: { ...prev.buy_conditions[key as keyof typeof prev.buy_conditions], range: { ...prev.buy_conditions[key as keyof typeof prev.buy_conditions].range, [field]: value } },
      },
    }))
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 w-[28rem] overflow-y-auto shadow-xl" style={{ background: 'var(--bg-card)', color: 'var(--text)' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <span className="font-semibold">Settings</span>
          <button onClick={onClose} className="rounded p-1 hover:opacity-70"><X size={18} /></button>
        </div>

        <div className="space-y-6 p-4">
          {/* Manage Securities */}
          <Section title="Manage Securities">
            <div className="space-y-3">
              {/* Existing securities list */}
              <div className="space-y-1">
                {securities.map((s) => (
                  <div key={s} className="flex items-center justify-between rounded border px-3 py-2"
                    style={{ borderColor: 'var(--border)', background: s === ticker ? 'var(--bg-input)' : 'transparent' }}>
                    <span className="text-sm font-medium">{s}</span>
                    <div className="flex items-center gap-1">
                      {confirmDelete === s ? (
                        <>
                          <span className="text-xs" style={{ color: 'var(--sell)' }}>Remove {s}?</span>
                          <button onClick={() => handleDelete(s)}
                            className="rounded px-2 py-0.5 text-xs font-semibold"
                            style={{ background: 'var(--sell)', color: '#fff' }}>Yes</button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="rounded px-2 py-0.5 text-xs"
                            style={{ background: 'var(--bg-input)', color: 'var(--text)' }}>No</button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleUpdate(s)}
                            disabled={updatingTickers.has(s)}
                            className="rounded p-1 hover:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={`Update Historical Data for ${s}`}
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <RefreshCw size={14} className={updatingTickers.has(s) ? 'animate-spin' : ''} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(s)}
                            disabled={securities.length <= 1}
                            className="rounded p-1 hover:opacity-70 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={securities.length <= 1 ? 'Cannot remove the last security' : `Remove ${s}`}
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add security form */}
              <div className="space-y-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Add Security</span>
                <input
                  type="text" placeholder="Ticker (e.g. HYG)" value={addTicker}
                  onChange={(e) => setAddTicker(e.target.value.toUpperCase())}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
                <input
                  type="text" placeholder="Full name" value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--text-muted)' }}>Model after</label>
                  <select value={addTemplate} onChange={(e) => setAddTemplate(e.target.value)}
                    className="w-full rounded border px-2 py-1.5 text-sm"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                    {securities.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  CSV must exist at <code>inputs/{'{ticker}'.toLowerCase()}-weekly-adjusted.csv</code> before adding.
                </p>
                <button onClick={handleAdd}
                  className="w-full rounded px-3 py-1.5 text-sm font-semibold"
                  style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                  Add Security
                </button>
              </div>

              {manageStatus && <p className="text-xs font-medium" style={{ color: 'var(--buy)' }}>{manageStatus}</p>}
              {manageError && <p className="text-xs" style={{ color: 'var(--sell)' }}>{manageError}</p>}
            </div>
          </Section>

          {/* Theme */}
          <Section title="Theme">
            <div className="space-y-2">
              {themes.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5"
                  style={{ borderColor: settings.theme === t.id ? 'var(--accent)' : 'var(--border)', background: settings.theme === t.id ? 'var(--bg-input)' : 'transparent' }}>
                  <input type="radio" name="theme" value={t.id} checked={settings.theme === t.id} onChange={() => onUpdate({ theme: t.id })} className="sr-only" />
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
                  <input type="radio" name="inputType" value={v} checked={settings.inputType === v} onChange={() => onUpdate({ inputType: v })} />
                  {v === 'csv' ? 'CSV (default)' : 'Live API'}
                </label>
              ))}
            </div>
          </Section>

          {/* Run defaults */}
          <Section title={`Run Defaults — ${ticker}`}>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cash Rate (annual)</label>
                <NumInput value={localConfig.cash_rate} step="0.0025"
                  onChange={(n) => setLocalConfig(prev => ({ ...prev, cash_rate: n }))}
                  className="w-32 rounded border px-2 py-1.5 text-sm"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Starting Position</label>
                <div className="flex gap-3">
                  {([1, 0] as const).map((v) => (
                    <label key={v} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="startInvested" value={v} checked={localConfig.start_invested === v}
                        onChange={() => setLocalConfig(prev => ({ ...prev, start_invested: v }))} />
                      {v === 1 ? 'Invested' : 'Not Invested'}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Enabled Factors */}
          <Section title={`Enabled Factors — ${ticker}`}>
            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Sell Factors</span>
                <div className="mt-1 space-y-1">
                  {Object.entries(localConfig.sell_triggers).map(([f, param]) => (
                    <label key={f} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!param.ignore} onChange={() => toggleSell(f)} />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Buy Factors</span>
                <div className="mt-1 space-y-1">
                  {Object.entries(localConfig.buy_conditions).map(([f, param]) => (
                    <label key={f} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!param.ignore} onChange={() => toggleBuy(f)} />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Default Parameters */}
          <Section title={`Default Parameters — ${ticker}`}>
            <div className="space-y-3">
              <div className="grid gap-2 text-xs font-semibold uppercase tracking-wide"
                style={{ gridTemplateColumns: '6rem 6rem 1fr', color: 'var(--text-muted)' }}>
                <span>Param</span><span>Value</span><span>Description</span>
              </div>
              <div className="text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Sell</div>
              {Object.entries(localConfig.sell_triggers).map(([key, param]) => (
                <div key={key} className="grid items-center gap-2" style={{ gridTemplateColumns: '6rem 6rem 1fr' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{key}</span>
                  <NumInput value={param.default} step={String(param.range.step)}
                    onChange={(n) => setSellField(key, 'default', n)}
                    className="w-full rounded border px-2 py-1 text-sm"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <input type="text" value={param.description} placeholder="description"
                    onChange={(e) => setSellField(key, 'description', e.target.value)}
                    className="w-full rounded border px-2 py-1 text-sm"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                </div>
              ))}
              <div className="text-xs font-medium uppercase pt-1" style={{ color: 'var(--text-muted)' }}>Buy</div>
              {Object.entries(localConfig.buy_conditions).map(([key, param]) => (
                <div key={key} className="grid items-center gap-2" style={{ gridTemplateColumns: '6rem 6rem 1fr' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{key}</span>
                  <NumInput value={param.default} step={String(param.range.step)}
                    onChange={(n) => setBuyField(key, 'default', n)}
                    className="w-full rounded border px-2 py-1 text-sm"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <input type="text" value={param.description} placeholder="description"
                    onChange={(e) => setBuyField(key, 'description', e.target.value)}
                    className="w-full rounded border px-2 py-1 text-sm"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                </div>
              ))}
            </div>
          </Section>

          {/* Default Optimizer Ranges */}
          <Section title={`Default Optimizer Ranges — ${ticker}`}>
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                <span>Param</span><span>Min</span><span>Max</span><span>Step</span>
              </div>
              <div className="text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Sell</div>
              {Object.entries(localConfig.sell_triggers).map(([key, param]) => (
                <div key={key} className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{key}</span>
                  {(['min', 'max', 'step'] as const).map((field) => (
                    <NumInput key={field} value={param.range[field]} step={String(param.range.step)}
                      onChange={(n) => setSellRange(key, field, n)}
                      className="w-full rounded border px-2 py-1 text-sm"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  ))}
                </div>
              ))}
              <div className="text-xs font-medium uppercase pt-1" style={{ color: 'var(--text-muted)' }}>Buy</div>
              {Object.entries(localConfig.buy_conditions).map(([key, param]) => (
                <div key={key} className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{key}</span>
                  {(['min', 'max', 'step'] as const).map((field) => (
                    <NumInput key={field} value={param.range[field]} step={String(param.range.step)}
                      onChange={(n) => setBuyRange(key, field, n)}
                      className="w-full rounded border px-2 py-1 text-sm"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  ))}
                </div>
              ))}
            </div>
          </Section>

          {/* Save */}
          <button onClick={handleSavePermanently} disabled={saveStatus === 'saving'}
            className="w-full rounded px-4 py-2 text-sm font-semibold disabled:opacity-50"
            style={{
              background: saveStatus === 'error' ? 'var(--sell)' : saveStatus === 'saved' ? 'var(--buy)' : 'var(--accent)',
              color: saveStatus === 'saved' ? '#fff' : 'var(--accent-text)',
            }}>
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
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</h3>
      {children}
    </div>
  )
}

function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-4 w-4 rounded-full border" style={{ background: color, borderColor: 'var(--border)' }} />
}
