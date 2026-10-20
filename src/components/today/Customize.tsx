import { useEffect, useState } from 'react'
import { setPrefs, usePrefs } from '../../lib/prefs'
import { TODAY_CARDS, orderedIds } from './layout'

/** Pick which cards show on Today. Saved on this device. */
export default function Customize({ onClose }: { onClose: () => void }) {
  const prefs = usePrefs()
  const hidden = prefs.todayHidden
  const order = orderedIds(prefs.todayOrder)
  const byId = new Map(TODAY_CARDS.map(c => [c.id as string, c]))
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const move = (id: string, to: number) => {
    const next = order.filter(x => x !== id); next.splice(Math.max(0, Math.min(next.length, to)), 0, id)
    setPrefs({ todayOrder: next })
  }
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
          <p className="muted small" style={{ margin: 0 }}>Choose what shows on your Today screen and drag the handles to put cards in your order. This is saved on this device.</p>
          <ul className="cust-list">
            {order.map((id, i) => {
              const c = byId.get(id)!
              const on = !hidden.includes(id)
              return (
                <li key={id} draggable className={`${drag === id ? 'dragging' : ''} ${over === id && drag && drag !== id ? 'drop' : ''}`}
                  onDragStart={e => { setDrag(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id) }}
                  onDragOver={e => { if (drag) { e.preventDefault(); setOver(id) } }}
                  onDrop={e => { e.preventDefault(); if (drag && drag !== id) move(drag, i); setDrag(null); setOver(null) }}
                  onDragEnd={() => { setDrag(null); setOver(null) }}>
                  <span className="cust-grip" aria-hidden>⋮⋮</span>
                  <span className="cust-name"><b>{c.label}</b><span className="muted small">{c.hint}</span></span>
                  <span className="cust-move">
                    <button type="button" aria-label={`Move ${c.label} up`} disabled={i === 0} onClick={() => move(id, i - 1)}>▲</button>
                    <button type="button" aria-label={`Move ${c.label} down`} disabled={i === order.length - 1} onClick={() => move(id, i + 1)}>▼</button>
                  </span>
                  <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={c.label} onClick={() => toggle(id)}><i /></button>
                </li>
              )
            })}
          </ul>
          <div className="acct-actions">
            <button onClick={() => setPrefs({ todayHidden: [] })} disabled={!hidden.length}>Show everything</button>
            <button onClick={() => setPrefs({ todayOrder: [] })} disabled={!prefs.todayOrder.length}>Reset order</button>
            <button className="primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  )
}
