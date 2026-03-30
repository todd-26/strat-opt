import { useState, useEffect, useRef } from 'react'
import { useSettings } from './hooks/useSettings'
import { applyTheme } from './lib/themes'
import { getConfig, saveConfig, fetchSecurities, getDateRange, addSecurity, removeSecurity, updateSecurityData, updateEconomicData, reorderSecurities } from './lib/api'
import { Header } from './components/Header'
import { SettingsSheet } from './components/Settings'
import { OptimizerTab } from './components/tabs/OptimizerTab'
import { BuyHoldTab } from './components/tabs/BuyHoldTab'
import { SignalTab } from './components/tabs/SignalTab'
import { SignalsTab } from './components/tabs/SignalsTab'
import { WalkForwardTab } from './components/tabs/WalkForwardTab'
import type { AppConfig, StrategyParams, ParamRanges } from './types'

type Tab = 'optimizer' | 'buyhold' | 'signal' | 'signals' | 'walkforward'

const TABS: { id: Tab; label: string }[] = [
  { id: 'optimizer',   label: 'Backtester' },
  { id: 'buyhold',     label: 'Buy & Hold' },
  { id: 'signal',      label: 'Current Signal' },
  { id: 'signals',     label: 'Signals' },
  { id: 'walkforward', label: 'Walk-Forward' },
]

