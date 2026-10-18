import { useEffect, useState } from 'react'
import { getSync, type SyncState } from '../lib/sync'
import { demoMode } from '../lib/supabase'

const LABEL: Record<SyncState, string> = { idle: 'Up to date', saving: 'Saving…', saved: 'Saved', offline: 'Offline', error: "Couldn't save" }

/** A quiet indicator: Saving, Saved, Offline, or a problem. */
export default function SyncStatus() {
  const [s, setS] = useState(getSync)
  useEffect(() => {
    const on = () => setS(getSync())
    window.addEventListener('tm-sync', on)
    return () => window.removeEventListener('tm-sync', on)
  }, [])
  const label = demoMode && (s.state === 'saved' || s.state === 'idle') ? 'Saved on this device' : LABEL[s.state]
  const title = s.state === 'error' ? s.lastError ?? '' : s.state === 'offline' ? 'You are offline. Changes will not be saved until you reconnect.'
    : s.lastSaved ? `Last saved ${new Date(s.lastSaved).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : label
  return (
    <div className={`sync sync-${s.state}`} title={title} role="status">
      <i className="sync-dot" /><span>{label}</span>
    </div>
  )
}
