/** Per-device appearance and timer settings, kept in localStorage. */
export type Theme = 'system' | 'light' | 'dark'

export const ACCENTS = [
  { id: 'forest', label: 'Forest', light: '#2f5d50', dark: '#7fc4ad' },
  { id: 'ocean', label: 'Ocean', light: '#1b6ca8', dark: '#7db7ea' },
  { id: 'indigo', label: 'Indigo', light: '#4a54b5', dark: '#a3aaf0' },
  { id: 'plum', label: 'Plum', light: '#8a3f8e', dark: '#d9a1dc' },
  { id: 'terracotta', label: 'Terracotta', light: '#b5502d', dark: '#f0a283' },
  { id: 'slate', label: 'Slate', light: '#475569', dark: '#aab6c8' },
] as const

export interface Prefs {
  theme: Theme
  accent: string
  pomo: { focus: number; short: number; long: number }
}

const KEY = 'tm-prefs-v1'
const DEFAULTS: Prefs = { theme: 'system', accent: 'forest', pomo: { focus: 25, short: 5, long: 15 } }

export function getPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>
    return { ...DEFAULTS, ...raw, pomo: { ...DEFAULTS.pomo, ...(raw.pomo ?? {}) } }
  } catch { return DEFAULTS }
}

export function setPrefs(patch: Partial<Prefs>) {
  const next = { ...getPrefs(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  applyPrefs()
  window.dispatchEvent(new Event('tm-prefs'))
}

const isDark = (theme: Theme) =>
  theme === 'dark' || (theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches)

export function applyPrefs() {
  const p = getPrefs(); const root = document.documentElement
  if (p.theme === 'system') delete root.dataset.theme; else root.dataset.theme = p.theme
  const dark = isDark(p.theme)
  const a = ACCENTS.find(x => x.id === p.accent) ?? ACCENTS[0]
  root.style.setProperty('--accent', dark ? a.dark : a.light)
  root.style.setProperty('--accent-ink', dark ? '#0f1412' : '#ffffff')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#131416' : '#f6f6f3')
}

/** Re-apply when the OS switches between light and dark while the theme is "system". */
export function watchSystemTheme() {
  if (typeof matchMedia === 'undefined') return
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (getPrefs().theme === 'system') applyPrefs() })
}
