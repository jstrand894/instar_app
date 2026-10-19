import { useEffect, useState } from 'react'

/** A thin notice when the connection drops, so a failed save is not a mystery. */
export default function OfflineBar() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  if (online) return null
  return <div className="offline-bar" role="status">You're offline. Changes may not save until you're back online.</div>
}
