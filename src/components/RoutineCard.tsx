import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { dayList } from './RoutineManager'
import type { Project, Routine, RoutineCheck } from '../types'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

interface Occ { r: Routine; date: Date; key: string }

/** What you do every week: today's items, anything still open from the last few days, and what is coming up. */
export default function RoutineCard({ routines, checks, projects, onManage, onChange }: {
  routines: Routine[]; checks: RoutineCheck[]; projects: Project[]; onManage: () => void; onChange: () => void
}) {
  const [opt, setOpt] = useState<Record<string, boolean>>({}) // instant feedback while the save finishes
  const today = new Date(); const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const { todayItems, open, soon } = useMemo(() => {
    const done = new Set(checks.map(c => `${c.routine_id}|${c.on_date}`))
    const live = routines.filter(r => r.active)
    // a routine only counts from the (local) day it was created, so a new one never shows up as "missed"
    const on = (date: Date) => live.filter(r => r.weekdays.includes(date.getDay()) && iso(date) >= iso(new Date(r.created_at)))
      .map(r => ({ r, date, key: `${r.id}|${iso(date)}` }) as Occ)
    const todayItems = on(base)
    const open = [1, 2, 3].flatMap(b => on(addDays(base, -b))).filter(o => !done.has(o.key))
    const soon = [1, 2, 3].flatMap(b => on(addDays(base, b)))
    return { todayItems, open, soon }
  }, [routines, checks]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDone = (o: Occ) => opt[o.key] ?? checks.some(c => `${c.routine_id}|${c.on_date}` === o.key)
  const byId = new Map(projects.map(p => [p.id, p]))

  async function toggle(o: Occ) {
    const next = !isDone(o); setOpt(x => ({ ...x, [o.key]: next }))
    try { await (next ? store.checkRoutine(o.r.id, iso(o.date)) : store.uncheckRoutine(o.r.id, iso(o.date))); onChange() }
    catch (e) { notify.error(e) }
    finally { setOpt(x => { const n = { ...x }; delete n[o.key]; return n }) }
  }

  const row = (o: Occ, showDay = false) => {
    const d = isDone(o); const pr = o.r.project_id ? byId.get(o.r.project_id) : undefined
    return (
      <li key={o.key} className={d ? 'done' : ''}>
        <input type="checkbox" className="tick" checked={d} onChange={() => toggle(o)} aria-label={`Mark "${o.r.title}" ${d ? 'not done' : 'done'}`} />
        <div>
          <span className="rt-title">{o.r.title}</span>
          {(showDay || pr) && <span className="muted small"> {showDay && <b>{o.date.toLocaleDateString(undefined, { weekday: 'short' })}</b>}{pr && <> · <Link to={`/project/${pr.id}`}>{pr.name}</Link></>}</span>}
          {o.r.notes && !d && <div className="muted small">{o.r.notes}</div>}
        </div>
      </li>
    )
  }

  const nothing = !routines.length
  return (
    <section className="card routine-card">
      <div className="card-head">
        <h2>Weekly routine</h2>
        <button className="link small" onClick={onManage}>{nothing ? 'Set up' : 'Edit routine'}</button>
      </div>
      {nothing ? (
        <p className="muted">Things you do on the same days every week, like grading, check-ins or planning, can live here and show up on the right day. <button className="link" onClick={onManage}>Add your first routine</button></p>
      ) : (
        <div className="routine-cols">
          <div>
            <h3 className="sub">Today · {base.toLocaleDateString(undefined, { weekday: 'long' })}</h3>
            {todayItems.length ? <ul className="rt-list">{todayItems.map(o => row(o))}</ul> : <p className="muted small">Nothing scheduled today.</p>}
          </div>
          {open.length > 0 && (
            <div>
              <h3 className="sub">Still open</h3>
              <ul className="rt-list">{open.map(o => row(o, true))}</ul>
            </div>
          )}
          <div>
            <h3 className="sub">Coming up</h3>
            {soon.length
              ? <ul className="rt-soon">{soon.map(o => <li key={o.key}><b>{o.date.toLocaleDateString(undefined, { weekday: 'short' })}</b> {o.r.title}</li>)}</ul>
              : <p className="muted small">Nothing in the next three days.</p>}
          </div>
        </div>
      )}
      {!nothing && <p className="muted small rt-foot">{routines.length} routine{routines.length === 1 ? '' : 's'}: {[...new Set(routines.flatMap(r => r.weekdays))].length ? dayList([...new Set(routines.flatMap(r => r.weekdays))]) : ''}</p>}
    </section>
  )
}
