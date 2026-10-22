import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import Empty from '../components/Empty'
import Icon from '../components/Icon'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { friendlyError } from '../lib/errors'
import { ago, fmtWhen } from '../lib/util'
import { geocode, hasPin, parseCoords, siteStats } from '../lib/sites'
import SitePlace from '../components/SitePlace'
import type { FieldSite, SiteStatus, SiteVisit } from '../types'

const SitesMap = lazy(() => import('../components/SiteMap').then(m => ({ default: m.SitesMap })))
const STATUSES: (SiteStatus | 'all')[] = ['all', 'active', 'paused', 'done']

export default function FieldSites() {
  const nav = useNavigate()
  const [sites, setSites] = useState<FieldSite[]>([])
  const [visits, setVisits] = useState<SiteVisit[]>([])
  const [covers, setCovers] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<SiteStatus | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([store.sites(), store.siteVisits().catch(() => [] as SiteVisit[])])
      setSites(s); setVisits(v); setError('')
      setCovers(await store.siteCoverUrls(s.map(x => x.cover_path).filter((p): p is string => !!p)).catch((): Record<string, string> => ({})))
    } catch (e) { setError(friendlyError(e)) } finally { setLoaded(true) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { window.addEventListener('tm-data', refresh); return () => window.removeEventListener('tm-data', refresh) }, [refresh])

  const stats = useMemo(() => new Map(sites.map(s => [s.id, siteStats(visits.filter(v => v.site_id === s.id))])), [sites, visits])
  const [tag, setTag] = useState('')
  const allTags = useMemo(() => [...new Set(sites.flatMap(s => s.tags ?? []))].sort(), [sites])
  const shown = sites.filter(s => (filter === 'all' || s.status === filter) && (!tag || (s.tags ?? []).includes(tag)))
  const pins = useMemo(() => shown.flatMap(s => hasPin(s) ? [{ id: s.id, name: s.name, lat: s.lat, lng: s.lng }] : []), [sites, filter, tag]) // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(sites.map(x => [x.id, x])), [sites])
  const nextUp = useMemo(() => [...stats.entries()].flatMap(([id, st]) => st.next && byId.get(id) ? [{ site: byId.get(id)!, visit: st.next }] : [])
    .sort((a, b) => a.visit.visited_at.localeCompare(b.visit.visited_at)).slice(0, 4), [stats, byId])
  const recent = useMemo(() => [...stats.entries()].flatMap(([id, st]) => st.last && byId.get(id) ? [{ site: byId.get(id)!, visit: st.last }] : [])
    .sort((a, b) => b.visit.visited_at.localeCompare(a.visit.visited_at)).slice(0, 3), [stats, byId])
  const tagCounts = useMemo(() => {
    const n = new Map<string, number>()
    for (const x of sites) for (const t of x.tags ?? []) n.set(t, (n.get(t) ?? 0) + 1)
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [sites])
  const visitsDone = visits.filter(v => v.status === 'done').length

  return (
    <div className="page">
      <header className="page-head">
        <div className="title-row"><h1>Field sites</h1><BackButton /></div>
        <button className="primary" onClick={() => setAdding(true)}>New site</button>
      </header>

      {error && <p className="error">{error}</p>}
      {adding && <NewSite onClose={() => setAdding(false)} onCreated={id => { setAdding(false); nav(`/sites/${id}`) }} />}

      {sites.length > 0 && (
        <div className="sites-top">
          {pins.length > 0 && <Suspense fallback={<div className="site-map" />}><SitesMap sites={pins} onOpen={id => nav(`/sites/${id}`)} /></Suspense>}
          <section className="card sites-summary">
            <h2>Field season</h2>
            <p className="muted small sites-totals">
              {sites.filter(s => s.status === 'active').length} active · {visitsDone} visit{visitsDone === 1 ? '' : 's'} logged
              {sites.some(s => !hasPin(s)) && ` · ${sites.filter(s => !hasPin(s)).length} not on the map`}
            </p>
            <h3>Next up</h3>
            {nextUp.length ? (
              <ul className="sites-list">
                {nextUp.map(({ site, visit }) => <li key={visit.id}><Link to={`/sites/${site.id}`}><b>{site.name}</b></Link><span>{fmtWhen(new Date(visit.visited_at))}{visit.purpose ? ` · ${visit.purpose}` : ''}</span></li>)}
              </ul>
            ) : <p className="muted small">No visits planned.</p>}
            <h3>Recently visited</h3>
            {recent.length ? (
              <ul className="sites-list">
                {recent.map(({ site, visit }) => <li key={visit.id}><Link to={`/sites/${site.id}`}><b>{site.name}</b></Link><span>{ago(visit.visited_at)}{visit.purpose ? ` · ${visit.purpose}` : ''}</span></li>)}
              </ul>
            ) : <p className="muted small">No visits logged yet.</p>}
            {tagCounts.length > 0 && (
              <>
                <h3>By tag</h3>
                <div className="site-tags">{tagCounts.map(([t, n]) => <span key={t}>#{t} · {n}</span>)}</div>
              </>
            )}
          </section>
        </div>
      )}

      {sites.length > 0 && (
        <div className="chips">
          {STATUSES.map(s => <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>{s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}</button>)}
          {allTags.length > 0 && (
            <select className="tag-filter" value={tag} onChange={e => setTag(e.target.value)} aria-label="Filter by tag">
              <option value="">All tags</option>
              {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
            </select>
          )}
        </div>
      )}

      {shown.length > 0 && (
        <div className="grid">
          {shown.map(s => {
            const st = stats.get(s.id)!
            const cover = s.cover_path ? covers[s.cover_path] : null
            return (
              <Link key={s.id} to={`/sites/${s.id}`} className="card site-card">
                <div className="site-cover">{cover ? <img src={cover} alt="" loading="lazy" /> : <Icon name="tree" size={30} />}</div>
                <div className="site-card-body">
                  <div className="row between"><h2>{s.name}</h2><span className="status-pill" data-status={s.status}>{s.status}</span></div>
                  <SitePlace site={s} />
                  {(s.tags?.length ?? 0) > 0 && <div className="site-tags">{s.tags!.map(t => <span key={t}>#{t}</span>)}</div>}
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
          {sites.length ? 'Try another status.' : 'A field site keeps its notes, a log of every visit and your planned revisits, with one photo as its card and a pin on the map.'}
        </Empty>
      )}
    </div>
  )
}

function NewSite({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const where = address.trim() ? await geocode(address) : null
      if (address.trim() && !where) notify.info("Couldn't find that address on the map. Drop a pin on the site page instead.")
      const row = await store.addSite({ name: name.trim(), address: parseCoords(address) ? '' : address.trim(), ...(where ?? {}) })
      onCreated(row.id)
    } catch (er) { notify.error(er); setBusy(false) }
  }
  return (
    <form className="card form" onSubmit={submit}>
      <input autoFocus placeholder="Site name" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Address or place (optional, puts it on the map)" value={address} onChange={e => setAddress(e.target.value)} />
      <div className="row">
        <button className="primary" disabled={!name.trim() || busy}>{busy ? 'Adding…' : 'Create'}</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}
