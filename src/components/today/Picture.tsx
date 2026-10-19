import { useEffect, useState } from 'react'

interface Pic { src: string; w: number; h: number; title: string; caption: string; credit: string; page: string; sourceName: string; video?: boolean }

const day = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
const cacheKey = () => `tm-potd-nasa-${day()}`
const NASA_KEY = (import.meta.env.VITE_NASA_API_KEY as string | undefined) || 'DEMO_KEY'

async function nasa(): Promise<Pic> {
  const r = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${NASA_KEY}&thumbs=true`)
  if (!r.ok) throw new Error(r.status === 429 ? 'NASA rate limit reached. Add your own free key.' : 'NASA is not responding')
  const j = await r.json()
  const video = j.media_type === 'video'; const src = video ? j.thumbnail_url : j.url
  if (!src) throw new Error('No image today')
  return { src, w: 0, h: 0, title: j.title, caption: j.title, credit: j.copyright ? String(j.copyright).replace(/\s+/g, ' ').trim() : '', page: video ? j.url : (j.hdurl || j.url), sourceName: 'NASA APOD', video }
}

/** NASA's Astronomy Picture of the Day. Cached for the day. */
export default function Picture() {
  const [pic, setPic] = useState<Pic | null>(() => { try { return JSON.parse(localStorage.getItem(cacheKey()) || 'null') } catch { return null } })
  const [err, setErr] = useState('')

  useEffect(() => {
    if (pic) return
    let off = false
    nasa().then(p => {
      if (off) return
      setPic(p)
      try { localStorage.setItem(cacheKey(), JSON.stringify(p)) } catch { /* ignore */ }
    }).catch(e => { if (!off) setErr(String(e?.message ?? '') || 'Could not load the picture right now.') })
    return () => { off = true }
  }, [pic])

  if (err && !pic) return <section className="card picture wide slim"><h2>Picture of the day</h2><p className="muted">{err}</p></section>
  return (
    <section className="card picture wide">
      <h2>Picture of the day</h2>
      {pic ? (
        <figure>
          <a href={pic.page} target="_blank" rel="noreferrer" aria-label="Open on NASA">
            <img src={pic.src} alt={pic.caption} loading="lazy" />
          </a>
          <figcaption>
            <span>{pic.caption}{pic.video ? ' (video)' : ''}</span>
            <span className="muted small">{pic.credit && `${pic.credit} · `}<a href={pic.page} target="_blank" rel="noreferrer">{pic.sourceName}</a></span>
          </figcaption>
        </figure>
      ) : <div className="sk" style={{ height: 240, borderRadius: 12 }} aria-busy="true" />}
    </section>
  )
}
