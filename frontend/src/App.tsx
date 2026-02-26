import { useState, useEffect } from 'react'
import { useSettings } from './hooks/useSettings'
import { applyTheme } from './lib/themes'
import { getConfig, saveConfig } from './lib/api'
import { Header } from './components/Header'
import { SettingsSheet } from './components/Settings'
import { OptimizerTab } from './components/tabs/OptimizerTab'
import { BuyHoldTab } from './components/tabs/BuyHoldTab'
import { SignalTab } from './components/tabs/SignalTab'
import type { AppConfig } from './types'

type Tab = 'optimizer' | 'buyhold' | 'signal'

const TABS: { id: Tab; label: string }[] = [
  { id: 'optimizer', label: 'Optimizer' },
  { id: 'buyhold', label: 'Buy & Hold' },
  { id: 'signal', label: 'Current Signal' },
]

const TICKER = 'SPHY'

const FALLBACK_CONFIG: AppConfig = {
  defaultParams: {
    MA: 50,
    DROP: 0.017,
    CHG4: 0.165,
    RET3: -0.021,
    SPREAD_LVL: 7.0,
  },
  defaultRanges: {
    MA:         { min: 50,      max: 50,      step: 5      },
    DROP:       { min: 0.016,   max: 0.016,   step: 0.001  },
    CHG4:       { min: 0.16,    max: 0.16,    step: 0.005  },
    RET3:       { min: -0.0225, max: -0.0225, step: 0.0005 },
    SPREAD_LVL: { min: 7.0,     max: 7.0,     step: 0.1    },
  },
}

export default function App() {
  const { settings, updateSettings } = useSettings()
  const [activeTab, setActiveTab] = useState<Tab>('optimizer')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [config, setConfig] = useState<AppConfig>(FALLBACK_CONFIG)

  // Apply saved theme on mount
  useEffect(() => {
    applyTheme(settings.theme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load config from API on mount
  useEffect(() => {
    getConfig().then(setConfig).catch(() => {/* keep fallback */})
  }, [])

  async function handleSaveConfig(newConfig: AppConfig) {
    await saveConfig(newConfig)
    setConfig(newConfig)
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>
      <Header ticker={TICKER} onOpenSettings={() => setSettingsOpen(true)} />

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
        {activeTab === 'optimizer' && (
          <OptimizerTab settings={settings} ticker={TICKER} defaultRanges={config.defaultRanges} />
        )}
        {activeTab === 'buyhold' && (
          <BuyHoldTab settings={settings} ticker={TICKER} />
        )}
        {activeTab === 'signal' && (
          <SignalTab settings={settings} ticker={TICKER} defaultParams={config.defaultParams} />
        )}
      </main>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={updateSettings}
        config={config}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  )
}
