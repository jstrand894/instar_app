import { useEffect, useState } from 'react'

/** Per-device appearance and timer settings, kept in localStorage. */
export type Theme = 'system' | 'light' | 'dark'

/** `level` is where each colour unlocks as a reward. */
export const ACCENTS = [
  { id: 'forest', label: 'Forest', light: '#2f5d50', dark: '#7fc4ad', level: 1 },
  { id: 'ocean', label: 'Ocean', light: '#1b6ca8', dark: '#7db7ea', level: 2 },
  { id: 'slate', label: 'Slate', light: '#475569', dark: '#aab6c8', level: 3 },
  { id: 'indigo', label: 'Indigo', light: '#4a54b5', dark: '#a3aaf0', level: 4 },
  { id: 'plum', label: 'Plum', light: '#8a3f8e', dark: '#d9a1dc', level: 6 },
  { id: 'terracotta', label: 'Terracotta', light: '#b5502d', dark: '#f0a283', level: 8 },
  { id: 'amber', label: 'Amber', light: '#9a6200', dark: '#f0c06a', level: 11 },
  { id: 'rose', label: 'Rose', light: '#b02a52', dark: '#f29bb2', level: 14 },
  { id: 'midnight', label: 'Midnight', light: '#1e3a8a', dark: '#93b4f5', level: 18 },
] as const

export type Units = 'auto' | 'f' | 'c'
export interface Prefs {
  theme: Theme
  accent: string
  name: string
  avatar: string // profile picture as a small data URL ('' = none)
  pomo: { focus: number; short: number; long: number }
  units: Units
  weekStart: 0 | 1 // 0 = Sunday, 1 = Monday
  density: 'comfortable' | 'compact'
  motion: 'system' | 'reduce'
  todayHidden: string[] // Today cards you turned off
  todayOrder: string[] // Today card order you chose (cards missing here keep their default place)
  resumeLast: boolean // reopen the last project/manuscript when you return to its tab
}

const KEY = 'tm-prefs-v1'
const DEFAULTS: Prefs = { theme: 'system', accent: 'forest', name: '', avatar: '', pomo: { focus: 25, short: 5, long: 15 }, units: 'auto', weekStart: 1, density: 'comfortable', motion: 'system', todayHidden: [], todayOrder: [], resumeLast: true }

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
  root.dataset.density = p.density; if (p.motion === 'reduce') root.dataset.motion = 'reduce'; else delete root.dataset.motion
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

/** Current prefs, re-read whenever they change anywhere in the app. */
export function usePrefs(): Prefs {
  const [p, setP] = useState(getPrefs)
  useEffect(() => { const on = () => setP(getPrefs()); window.addEventListener('tm-prefs', on); return () => window.removeEventListener('tm-prefs', on) }, [])
  return p
}
