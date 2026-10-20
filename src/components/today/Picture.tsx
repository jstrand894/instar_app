import { useEffect, useState } from 'react'

interface Pic { src: string; w: number; h: number; title: string; caption: string; credit: string; page: string; sourceName: string; video?: boolean }

const day = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
const cacheKey = () => `tm-potd-nasa-${day()}`
const NASA_KEY = (import.meta.env.VITE_NASA_API_KEY as string | undefined) || 'DEMO_KEY'

async function nasa(): Promise<Pic> {
  // NASA's APOD service sometimes hangs without answering, so give up after a while instead of spinning forever
  const r = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${NASA_KEY}&thumbs=true`, { signal: AbortSignal.timeout(12000) })
  if (!r.ok) throw new Error(r.status === 429 ? 'NASA rate limit reached. Add your own free key.' : 'NASA is not responding')
  const j = await r.json()
  const video = j.media_type === 'video'; const src = video ? j.thumbnail_url : j.url
  if (!src) throw new Error('No image today')
  return { src, w: 0, h: 0, title: j.title, caption: j.title, credit: j.copyright ? String(j.copyright).replace(/\s+/g, ' ').trim() : '', page: video ? j.url : (j.hdurl || j.url), sourceName: 'NASA APOD', video }
}

const LAST = 'tm-potd-nasa-last'
const readLast = (): Pic | null => { try { return JSON.parse(localStorage.getItem(LAST) || 'null') } catch { return null } }

/** NASA's Astronomy Picture of the Day. Cached for the day; if NASA is not answering, shows the last picture it loaded. */
export default function Picture() {
  const [pic, setPic] = useState<Pic | null>(() => { try { return JSON.parse(localStorage.getItem(cacheKey()) || 'null') } catch { return null } })
  const [err, setErr] = useState('')
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (pic) return
    let off = false
    nasa().then(p => {
      if (off) return
      setPic(p); setErr('')
      try { localStorage.setItem(cacheKey(), JSON.stringify(p)); localStorage.setItem(LAST, JSON.stringify(p)) } catch { /* ignore */ }
    }).catch(e => {
      if (off) return
      setErr(e?.name === 'TimeoutError' || e?.name === 'AbortError' ? "NASA's picture service isn't answering right now." : String(e?.message ?? '') || 'Could not load the picture right now.')
    })
    return () => { off = true }
  }, [pic, tries])

  const shown = pic ?? (err ? readLast() : null)
  return (
    <section className="card picture wide">
      <div className="card-head">
        <h2>Picture of the day</h2>
        {err && <button className="link small" onClick={() => { setErr(''); setTries(t => t + 1) }}>Try again</button>}
      </div>
      {err && <p className="muted small" style={{ margin: 0 }}>{err}{shown ? ' Showing the last picture that loaded.' : ''}</p>}
      {shown ? (
        <figure>
          <a href={shown.page} target="_blank" rel="noreferrer" aria-label="Open on NASA">
            <img src={shown.src} alt={shown.caption} loading="lazy" decoding="async" />
          </a>
          <figcaption>
            <span>{shown.caption}{shown.video ? ' (video)' : ''}</span>
            <span className="muted small">{shown.credit && `${shown.credit} · `}<a href={shown.page} target="_blank" rel="noreferrer">{shown.sourceName}</a></span>
          </figcaption>
        </figure>
      ) : !err ? <div className="sk" style={{ height: 240, borderRadius: 12 }} aria-busy="true" /> : null}
    </section>
  )
}
