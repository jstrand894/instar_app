import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../../lib/store'
import { fmtWhen } from '../../lib/util'
import type { FieldSite, SiteVisit } from '../../types'

/** Planned field visits in the next three weeks. Hidden when there are none. */
export default function SiteVisits() {
  const [rows, setRows] = useState<{ v: SiteVisit; site: FieldSite }[]>([])
  const load = useCallback(async () => {
    try {
      const [sites, visits] = await Promise.all([store.sites(), store.siteVisits()])
      const byId = new Map(sites.map(s => [s.id, s]))
      const from = Date.now() - 36e5, to = Date.now() + 21 * 864e5
      setRows(visits.filter(v => v.status === 'planned' && byId.has(v.site_id) && new Date(v.visited_at).getTime() >= from && new Date(v.visited_at).getTime() <= to)
        .sort((a, b) => a.visited_at.localeCompare(b.visited_at)).map(v => ({ v, site: byId.get(v.site_id)! })))
    } catch { /* leave the last value; the tables may not exist yet */ }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { window.addEventListener('tm-data', load); return () => window.removeEventListener('tm-data', load) }, [load])
  if (!rows.length) return null
  return (
    <section className="card">
      <div className="card-head"><h2>Field visits <span className="count-pill">{rows.length}</span></h2></div>
      {rows.map(({ v, site }) => (
        <div className="trow" key={v.id}>
          <span className="pill">{fmtWhen(new Date(v.visited_at))}</span>
          <Link to={`/sites/${site.id}`}>{site.name}</Link>
          {v.purpose && <span className="muted small">{v.purpose}</span>}
        </div>
      ))}
    </section>
  )
}
