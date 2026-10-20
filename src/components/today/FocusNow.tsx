import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TodayData } from '../../lib/useTodayData'

const SHOW = 3

export default function FocusNow({ d }: { d: TodayData }) {
  const box = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false) // is there something below the visible three?
  const n = d.focusItems.length

  // show exactly three tiles, whatever their heights; the rest scroll
  const fit = useCallback(() => {
    const el = box.current; if (!el) return
    const tiles = el.children
    if (tiles.length <= SHOW) { el.style.maxHeight = ''; setMore(false); return }
    const last = tiles[SHOW - 1] as HTMLElement
    el.style.maxHeight = `${last.offsetTop + last.offsetHeight - (tiles[0] as HTMLElement).offsetTop}px`
    setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 2)
  }, [])
  const next = () => {
    const el = box.current; if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const to = el.scrollTop + (el.firstElementChild as HTMLElement).offsetHeight + 10
    el.scrollTo({ top: max - to < 40 ? max : to, behavior: 'smooth' }) // a sliver left: go all the way
  }
  useLayoutEffect(() => { fit() }, [fit, n])
  useEffect(() => {
    const el = box.current; if (!el) return
    const ro = new ResizeObserver(fit); ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  return (
    <section className="card focus-now" aria-label="Focus now">
      <h2>Focus now</h2>
      <div className="focus-scroll">
      <div className="focus-tiles" ref={box} onScroll={fit}>
        {d.focusItems.map(f => (
          <div className={`focus-tile ${f.pill?.tone ?? ''} ${d.leaving.has(f.key) ? 'leaving' : ''}`} key={f.key}>
            <span className="muted small">{f.kind}{f.when && ` · ${f.when}`}</span>
            <div className="focus-title">
              {f.tick && <input type="checkbox" className="tick" aria-label={`Mark "${f.title}" done`} onChange={f.tick} />}
              <b>{f.title}</b>
            </div>
            <div className="focus-meta">
              {f.pill && <span className={`pill dl-${f.pill.tone}`}>{f.pill.text}</span>}
              {f.project && <Link to={`/project/${f.project.id}`} className="muted small">{f.project.name}</Link>}
            </div>
          </div>
        ))}
      </div>
      {more && <button type="button" className="focus-more" aria-label="Show more" onClick={next}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>}
      </div>
    </section>
  )
}
