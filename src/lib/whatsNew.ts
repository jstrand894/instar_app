import { useEffect, useState } from 'react'

/** What changed in each version you have opened, kept on this device so the note is never lost when it fades. */
export interface Release { build: string; version: string; at: string; items: string[] }

const KEY = 'tm-whatsnew', READ = 'tm-whatsnew-read', MAX = 30

export function getReleases(): Release[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Release[] } catch { return [] }
}

export function addRelease(r: Release) {
  try {
    const all = getReleases().filter(x => x.build !== r.build)
    localStorage.setItem(KEY, JSON.stringify([r, ...all].slice(0, MAX)))
    window.dispatchEvent(new Event('tm-whatsnew'))
  } catch { /* storage blocked */ }
}

export const unreadBuild = (): string | null => {
  try { const top = getReleases()[0]; return top && localStorage.getItem(READ) !== top.build ? top.build : null } catch { return null }
}

export function markRead() {
  try { const top = getReleases()[0]; if (top) localStorage.setItem(READ, top.build); window.dispatchEvent(new Event('tm-whatsnew')) } catch { /* ignore */ }
}

/** Re-renders when the list changes; `unread` is true until you open the What's new tab. */
export function useWhatsNew() {
  const [, bump] = useState(0)
  useEffect(() => { const on = () => bump(n => n + 1); window.addEventListener('tm-whatsnew', on); return () => window.removeEventListener('tm-whatsnew', on) }, [])
  return { releases: getReleases(), unread: unreadBuild() !== null }
}
