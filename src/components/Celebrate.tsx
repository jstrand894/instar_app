import { useEffect, useRef, useState } from 'react'
import { useGame } from '../lib/game'
import { rankFor } from '../lib/rewards'

interface Burst { n: number; x: number; y: number; gain: number; level: number | null }

/** When your XP goes up, a soft ring and a few specks bloom where you just clicked, with the XP earned floating up. */
export default function Celebrate() {
  const g = useGame()
  const prev = useRef<{ xp: number; level: number } | null>(null)
  const last = useRef<{ x: number; y: number; time: number } | null>(null)
  const [b, setB] = useState<Burst | null>(null)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('button, input, label, [role="checkbox"]') as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      last.current = { x: r.left + Math.min(r.width, 40) / 2, y: r.top + r.height / 2, time: Date.now() }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  useEffect(() => {
    if (!g) return
    const p = prev.current; prev.current = { xp: g.xp, level: g.level }
    if (!p || g.xp <= p.xp) return
    const fresh = last.current && Date.now() - last.current.time < 15000 ? last.current : null
    const x = fresh?.x ?? window.innerWidth / 2, y = fresh?.y ?? window.innerHeight / 2
    setB(o => ({ n: (o?.n ?? 0) + 1, x, y, gain: g.xp - p.xp, level: g.level > p.level ? g.level : null }))
  }, [g])
  useEffect(() => {
    if (!b) return
    const t = setTimeout(() => setB(null), b.level ? 2200 : 1400)
    return () => clearTimeout(t)
  }, [b])
  if (!b) return null
  return (
    <div className="celebrate" key={b.n} style={{ left: b.x, top: b.y }} aria-hidden="true">
      <i className="cel-ring" />
      {Array.from({ length: 8 }, (_, i) => <i key={i} className="cel-dot" style={{ '--a': `${i * 45 + 12}deg` } as React.CSSProperties} />)}
      <span className="cel-xp">+{b.gain} XP</span>
      {b.level && <span className="cel-level">Level {b.level} · {rankFor(b.level).name}</span>}
    </div>
  )
}
