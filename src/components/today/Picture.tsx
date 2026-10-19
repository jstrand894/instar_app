import { useEffect, useState } from 'react'
import { usePrefs } from '../../lib/prefs'

interface Pic { src: string; w: number; h: number; title: string; caption: string; credit: string; page: string; sourceName: string; video?: boolean }

const day = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
const cacheKey = (src: string) => `tm-potd-${src}-${day()}`
const NASA_KEY = (import.meta.env.VITE_NASA_API_KEY as string | undefined) || 'DEMO_KEY'

async function wikipedia(): Promise<Pic> {
  const d = new Date()
  const j = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/featured/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`, { headers: { Accept: 'application/json' } }).then(r => r.json())
  const i = j.image; if (!i?.thumbnail?.source) throw new Error('no picture')
  const title = String(i.title ?? '').replace(/^File:/, '').replace(/\.\w+$/, '').replace(/_/g, ' ')
  return { src: i.thumbnail.source, w: i.thumbnail.width, h: i.thumbnail.height, title, caption: i.description?.text ?? title, credit: i.artist?.text ?? '', page: i.file_page, sourceName: 'Wikimedia Commons' }
}

async function nasa(): Promise<Pic> {
  const r = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${NASA_KEY}&thumbs=true`)
  if (!r.ok) throw new Error(r.status === 429 ? 'NASA rate limit reached. Add your own free key.' : 'NASA is not responding')
  const j = await r.json()
  const video = j.media_type === 'video'; const src = video ? j.thumbnail_url : j.url
  if (!src) throw new Error('No image today')
  return { src, w: 0, h: 0, title: j.title, caption: j.title, credit: j.copyright ? String(j.copyright).replace(/\s+/g, ' ').trim() : '', page: video ? j.url : (j.hdurl || j.url), sourceName: 'NASA APOD', video }
}

/** The picture of the day from Wikipedia or NASA (your choice in Settings). Cached for the day. */
export default function Picture() {
  const source = usePrefs().picture
  const read = (): Pic | null => { try { return JSON.parse(localStorage.getItem(cacheKey(source)) || 'null') } catch { return null } }
  const [state, setState] = useState<{ source: string; pic: Pic | null; err: boolean; expl?: string }>(() => ({ source, pic: read(), err: false }))
  // switching source in Settings: show that source's cached picture (or load it)
  if (state.source !== source) setState({ source, pic: read(), err: false })

  useEffect(() => {
    if (state.pic) return
    let off = false
    ;(source === 'nasa' ? nasa() : wikipedia()).then(pic => {
      if (off) return
      setState({ source, pic, err: false })
      try { localStorage.setItem(cacheKey(source), JSON.stringify(pic)) } catch { /* ignore */ }
    }).catch(e => { if (!off) setState(s => ({ ...s, err: true, expl: String(e?.message ?? '') })) })
    return () => { off = true }
  }, [source, state.pic])

  const { pic } = state
  if (state.err && !pic) return <section className="card picture wide slim"><h2>Picture of the day</h2><p className="muted">{state.expl || 'Could not load the picture right now.'}</p></section>
  return (
    <section className="card picture wide">
      <h2>Picture of the day</h2>
      {pic ? (
        <figure>
          <a href={pic.page} target="_blank" rel="noreferrer" aria-label={`Open on ${pic.sourceName}`}>
            <img src={pic.src} alt={pic.caption} {...(pic.w ? { width: pic.w, height: pic.h } : {})} loading="lazy" />
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
