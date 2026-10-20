import { useEffect, useState } from 'react'

/** A brief drawn-in check mark that pops out of the button you just pressed to add or schedule something. */
export default function CheckPop() {
  const [at, setAt] = useState<{ n: number; x: number; y: number } | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    let last: { el: HTMLElement; rect: DOMRect; time: number } | null = null
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('button')
      if (el instanceof HTMLElement) last = { el, rect: el.getBoundingClientRect(), time: Date.now() }
    }
    const on = () => {
      const fresh = last && Date.now() - last.time < 15000 ? last : null
      const rect = fresh ? (fresh.el.isConnected ? fresh.el.getBoundingClientRect() : fresh.rect) : null
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
      setAt(a => ({ n: (a?.n ?? 0) + 1, x, y }))
      clearTimeout(t); t = setTimeout(() => setAt(null), 1100)
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('tm-check', on)
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('tm-check', on); clearTimeout(t) }
  }, [])
  if (!at) return null
  return (
    <div className="check-pop" key={at.n} style={{ left: at.x, top: at.y }} aria-hidden="true">
      <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" /><path d="m15 27 8 8 15-17" /></svg>
    </div>
  )
}
