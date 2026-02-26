import { useState, useEffect } from 'react'
import type { Settings } from '../types'
import { applyTheme } from '../lib/themes'

const STORAGE_KEY = 'strat-opt-settings'

const defaults: Settings = {
  theme: 'slate',
  inputType: 'csv',
  cashRate: 0.04,
  startInvested: 1,
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return { ...defaults, ...JSON.parse(raw) }
    }
  } catch {
    // ignore
  }
  return defaults
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    applyTheme(settings.theme)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  function updateSettings(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  return { settings, updateSettings }
}
