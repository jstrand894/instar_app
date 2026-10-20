import { useEffect, useState } from 'react'

/** A brief drawn-in check mark in the middle of the screen, shown when something is added or scheduled. */
export default function CheckPop() {
  const [n, setN] = useState(0)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const on = () => { setN(x => x + 1); clearTimeout(t); t = setTimeout(() => setN(0), 1100) }
    window.addEventListener('tm-check', on)
    return () => { window.removeEventListener('tm-check', on); clearTimeout(t) }
  }, [])
  if (!n) return null
  return (
    <div className="check-pop" key={n} aria-hidden="true">
      <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" /><path d="m15 27 8 8 15-17" /></svg>
    </div>
  )
}
