import { useState, useEffect } from 'react'
import { useSettings } from './hooks/useSettings'
import { applyTheme } from './lib/themes'
import { getConfig, saveConfig, fetchSecurities } from './lib/api'
import { Header } from './components/Header'
import { SettingsSheet } from './components/Settings'
import { OptimizerTab } from './components/tabs/OptimizerTab'
import { BuyHoldTab } from './components/tabs/BuyHoldTab'
import { SignalTab } from './components/tabs/SignalTab'
import type { AppConfig, StrategyParams } from './types'

type Tab = 'optimizer' | 'buyhold' | 'signal'

const TABS: { id: Tab; label: string }[] = [
  { id: 'optimizer', label: 'Optimizer' },
  { id: 'buyhold', label: 'Buy & Hold' },
  { id: 'signal', label: 'Current Signal' },
]

export default function App() {
  const { settings, updateSettings } = useSettings()
  const [activeTab, setActiveTab] = useState<Tab>('optimizer')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [configError, setConfigError] = useState<{ message: string; stack?: string } | null>(null)
  const [securities, setSecurities] = useState<string[]>(['SPHY'])
  const [ticker, setTicker] = useState<string>('SPHY')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Apply saved theme on mount
  useEffect(() => {
    applyTheme(settings.theme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load securities list once on mount
  useEffect(() => {
    fetchSecurities().then(setSecurities).catch(() => {/* keep default */})
  }, [])

  // Reload config whenever the selected ticker changes
  useEffect(() => {
    setConfig(null)
    setConfigError(null)
    getConfig(ticker)
      .then(setConfig)
      .catch((e: unknown) => {
        const err = e instanceof Error ? e : new Error(String(e))
        setConfigError({ message: err.message, stack: err.stack })
      })
  }, [ticker])

  async function handleSaveConfig(newConfig: AppConfig) {
    await saveConfig(ticker, newConfig)
    setConfig(newConfig)
  }

  const defaultStrategyParams: StrategyParams | null = config ? {
    MA:         config.defaultParams.MA.value,
    DROP:       config.defaultParams.DROP.value,
    CHG4:       config.defaultParams.CHG4.value,
    RET3:       config.defaultParams.RET3.value,
    SPREAD_LVL: config.defaultParams.SPREAD_LVL.value,
  } : null

  const paramDescriptions = config ? {
    MA:         config.defaultParams.MA.desc,
    DROP:       config.defaultParams.DROP.desc,
    CHG4:       config.defaultParams.CHG4.desc,
    RET3:       config.defaultParams.RET3.desc,
    SPREAD_LVL: config.defaultParams.SPREAD_LVL.desc,
  } : undefined

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>
      <Header
        ticker={ticker}
        securities={securities}
        onTickerChange={(t) => { setTicker(t); setActiveTab('optimizer') }}
        onOpenSettings={() => setSettingsOpen(true)}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      {/* Tab bar */}
      <div
        className="border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
      >
        <div className="mx-auto flex max-w-5xl">
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-5 py-3 text-sm font-medium transition-colors"
                style={{
                  background: active ? 'var(--tab-active)' : 'transparent',
                  color: active ? 'var(--tab-active-text)' : 'var(--text-muted)',
                  borderBottom: active ? '2px solid var(--tab-active)' : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {!config && !configError && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        )}
        {config && activeTab === 'optimizer' && (
          <OptimizerTab key={ticker} settings={settings} ticker={ticker} defaultRanges={config.defaultRanges} paramDescriptions={paramDescriptions} startDate={startDate} endDate={endDate} cashRate={config.cashRate} startInvested={config.startInvested} />
        )}
        {config && activeTab === 'buyhold' && (
          <BuyHoldTab key={ticker} settings={settings} ticker={ticker} startDate={startDate} endDate={endDate} cashRate={config.cashRate} />
        )}
        {config && activeTab === 'signal' && defaultStrategyParams && (
          <SignalTab key={ticker} settings={settings} ticker={ticker} defaultParams={defaultStrategyParams} paramDescriptions={paramDescriptions} startDate={startDate} endDate={endDate} cashRate={config.cashRate} startInvested={config.startInvested} />
        )}
      </main>

      {config && (
        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdate={updateSettings}
          config={config}
          onSaveConfig={handleSaveConfig}
          ticker={ticker}
        />
      )}

      {/* Config load error modal */}
      {configError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="mx-4 w-full max-w-lg rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--sell)' }}>
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--sell)' }}>Failed to load config</h2>
            </div>
            <div className="px-4 py-3 space-y-2">
              <p className="text-sm" style={{ color: 'var(--text)' }}>{configError.message}</p>
              {configError.stack && (
                <pre className="overflow-auto rounded p-2 text-xs" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', maxHeight: '240px' }}>
                  {configError.stack}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
