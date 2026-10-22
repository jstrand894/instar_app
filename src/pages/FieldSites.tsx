import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import Empty from '../components/Empty'
import Icon from '../components/Icon'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { friendlyError } from '../lib/errors'
import { ago, fmtMinutes, fmtWhen } from '../lib/util'
import { geocode, hasPin, parseCoords, siteStats, tagStyle, cleanTag, toCover } from '../lib/sites'
import SitePlace from '../components/SitePlace'
import ProjectPicker from '../components/ProjectPicker'
import type { FieldSite, SiteStatus, SiteVisit } from '../types'

const SitesMap = lazy(() => import('../components/SiteMap').then(m => ({ default: m.SitesMap })))

export default function FieldSites() {
  const nav = useNavigate()
  const [sites, setSites] = useState<FieldSite[]>([])
  const [visits, setVisits] = useState<SiteVisit[]>([])
  const [covers, setCovers] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([store.sites(), store.siteVisits().catch(() => [] as SiteVisit[])])
      const dashed = s.filter(x => (x.tags ?? []).some(t => /[-_]/.test(t)))
      for (const x of dashed) { x.tags = [...new Set(x.tags!.map(cleanTag))]; store.patchSite(x.id, { tags: x.tags }).catch(() => {}) } // one-off: older tags were dashed slugs
      setSites(s); setVisits(v); setError('')
      setCovers(await store.siteCoverUrls(s.map(x => x.cover_path).filter((p): p is string => !!p)).catch((): Record<string, string> => ({})))
    } catch (e) { setError(friendlyError(e)) } finally { setLoaded(true) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { window.addEventListener('tm-data', refresh); return () => window.removeEventListener('tm-data', refresh) }, [refresh])

  const stats = useMemo(() => new Map(sites.map(s => [s.id, siteStats(visits.filter(v => v.site_id === s.id))])), [sites, visits])
  const [tag, setTag] = useState('')
  const allTags = useMemo(() => [...new Set(sites.flatMap(s => s.tags ?? []))].sort(), [sites])
  const shown = sites.filter(s => !tag || (s.tags ?? []).includes(tag))
  const pins = useMemo(() => shown.flatMap(s => hasPin(s) ? [{ id: s.id, name: s.name, lat: s.lat, lng: s.lng }] : []), [sites, tag]) // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(sites.map(x => [x.id, x])), [sites])
  const nextUp = useMemo(() => [...stats.entries()].flatMap(([id, st]) => st.next && byId.get(id) ? [{ site: byId.get(id)!, visit: st.next }] : [])
    .sort((a, b) => a.visit.visited_at.localeCompare(b.visit.visited_at)).slice(0, 4), [stats, byId])
  const recent = useMemo(() => [...stats.entries()].flatMap(([id, st]) => st.last && byId.get(id) ? [{ site: byId.get(id)!, visit: st.last }] : [])
    .sort((a, b) => b.visit.visited_at.localeCompare(a.visit.visited_at)).slice(0, 4), [stats, byId])
  const tagCounts = useMemo(() => {
    const n = new Map<string, number>()
    for (const x of sites) for (const t of x.tags ?? []) n.set(t, (n.get(t) ?? 0) + 1)
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [sites])
  const visitsDone = visits.filter(v => v.status === 'done').length
  const upcoming = [...stats.values()].filter(x => x.next).length
  const onSite = visits.filter(v => v.status === 'done').reduce((n, v) => n + (v.minutes ?? 0), 0)
  // active sites with no visit planned that were last visited over a month ago (or never), the longest-waiting first
  const stale = useMemo(() => sites.flatMap(site => {
    const st = stats.get(site.id)
    if (site.status !== 'active' || !st || st.next) return []
    const days = st.last ? Math.floor((Date.now() - new Date(st.last.visited_at).getTime()) / 864e5) : null
    return days == null || days >= 30 ? [{ site, days }] : []
  }).sort((a, b) => (b.days ?? 1e9) - (a.days ?? 1e9)).slice(0, 4), [sites, stats])

  return (
    <div className="page">
      <header className="page-head">
        <div className="title-row"><h1>Field sites</h1><BackButton /></div>
        <button className="primary" onClick={() => setAdding(true)}>New site</button>
      </header>

      {error && <p className="error">{error}</p>}
      {adding && <NewSite tagSuggestions={allTags} onClose={() => setAdding(false)} onCreated={id => { setAdding(false); nav(`/sites/${id}`) }} />}

      {sites.length > 0 && (
        <>
          <div className="sites-top">
            {pins.length > 0 && <Suspense fallback={<div className="site-map" />}><SitesMap sites={pins} onOpen={id => nav(`/sites/${id}`)} /></Suspense>}
            <section className="card sites-summary">
              <div className="site-stats">
                <div><b>{sites.filter(x => x.status === 'active').length}</b><span>active</span></div>
                <div><b>{upcoming}</b><span>planned</span></div>
                <div><b>{visitsDone}</b><span>{visitsDone === 1 ? 'visit' : 'visits'}</span></div>
                <div><b>{onSite ? fmtMinutes(onSite) : '0'}</b><span>on site</span></div>
              </div>
              <h3>Next up</h3>
              {nextUp.length ? (
                <ul className="next-list">
                  {nextUp.map(({ site, visit }) => {
                    const d = new Date(visit.visited_at)
                    return (
                      <li key={visit.id}>
                        <Link to={`/sites/${site.id}`}>
                          <span className="date-badge"><small>{d.toLocaleDateString(undefined, { month: 'short' })}</small><b>{d.getDate()}</b></span>
                          <span className="next-what"><b>{site.name}</b><em>{d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{visit.purpose ? ` · ${visit.purpose}` : ''}</em></span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : <p className="muted small">No visits planned. Open a site to plan a revisit.</p>}
              <QuickTask sites={sites} />
            </section>
          </div>

          <section className="card sites-insights">
            <div>
              <h3>Due a visit{stale.length > 0 && <em>{stale.length}</em>}</h3>
              {stale.length ? (
                <ul className="sites-list">
                  {stale.map(({ site, days }) => <li key={site.id}><Link to={`/sites/${site.id}`}><b>{site.name}</b></Link><span>{days == null ? 'never visited' : `${days} days ago`}</span></li>)}
                </ul>
              ) : <p className="muted small">Every active site has been visited in the last month or has a visit planned.</p>}
            </div>
            <div>
              <h3>Recently visited</h3>
              {recent.length ? (
                <ul className="sites-list">
                  {recent.map(({ site, visit }) => <li key={visit.id}><Link to={`/sites/${site.id}`}><b>{site.name}</b></Link><span>{ago(visit.visited_at)}{visit.purpose ? ` · ${visit.purpose}` : ''}</span></li>)}
                </ul>
              ) : <p className="muted small">No visits logged yet.</p>}
            </div>
            <div>
              <h3>Projects</h3>
              {tagCounts.length ? (
                <div className="site-tags left">{tagCounts.map(([t, n]) => <button key={t} className={`tag-pill${tag === t ? ' on' : ''}`} style={tagStyle(t)} onClick={() => setTag(tag === t ? '' : t)}>{t} · {n}</button>)}</div>
              ) : <p className="muted small">Tag a site with a project, like life table or RP grid, to group them here.</p>}
              {sites.some(x => !hasPin(x)) && <p className="muted small" style={{ marginTop: '.6rem' }}>{sites.filter(x => !hasPin(x)).length} not on the map yet.</p>}
            </div>
          </section>
        </>
      )}

      {allTags.length > 0 && (
        <div className="chips">
          <button className={tag ? '' : 'on'} onClick={() => setTag('')}>All</button>
          {allTags.map(t => <button key={t} className={`tag-pill${tag === t ? ' on' : ''}`} style={tagStyle(t)} onClick={() => setTag(tag === t ? '' : t)}>{t}</button>)}
        </div>
      )}

      {shown.length > 0 && (
        <div className="grid">
          {shown.map(s => {
            const st = stats.get(s.id)!
            const cover = s.cover_path ? covers[s.cover_path] : null
            return (
              <Link key={s.id} to={`/sites/${s.id}`} className="card site-card">
                <div className="site-cover">{cover ? <img src={cover} alt="" loading="lazy" /> : <Icon name="tree" size={30} />}{(s.tags?.length ?? 0) > 0 && <div className="site-tags">{s.tags!.map(t => <span key={t} style={tagStyle(t)}>{t}</span>)}</div>}</div>
                <div className="site-card-body">
                  <h2>{s.name}</h2>
                  <SitePlace site={s} />
                  <p className="site-next">{st.next ? <><b>Next:</b> {fmtWhen(new Date(st.next.visited_at))}{st.next.purpose ? ` · ${st.next.purpose}` : ''}</> : <span className="muted">No visit planned</span>}</p>
                  <p className="muted small">{st.last ? `Last visited ${ago(st.last.visited_at)} · ` : 'Not visited yet · '}{st.done.length} visit{st.done.length === 1 ? '' : 's'}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {loaded && !shown.length && !adding && (
        <Empty icon="folder" dashed title={sites.length ? 'No sites match this filter' : 'No field sites yet'}
          actions={!sites.length && <button className="primary" onClick={() => setAdding(true)}>Add a site</button>}>
          {sites.length ? 'Try another tag.' : 'A field site keeps its notes, a log of every visit and your planned revisits, with one photo as its card and a pin on the map.'}
        </Empty>
      )}
    </div>
  )
}

/** Adds a to-do from the overview, tagged with the site's name and filed under its project when it has one. */
function QuickTask({ sites }: { sites: FieldSite[] }) {
  const [text, setText] = useState('')
  const [siteId, setSiteId] = useState('')
  const [busy, setBusy] = useState(false)
  async function add(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim(); if (!t || busy) return
    const site = sites.find(x => x.id === siteId)
    setBusy(true)
    try {
      await store.addTask(site?.project_id ?? null, site ? `${site.name}: ${t}` : t, null)
      setText(''); notify.info(site ? `Added to your tasks for ${site.name}.` : 'Added to your tasks.')
    } catch (er) { notify.error(er) } finally { setBusy(false) }
  }
  return (
    <form className="quick-task" onSubmit={add}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a field to-do…" aria-label="New field to-do" />
      <select value={siteId} onChange={e => setSiteId(e.target.value)} aria-label="Site for this to-do">
        <option value="">Any site</option>
        {sites.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <button className="primary" disabled={!text.trim() || busy}>Add</button>
    </form>
  )
}

function NewSite({ onClose, onCreated, tagSuggestions }: { onClose: () => void; onCreated: (id: string) => void; tagSuggestions: string[] }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [status, setStatus] = useState<SiteStatus>('active')
  const [about, setAbout] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pick = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!photo) { setPreview(null); return }
    const u = URL.createObjectURL(photo); setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [photo])
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const where = address.trim() ? await geocode(address) : null
      if (address.trim() && !where) notify.info("Couldn't find that address on the map. Drop a pin on the site page instead.")
      const row = await store.addSite({ name: name.trim(), address: parseCoords(address) ? '' : address.trim(), description: about.trim(), status, tags, ...(where ?? {}) })
      if (photo) await store.saveSiteCover(row.id, await toCover(photo)).catch(er => notify.error(er))
      onCreated(row.id)
    } catch (er) { notify.error(er); setBusy(false) }
  }
  return (
    <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
      <form className="modal new-site" role="dialog" aria-modal="true" aria-label="New field site" onSubmit={submit}>
        <div className="modal-head"><h2>New field site</h2><button type="button" className="close-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-body">
          <button type="button" className="new-site-photo" onClick={() => pick.current?.click()}>
            {preview ? <img src={preview} alt="Cover preview" /> : <span><Icon name="camera" size={20} /> Add a cover photo</span>}
          </button>
          <input ref={pick} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(f); e.target.value = '' }} />
          {photo && <button type="button" className="link small" onClick={() => setPhoto(null)}>Remove photo</button>}
          <label>Name<input autoFocus placeholder="e.g. Elk Park" value={name} onChange={e => setName(e.target.value)} /></label>
          <label>Location<input placeholder="Address, place or lat, lng (puts it on the map)" value={address} onChange={e => setAddress(e.target.value)} /></label>
          <div><h3>Projects</h3><ProjectPicker tags={tags} onChange={setTags} known={tagSuggestions} /></div>
          <label>Status
            <select value={status} onChange={e => setStatus(e.target.value as SiteStatus)}>
              {(['active', 'paused', 'done'] as const).map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
          </label>
          <label>About<textarea rows={3} placeholder="What is here, how to get in, who to call…" value={about} onChange={e => setAbout(e.target.value)} /></label>
          <div className="row">
            <button className="primary" disabled={!name.trim() || busy}>{busy ? 'Adding…' : 'Create site'}</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </form>
    </div>
  )
}
