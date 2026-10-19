import { useEffect } from 'react'
import { setPrefs, usePrefs } from '../../lib/prefs'
import { TODAY_CARDS } from './layout'

/** Pick which cards show on Today. Saved on this device. */
export default function Customize({ onClose }: { onClose: () => void }) {
  const hidden = usePrefs().todayHidden
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [onClose])
  const toggle = (id: string) => setPrefs({ todayHidden: hidden.includes(id) ? hidden.filter(x => x !== id) : [...hidden, id] })
  return (
    <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Customize Today">
        <div className="modal-head"><h2>Customize Today</h2><button className="close-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-body">
          <p className="muted small" style={{ margin: 0 }}>Choose what shows on your Today screen. This is saved on this device.</p>
          <ul className="cust-list">
            {TODAY_CARDS.map(c => {
              const on = !hidden.includes(c.id)
              return (
                <li key={c.id}>
                  <span><b>{c.label}</b><span className="muted small">{c.hint}</span></span>
                  <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={c.label} onClick={() => toggle(c.id)}><i /></button>
                </li>
              )
            })}
          </ul>
          <div className="acct-actions">
            <button onClick={() => setPrefs({ todayHidden: [] })} disabled={!hidden.length}>Show everything</button>
            <button className="primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  )
}
