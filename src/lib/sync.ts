import { friendlyError } from './errors'

export type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error'

let pending = 0
let lastSaved: number | null = null
let lastError: string | null = null
let dataTimer: ReturnType<typeof setTimeout> | undefined

const emit = () => window.dispatchEvent(new Event('tm-sync'))

export function getSync(): { state: SyncState; lastSaved: number | null; lastError: string | null } {
  const state: SyncState = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline'
    : pending > 0 ? 'saving' : lastError ? 'error' : lastSaved ? 'saved' : 'idle'
  return { state, lastSaved, lastError }
}

/** Wraps a save so the app can show Saving / Saved / Offline, and tell pages to refresh. */
export function trackMutation<T>(p: Promise<T>): Promise<T> {
  pending++; emit()
  return p.then(
    v => {
      pending--; lastSaved = Date.now(); lastError = null; emit()
      clearTimeout(dataTimer); dataTimer = setTimeout(() => window.dispatchEvent(new Event('tm-data')), 250)
      return v
    },
    e => { pending--; lastError = friendlyError(e); emit(); throw e },
  )
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', emit); window.addEventListener('offline', emit)
}
