import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import Icon from '../components/Icon'
import InlineEdit from '../components/InlineEdit'
import RichTextarea, { RichView } from '../components/RichText'
import VisitForm, { type VisitDraft } from '../components/VisitForm'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { friendlyError } from '../lib/errors'
import { ago, fmtMinutes, fmtWhen } from '../lib/util'
import { geocode, hasPin, parseCoords, placeName, mapLinks, siteStats, toCover } from '../lib/sites'
import type { FieldSite, Project, SiteStatus, SiteVisit } from '../types'

const PickMap = lazy(() => import('../components/SiteMap').then(m => ({ default: m.PickMap })))
const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export default function FieldSiteDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [site, setSite] = useState<FieldSite | null>(null)
  const [visits, setVisits] = useState<SiteVisit[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [cover, setCover] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<null | 'log' | 'plan' | { edit: string } | { finish: string }>(null)
  const [notes, setNotes] = useState('')
  const [findBusy, setFindBusy] = useState(false)
  const [address, setAddress] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const pick = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const [ss, vs, ps] = await Promise.all([store.sites(), store.siteVisits().catch(() => [] as SiteVisit[]), store.projects()])
      const s = ss.find(x => x.id === id) ?? null
      setSite(s); setVisits(vs.filter(v => v.site_id === id)); setProjects(ps)
      if (!s) { setError('Site not found.'); return }
      setError('')
      const urls: Record<string, string> = s.cover_path ? await store.siteCoverUrls([s.cover_path]).catch(() => ({})) : {}
      setCover(s.cover_path ? urls[s.cover_path] ?? null : null)
    } catch (e) { setError(friendlyError(e)) }
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { window.addEventListener('tm-data', load); return () => window.removeEventListener('tm-data', load) }, [load])
  // edits to the notes and address start from what is saved, and are not overwritten by a refresh while typing
  const [seeded, setSeeded] = useState<string | null>(null)
  if (site && seeded !== site.id) { setSeeded(site.id); setNotes(site.notes); setAddress(site.address) }

  async function patch(p: Partial<FieldSite>) {
    if (!site) return
    setSite({ ...site, ...p })
    try { await store.patchSite(site.id, p) } catch (e) { notify.error(e); load() }
  }
  async function setPhoto(file: File | null) {
    if (!site) return
    setPhotoBusy(true)
    try {
      await store.saveSiteCover(site.id, file ? await toCover(file) : null)
      await load()
    } catch (e) { notify.error(e) } finally { setPhotoBusy(false) }
  }
  const [moving, setMoving] = useState(false)
  const [editingLoc, setEditingLoc] = useState(false)
  const [editingAbout, setEditingAbout] = useState(false)
  const [about, setAbout] = useState('')
  const [place, setPlace] = useState<string | null>(null)
  useEffect(() => {
    setPlace(null)
    if (site?.lat == null || site.lng == null) return
    let live = true
    placeName(site.lat, site.lng).then(n => { if (live) setPlace(n) })
    return () => { live = false }
  }, [site?.lat, site?.lng])

  async function findOnMap() {
    if (!address.trim()) return
    setFindBusy(true)
    const where = await geocode(address)
    setFindBusy(false)
    if (!where) { notify.info("Couldn't find that address. Click the map to drop a pin instead."); await patch({ address: address.trim() }); return }
    await patch({ address: parseCoords(address) ? '' : address.trim(), ...where })
    setEditingLoc(false)
  }
  async function saveVisit(status: SiteVisit['status'], d: VisitDraft) {
    if (!site) return
    try { await store.addSiteVisit({ site_id: site.id, status, ...d }); setForm(null); notify.added(); load() } catch (e) { notify.error(e) }
  }
  async function patchVisit(vid: string, p: Partial<SiteVisit>) {
    try { await store.patchSiteVisit(vid, p); setForm(null); load() } catch (e) { notify.error(e) }
  }
  const removeVisit = (v: SiteVisit) => notify.undoable(v.status === 'planned' ? 'Removed the planned visit' : 'Deleted the visit', () => store.deleteSiteVisit(v.id), [v.id])
  const removeSite = () => { if (site) { notify.undoable(`Deleted "${site.name}"`, () => store.deleteSite(site.id), [site.id]); nav('/sites') } }

  if (!site) return <div className="page detail">{error ? <><div className="title-row"><BackButton /><Link to="/sites" className="back">← Field sites</Link></div><p className="error">{error}</p></> : null}</div>

  const { done, planned, next } = siteStats(visits)
  const links = mapLinks(site)
  const project = projects.find(p => p.id === site.project_id)
  const editing = (vid: string) => typeof form === 'object' && form !== null && (('edit' in form && form.edit === vid) || ('finish' in form && form.finish === vid))

  return (
    <div className="page detail">
      <div className="title-row"><BackButton /><Link to="/sites" className="back">← Field sites</Link></div>

      <div className="detail-head">
        <h1><InlineEdit value={site.name} onSave={name => patch({ name })} /></h1>
        <div className="row">
          <select className="status" data-status={site.status} value={site.status} onChange={e => patch({ status: e.target.value as SiteStatus })} aria-label="Status">
            {(['active', 'paused', 'done'] as const).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="link small danger" onClick={removeSite}>Delete site</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <section className="card site-hero">
        <div className="site-cover big">
          {cover ? <img src={cover} alt={`Cover photo of ${site.name}`} /> : <Icon name="tree" size={40} />}
          <div className="cover-tools">
            <button onClick={() => pick.current?.click()} disabled={photoBusy}><Icon name="camera" size={14} /> {photoBusy ? 'Saving…' : cover ? 'Change photo' : 'Add a cover photo'}</button>
            {cover && !photoBusy && <button onClick={() => setPhoto(null)}>Remove</button>}
          </div>
          <input ref={pick} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setPhoto(f); e.target.value = '' }} />
        </div>
        <div className="site-facts">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="muted small">About this site</label>
            {!editingAbout && <button className="link" aria-label="Edit about" title="Edit about" onClick={() => { setAbout(site.description); setEditingAbout(true) }}><Icon name="pen" size={16} /></button>}
          </div>
          {editingAbout ? (
            <>
              <textarea autoFocus rows={4} placeholder="What is here, how to get in, who to call…" value={about} onChange={e => setAbout(e.target.value)} />
              <div className="row">
                <button className="primary" onClick={() => { if (about !== site.description) patch({ description: about }); setEditingAbout(false) }}>Save</button>
                <button onClick={() => setEditingAbout(false)}>Cancel</button>
              </div>
            </>
          ) : site.description.trim()
            ? <p style={{ whiteSpace: 'pre-wrap', margin: '.2rem 0' }}>{site.description}</p>
            : <p className="muted" style={{ margin: '.2rem 0' }}>Nothing yet. Use the pencil to add what is here, how to get in, who to call…</p>}
          <p className="site-next">{next ? <><b>Next visit:</b> {fmtWhen(new Date(next.visited_at))}{next.purpose ? ` · ${next.purpose}` : ''}</> : <span className="muted">No visit planned</span>}</p>
          <p className="muted small">{done[0] ? `Last visited ${ago(done[0].visited_at)} · ` : 'Not visited yet · '}{done.length} visit{done.length === 1 ? '' : 's'}{done.some(v => v.minutes) ? ` · ${fmtMinutes(done.reduce((n, v) => n + (v.minutes ?? 0), 0))} on site` : ''}</p>
          <div className="row wrap">
            <button className="primary" onClick={() => setForm('log')}>Log a visit</button>
            <button onClick={() => setForm('plan')}>Plan a revisit</button>
          </div>
        </div>
      </section>

      {form === 'log' && <VisitForm submitLabel="Save visit" onSubmit={d => saveVisit('done', d)} onCancel={() => setForm(null)} />}
      {form === 'plan' && <VisitForm planning submitLabel="Schedule" initial={{ visited_at: new Date(Date.now() + 7 * 864e5).toISOString() }} onSubmit={d => saveVisit('planned', { ...d, minutes: null, notes: '', conditions: '' })} onCancel={() => setForm(null)} />}

      <div className="detail-cols">
        <div className="detail-main">
          <section className="card">
            <h2>Timeline</h2>
            {!visits.length && <p className="muted">No visits yet. Log one when you have been, or plan a revisit.</p>}
            <ol className="visits">
              {planned.map(v => (
                <li key={v.id} className="visit planned">
                  <span className="tl-dot hollow" />
                  {editing(v.id) && typeof form === 'object' && form && 'finish' in form ? (
                    <VisitForm submitLabel="Save visit" initial={{ ...v, visited_at: new Date().toISOString() }} onSubmit={d => patchVisit(v.id, { ...d, status: 'done' })} onCancel={() => setForm(null)} />
                  ) : editing(v.id) ? (
                    <VisitForm planning submitLabel="Save" initial={v} onSubmit={d => patchVisit(v.id, { visited_at: d.visited_at, purpose: d.purpose })} onCancel={() => setForm(null)} />
                  ) : (
                    <>
                      <div className="row between wrap"><b>Planned · {longDate(v.visited_at)} {clock(v.visited_at)}</b>
                        <span className="row">
                          <button className="link small" onClick={() => setForm({ finish: v.id })}>Log this visit</button>
                          <button className="link small" onClick={() => setForm({ edit: v.id })}>Reschedule</button>
                          <button className="link small danger" onClick={() => removeVisit(v)}>Remove</button>
                        </span>
                      </div>
                      {v.purpose && <p>{v.purpose}</p>}
                    </>
                  )}
                </li>
              ))}
              {done.map(v => (
                <li key={v.id} className="visit">
                  <span className="tl-dot" />
                  {editing(v.id) ? (
                    <VisitForm submitLabel="Save" initial={v} onSubmit={d => patchVisit(v.id, d)} onCancel={() => setForm(null)} />
                  ) : (
                    <>
                      <div className="row between wrap"><b>{longDate(v.visited_at)} <span className="muted">{clock(v.visited_at)}{v.minutes ? ` · ${fmtMinutes(v.minutes)}` : ''}</span></b>
                        <span className="row">
                          <button className="link small" onClick={() => setForm({ edit: v.id })}>Edit</button>
                          <button className="link small danger" onClick={() => removeVisit(v)}>Delete</button>
                        </span>
                      </div>
                      {v.purpose && <p className="muted small">Purpose: {v.purpose}</p>}
                      {v.notes && <div className="rich"><RichView text={v.notes} /></div>}
                      {v.conditions && <p className="muted small">Conditions: {v.conditions}</p>}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section className="card">
            <h2>Notes</h2>
            <RichTextarea rows={8} placeholder="Access, hazards, plot layout, equipment left on site, anything to remember…" value={notes} onChange={setNotes}
              onBlur={() => { if (notes !== site.notes) patch({ notes }) }} />
          </section>
        </div>

        <aside className="detail-side">
          <section className="card">
            <h2>Location</h2>
            {editingLoc ? (
              <div className="row">
                <input autoFocus placeholder="Address, place or lat, lng" value={address} onChange={e => setAddress(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); findOnMap() } else if (e.key === 'Escape') setEditingLoc(false) }} />
                <button onClick={findOnMap} disabled={!address.trim() || findBusy}>{findBusy ? 'Finding…' : 'Find'}</button>
                <button className="link" onClick={() => setEditingLoc(false)}>Cancel</button>
              </div>
            ) : (
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{hasPin(site) ? (place ?? (site.address || 'Pin set')) : (site.address || <span className="muted">No location yet</span>)}</span>
                <button className="link" aria-label="Edit location" title="Edit location" onClick={() => { setAddress(site.address); setEditingLoc(true) }}><Icon name="pen" size={16} /></button>
              </div>
            )}
            <Suspense fallback={<div className="site-map pick" />}>
              <PickMap lat={site.lat} lng={site.lng} locked={hasPin(site) && !moving} onPick={(lat, lng) => { setMoving(false); patch({ lat, lng }) }} />
            </Suspense>
            <p className="muted small">{!hasPin(site) ? 'Click the map to drop a pin.' : moving ? 'Click the map to place the pin.' : ''}
              {hasPin(site) && <> <button className="link small" onClick={() => setMoving(m => !m)}>{moving ? 'Cancel' : 'Move pin'}</button>
                {!moving && <> <button className="link small" onClick={() => patch({ lat: null, lng: null })}>Clear pin</button></>}</>}</p>
            {hasPin(site) && <button className="map-btn" onClick={() => navigator.clipboard.writeText(`${site.lat}, ${site.lng}`).then(() => notify.info('Coordinates copied.'), () => notify.info("Couldn't copy to the clipboard."))}>Copy coordinates</button>}
            {(hasPin(site) || site.address) && (
              <div className="row wrap">
                <a className="map-btn" href={links.google} target="_blank" rel="noreferrer">Open in Google Maps</a>
                <a className="map-btn" href={links.apple} target="_blank" rel="noreferrer">Open in Apple Maps</a>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Linked project</h2>
            <select value={site.project_id ?? ''} onChange={e => patch({ project_id: e.target.value || null })} aria-label="Linked project">
              <option value="">None</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {project && <p className="small"><Link to={`/project/${project.id}`} className="link">Open {project.name} →</Link></p>}
          </section>
        </aside>
      </div>
    </div>
  )
}
