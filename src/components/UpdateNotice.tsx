import { useEffect, useState } from 'react'
import { addRelease, getReleases, markRead } from '../lib/whatsNew'

const KEY = 'tm-seen-build'
const SHOW = 6

/** After a new version goes live and you reload, a small note bottom left says what changed. Shown once per version. */
export default function UpdateNotice() {
  const [items, setItems] = useState<string[] | null>(null)
  const [out, setOut] = useState(false)

  useEffect(() => {
    if (!__BUILD_ID__) return
    try {
      const seen = localStorage.getItem(KEY)
      localStorage.setItem(KEY, __BUILD_ID__)
      if (!seen || seen === __BUILD_ID__) { // first visit, or nothing new: just make sure the inbox has something to show
        if (!getReleases().length) {
          addRelease({ build: __BUILD_ID__, version: __APP_VERSION__, at: new Date().toISOString(), items: __CHANGES__.slice(0, 8).map(c => c.text) })
          markRead()
        }
        return
      }
      const at = __CHANGES__.findIndex(c => c.id === seen)
      const fresh = (at >= 0 ? __CHANGES__.slice(0, at) : __CHANGES__.slice(0, 3)).map(c => c.text)
      if (fresh.length) { addRelease({ build: __BUILD_ID__, version: __APP_VERSION__, at: new Date().toISOString(), items: fresh }); setItems(fresh) } // eslint-disable-line react-hooks/set-state-in-effect
    } catch { /* storage blocked: skip the notice */ }
  }, [])

  const close = () => { setOut(true); setTimeout(() => setItems(null), 250) }
  useEffect(() => {
    if (!items) return
    const t = setTimeout(close, 25000)
    return () => clearTimeout(t)
  }, [items])

  if (!items) return null
  return (
    <aside className={`update-note ${out ? 'out' : ''}`} role="status" aria-live="polite">
      <h3>App updated</h3>
      <ul>
        {items.slice(0, SHOW).map((t, i) => <li key={i}>{t}</li>)}
        {items.length > SHOW && <li>…and {items.length - SHOW} more</li>}
      </ul>
      <button type="button" className="update-all" onClick={() => { close(); window.dispatchEvent(new CustomEvent('tm-open-account', { detail: { tab: 'whatsnew' } })) }}>See all updates</button>
      <button type="button" className="update-x" onClick={close} aria-label="Dismiss">×</button>
    </aside>
  )
}
