export interface Theme {
  id: string
  label: string
  vars: Record<string, string>
}

export const themes: Theme[] = [
  {
    id: 'slate',
    label: 'Slate',
    vars: {
      '--bg': '#f8fafc',
      '--bg-card': '#ffffff',
      '--bg-header': '#1e293b',
      '--bg-input': '#f1f5f9',
      '--bg-hover': '#e2e8f0',
      '--text': '#0f172a',
      '--text-muted': '#64748b',
      '--text-header': '#f8fafc',
      '--border': '#e2e8f0',
      '--accent': '#0d9488',
      '--accent-text': '#ffffff',
      '--tab-active': '#0d9488',
      '--tab-active-text': '#ffffff',
      '--buy': '#16a34a',
      '--sell': '#dc2626',
      '--hold': '#d97706',
    },
  },
  {
    id: 'navy',
    label: 'Navy & Gold',
    vars: {
      '--bg': '#f0f4f8',
      '--bg-card': '#ffffff',
      '--bg-header': '#1a2744',
      '--bg-input': '#e8edf5',
      '--bg-hover': '#dce4f0',
      '--text': '#1a2744',
      '--text-muted': '#5a6a8a',
      '--text-header': '#ffd700',
      '--border': '#c8d4e8',
      '--accent': '#b8860b',
      '--accent-text': '#ffffff',
      '--tab-active': '#1a2744',
      '--tab-active-text': '#ffd700',
      '--buy': '#16a34a',
      '--sell': '#dc2626',
      '--hold': '#b8860b',
    },
  },
  {
    id: 'charcoal',
    label: 'Charcoal & Green',
    vars: {
      '--bg': '#1a1a1a',
      '--bg-card': '#2a2a2a',
      '--bg-header': '#111111',
      '--bg-input': '#333333',
      '--bg-hover': '#3a3a3a',
      '--text': '#e8e8e8',
      '--text-muted': '#888888',
      '--text-header': '#4ade80',
      '--border': '#444444',
      '--accent': '#22c55e',
      '--accent-text': '#000000',
      '--tab-active': '#22c55e',
      '--tab-active-text': '#000000',
      '--buy': '#4ade80',
      '--sell': '#f87171',
      '--hold': '#fbbf24',
    },
  },
  {
    id: 'contrast',
    label: 'High Contrast',
    vars: {
      '--bg': '#000000',
      '--bg-card': '#0a0a0a',
      '--bg-header': '#000000',
      '--bg-input': '#1a1a1a',
      '--bg-hover': '#222222',
      '--text': '#ffffff',
      '--text-muted': '#cccccc',
      '--text-header': '#ffff00',
      '--border': '#555555',
      '--accent': '#ffff00',
      '--accent-text': '#000000',
      '--tab-active': '#ffff00',
      '--tab-active-text': '#000000',
      '--buy': '#00ff00',
      '--sell': '#ff0000',
      '--hold': '#ffaa00',
    },
  },
]

export function applyTheme(id: string) {
  const theme = themes.find(t => t.id === id) ?? themes[0]
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value)
  }
}
