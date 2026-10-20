import { useState, type ReactNode } from 'react'
import Icon from '../Icon'

/** Open/closed state for a card, remembered on this device. */
export function useFold(id: string, startOpen: boolean): [boolean, () => void] {
  const key = `tm-fold-${id}`
  const [open, setOpen] = useState(() => { try { const v = localStorage.getItem(key); return v === null ? startOpen : v === '1' } catch { return startOpen } })
  const toggle = () => setOpen(o => { try { localStorage.setItem(key, o ? '0' : '1') } catch { /* ignore */ } return !o })
  return [open, toggle]
}

/** A card title that doubles as a button to fold the card away. */
export function FoldHead({ title, open, onToggle, extra }: { title: ReactNode; open: boolean; onToggle: () => void; extra?: ReactNode }) {
  return (
    <div className="card-head fold-head">
      <button type="button" className="fold-btn" aria-expanded={open} onClick={onToggle}>
        <h2>{title}</h2><span className={`fold-chev ${open ? 'open' : ''}`}><Icon name="chevDown" size={16} /></span>
      </button>
      {extra}
    </div>
  )
}

/** The part of a card that slides shut. */
export function FoldBody({ open, children }: { open: boolean; children: ReactNode }) {
  return <div className={`fold-body ${open ? 'open' : ''}`} aria-hidden={!open}><div className="fold-inner">{children}</div></div>
}
