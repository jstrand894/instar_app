import { useEffect, useRef, useState } from 'react'
import type { ToastDetail } from '../lib/notify'

/** Small messages at the bottom of the screen: confirmations, undo, and gentle errors. */
export default function Toasts() {
  const [items, setItems] = useState<ToastDetail[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    const done = (t: ToastDetail, expired: boolean) => {
      clearTimeout(timers.current.get(t.id)); timers.current.delete(t.id)
      setItems(list => list.filter(x => x.id !== t.id))
      if (expired) t.onExpire?.()
    }
    const onToast = (e: Event) => {
      const t = (e as CustomEvent<ToastDetail>).detail
      setItems(list => [...list.slice(-2), t])
      timers.current.set(t.id, setTimeout(() => done(t, true), t.duration))
    }
    window.addEventListener('tm-toast', onToast)
    return () => window.removeEventListener('tm-toast', onToast)
  }, [])

  const dismiss = (t: ToastDetail, expired: boolean) => {
    clearTimeout(timers.current.get(t.id)); timers.current.delete(t.id)
    setItems(list => list.filter(x => x.id !== t.id))
    if (expired) t.onExpire?.()
  }

  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="toast-main">
            <span>{t.message}</span>
            {t.action && <button className="toast-act" onClick={() => { t.action!.run(); dismiss(t, false) }}>{t.action.label}</button>}
            {t.kind === 'error' && t.detail && <button className="toast-more" onClick={() => setOpen(open === t.id ? null : t.id)}>Details</button>}
            <button className="toast-x" onClick={() => dismiss(t, true)} aria-label="Dismiss">×</button>
          </div>
          {open === t.id && t.detail && <code className="toast-detail">{t.detail}</code>}
        </div>
      ))}
    </div>
  )
}