export default function App() {
  const { settings, updateSettings } = useSettings()
  const [activeTab, setActiveTab]     = useState<Tab>('optimizer')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [config, setConfig]           = useState<AppConfig | null>(null)
  const [configError, setConfigError] = useState<{ message: string; stack?: string } | null>(null)
  const [securities, setSecurities]   = useState<string[]>([])
  const [ticker, setTicker]           = useState<string>('')
  const [startDate, setStartDate]     = useState('')
  const [endDate, setEndDate]         = useState('')
  const [dateRange, setDateRange]     = useState<{ min: string; max: string } | null>(null)
  const [dateRangeError, setDateRangeError] = useState<string | null>(null)
  const [startupError, setStartupError] = useState<string | null>(null)
  const lastConfigRef = useRef<AppConfig | null>(null)
  if (config !== null) lastConfigRef.current = config

  useEffect(() => { applyTheme(settings.theme) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchSecurities()
      .then(list => { setSecurities(list); setTicker(t => t || list[0] || '') })
      .catch((e: unknown) => setStartupError(e instanceof Error ? e.message : String(e)))
  }, [])

  async function refreshSecurities(nextTicker?: string) {
    const list = await fetchSecurities()
    setSecurities(list)
    setTicker(t => {
      const keep = nextTicker ?? t
      return list.includes(keep) ? keep : list[0] ?? ''
    })
  }

  async function handleAddSecurity(t: string, name: string, template: string) {
    await addSecurity(t, name, template)
    await refreshSecurities(t)
  }

  async function handleRemoveSecurity(t: string) {
    await removeSecurity(t)
    await refreshSecurities()
  }

  async function handleReorderSecurities(tickers: string[]) {
    await reorderSecurities(tickers)
    setSecurities(tickers)
  }

  async function handleFetchData(t: string): Promise<boolean> {
    const alreadyCurrent = await updateSecurityData(t)
    if (t === ticker) {
      setStartDate('')
      setEndDate('')
      setDateRangeError(null)
      getDateRange(t)
        .then(r => { setDateRange(r); setDateRangeError(null) })
        .catch((e: unknown) => { setDateRange(null); setDateRangeError(e instanceof Error ? e.message : String(e)) })
    }
    return alreadyCurrent
  }

  useEffect(() => {
    if (!ticker) return
    setConfig(null)
    setConfigError(null)
    getConfig(ticker)
      .then(setConfig)
      .catch((e: unknown) => {
        const err = e instanceof Error ? e : new Error(String(e))
        setConfigError({ message: err.message, stack: err.stack })
      })
    setDateRangeError(null)
    getDateRange(ticker)
      .then(r => { setDateRange(r); setDateRangeError(null) })
      .catch((e: unknown) => { setDateRange(null); setDateRangeError(e instanceof Error ? e.message : String(e)) })
  }, [ticker])

  async function handleSaveConfig(newConfig: AppConfig) {
    await saveConfig(ticker, newConfig)
    setConfig(newConfig)
  }

  // Derive flat StrategyParams from new config structure
  const defaultStrategyParams: StrategyParams | null = config ? {
    MA:           config.buy_conditions.MA.default,
    DROP:         config.buy_conditions.DROP.default,
    CHG4:         config.sell_triggers.CHG4.default,
    RET3:         config.sell_triggers.RET3.default,
    YIELD10_CHG4:   config.sell_triggers.YIELD10_CHG4.default,
    YIELD2_CHG4:    config.sell_triggers.YIELD2_CHG4.default,
    CURVE_CHG4:   config.sell_triggers.CURVE_CHG4.default,
    SPREAD_DELTA: config.buy_conditions.SPREAD_DELTA.default,
    YIELD10_DELTA:  config.buy_conditions.YIELD10_DELTA.default,
  } : null

  // Derive descriptions for ParameterPanel tooltips
  const paramDescriptions: Partial<Record<keyof StrategyParams, string>> | undefined = config ? {
    MA:           config.buy_conditions.MA.description,
    DROP:         config.buy_conditions.DROP.description,
    CHG4:         config.sell_triggers.CHG4.description,
    RET3:         config.sell_triggers.RET3.description,
    YIELD10_CHG4:   config.sell_triggers.YIELD10_CHG4.description,
    YIELD2_CHG4:    config.sell_triggers.YIELD2_CHG4.description,
    CURVE_CHG4:   config.sell_triggers.CURVE_CHG4.description,
    SPREAD_DELTA: config.buy_conditions.SPREAD_DELTA.description,
    YIELD10_DELTA:  config.buy_conditions.YIELD10_DELTA.description,
  } : undefined

  // Derive optimizer default ranges
  const defaultRanges: ParamRanges | null = config ? {
    MA:           config.buy_conditions.MA.range,
    DROP:         config.buy_conditions.DROP.range,
    CHG4:         config.sell_triggers.CHG4.range,
    RET3:         config.sell_triggers.RET3.range,
    YIELD10_CHG4:   config.sell_triggers.YIELD10_CHG4.range,
    YIELD2_CHG4:    config.sell_triggers.YIELD2_CHG4.range,
    CURVE_CHG4:   config.sell_triggers.CURVE_CHG4.range,
    SPREAD_DELTA: config.buy_conditions.SPREAD_DELTA.range,
    YIELD10_DELTA:  config.buy_conditions.YIELD10_DELTA.range,
  } : null

  // Derive disabled factors from ignore flags
  const defaultDisabledFactors: string[] = config ? [
    ...Object.entries(config.sell_triggers).filter(([, v]) => v.ignore).map(([k]) => k),
    ...Object.entries(config.buy_conditions).filter(([, v]) => v.ignore).map(([k]) => k),
  ] : []

  if (startupError) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="mx-4 w-full max-w-lg rounded-lg border shadow-xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--sell)' }}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--sell)' }}>Startup Error</h2>
          </div>
          <div className="px-4 py-4 space-y-3">
            <p className="text-sm" style={{ color: 'var(--text)' }}>{startupError}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Ensure <code>api/securities_config.json</code> exists, is valid JSON, and contains at least one security entry. Then restart the server.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>
      <Header
        ticker={ticker}
        securities={securities}
        onTickerChange={(t) => { setTicker(t) }}
        onOpenSettings={() => setSettingsOpen(true)}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        dateRange={dateRange}
        dateRangeError={dateRangeError}
        hideDates={activeTab === 'signals' || activeTab === 'walkforward'}
      />

      {/* Tab bar */}
      <div className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <div className="mx-auto flex max-w-5xl">
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-5 py-3 text-sm font-medium transition-colors"
                style={{
                  background:   active ? 'var(--tab-active)' : 'transparent',
                  color:        active ? 'var(--tab-active-text)' : 'var(--text-muted)',
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
        {config && defaultRanges && activeTab === 'optimizer' && (
          <OptimizerTab key={ticker} settings={settings} ticker={ticker} defaultRanges={defaultRanges} paramDescriptions={paramDescriptions} startDate={startDate} endDate={endDate} cashRate={config.cash_rate} startInvested={config.start_invested} defaultDisabledFactors={defaultDisabledFactors} config={config} onSaveConfig={handleSaveConfig} />
        )}
        {config && activeTab === 'buyhold' && (
          <BuyHoldTab key={ticker} settings={settings} ticker={ticker} startDate={startDate} endDate={endDate} cashRate={config.cash_rate} />
        )}
        {config && activeTab === 'signal' && defaultStrategyParams && (
          <SignalTab key={ticker} settings={settings} ticker={ticker} defaultParams={defaultStrategyParams} paramDescriptions={paramDescriptions} startDate={startDate} endDate={endDate} cashRate={config.cash_rate} startInvested={config.start_invested} defaultDisabledFactors={defaultDisabledFactors} config={config} onSaveConfig={handleSaveConfig} />
        )}
        {activeTab === 'signals' && (
          <SignalsTab securities={securities} settings={settings} />
        )}
        {activeTab === 'walkforward' && ticker && (
          <WalkForwardTab key={ticker} ticker={ticker} settings={settings} />
        )}
      </main>

      {lastConfigRef.current && (
        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdate={updateSettings}
          config={config ?? lastConfigRef.current}
          onSaveConfig={handleSaveConfig}
          ticker={ticker}
          securities={securities}
          onAddSecurity={handleAddSecurity}
          onRemoveSecurity={handleRemoveSecurity}
          onReorderSecurities={handleReorderSecurities}
          onFetchData={handleFetchData}
          onFetchEconomicData={updateEconomicData}
        />
      )}

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
