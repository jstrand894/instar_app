import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { dayList } from './RoutineManager'
import { deadlineInfo } from '../lib/manuscript'
import type { Project, ProjectTask, Routine, RoutineCheck } from '../types'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

interface Occ { r: Routine; date: Date; key: string }
export interface Appt { when: Date; title: string; project: Project }

const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const COMING = 5 // days ahead shown under "Coming up"

/** One agenda: calendar events and weekly routines together, for today, anything still open, and what is coming up. */
export default function RoutineCard({ routines, checks, projects, events, tasks, leaving, onTask, onMoveTask, onManage, onChange }: {
  routines: Routine[]; checks: RoutineCheck[]; projects: Project[]; events: Appt[]; tasks: ProjectTask[]; leaving: Set<string>
  onTask: (id: string) => void; onMoveTask: (id: string) => void; onManage: () => void; onChange: () => void
}) {
  const [opt, setOpt] = useState<Record<string, boolean>>({}) // instant feedback while the save finishes
  const today = new Date(); const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const { todayItems, open, soon, streak } = useMemo(() => {
    const done = new Set(checks.map(c => `${c.routine_id}|${c.on_date}`))
    const live = routines.filter(r => r.active)
    // a routine only counts from the (local) day it was created, so a new one never shows up as "missed"
    const on = (date: Date) => live.filter(r => r.weekdays.includes(date.getDay()) && iso(date) >= iso(new Date(r.created_at)))
      .map(r => ({ r, date, key: `${r.id}|${iso(date)}` }) as Occ)
    const todayItems = on(base)
    const open = [1, 2, 3].flatMap(b => on(addDays(base, -b))).filter(o => !done.has(o.key))
    const soon = Array.from({ length: COMING }, (_, i) => i + 1).flatMap(b => on(addDays(base, b)))
    // streak: consecutive days (back from yesterday, plus today once finished) where every routine due that day was checked
    let streak = 0
    for (let b = 0; b < 60; b++) {
      const occ = on(addDays(base, -b))
      if (!occ.length) continue
      if (occ.every(o => done.has(o.key))) streak++
      else if (b === 0) continue
      else break
    }
    return { todayItems, open, soon, streak }
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

  const todayIso = iso(base)
  const doneCount = todayItems.filter(isDone).length
  const dueToday = tasks.filter(t => t.due_on === todayIso)
  const overdue = tasks.filter(t => t.due_on && t.due_on < todayIso)
  const taskRow = (t: ProjectTask, late: boolean) => {
    const pr = t.project_id ? byId.get(t.project_id) : undefined; const info = deadlineInfo(t.due_on)
    return (
      <li key={t.id} className={`${late ? 'late' : ''} ${leaving.has('t' + t.id) ? 'leaving' : ''}`}>
        <input type="checkbox" className="tick" onChange={() => onTask(t.id)} aria-label={`Mark "${t.title}" done`} />
        <div>
          <span className="rt-title">{t.title}</span>
          <span className="muted small"> {late && info && <b className="rt-late">{info.text.split(' · ')[0]}</b>}{pr && <> · <Link to={`/project/${pr.id}`}>{pr.name}</Link></>}</span>
          {late && <> <button className="link small" onClick={() => onMoveTask(t.id)}>Move to today</button></>}
        </div>
      </li>
    )
  }
  const tomorrow = addDays(base, 1)
  const todayEvents = events.filter(e => e.when < tomorrow)
  const comingEvents = events.filter(e => e.when >= tomorrow && e.when < addDays(base, COMING + 1))
  const comingAll = [
    ...comingEvents.map((e, i) => ({ k: `e${i}`, t: e.when.getTime(), day: e.when, label: e.title, at: clock(e.when), pr: e.project })),
    ...soon.map(o => ({ k: o.key, t: o.date.getTime(), day: o.date, label: o.r.title, at: '', pr: o.r.project_id ? byId.get(o.r.project_id) : undefined })),
  ].sort((a, b) => a.t - b.t)

  const nothing = !routines.length && !events.length && !tasks.length
  return (
    <section className="card routine-card">
      <div className="card-head">
        <h2>Your day</h2>
        {todayItems.length > 0 && (
          <span className="rt-progress" title={`${doneCount} of ${todayItems.length} routines done today`}>
            <span className="rt-bar"><i style={{ width: `${(doneCount / todayItems.length) * 100}%` }} /></span>
            <span className="small">{doneCount} of {todayItems.length} done</span>
            {streak >= 2 && <span className="rt-streak small"><Icon name="flame" size={12} /> {streak}-day streak</span>}
          </span>
        )}
        <button className="link small" onClick={onManage}>{routines.length ? 'Edit routines' : 'Add a routine'}</button>
      </div>
      {nothing ? (
        <p className="muted">Meetings from your projects and things you do on the same days every week, like grading or planning, show up here together. <button className="link" onClick={onManage}>Add your first routine</button></p>
      ) : (
        <div className="routine-cols">
          <div>
            <h3 className="sub">Today · {base.toLocaleDateString(undefined, { weekday: 'long' })}</h3>
            {todayEvents.length + todayItems.length + dueToday.length ? (
              <ul className="rt-list">
                {todayEvents.map((e, i) => (
                  <li key={`e${i}`}>
                    <b className="rt-time">{clock(e.when)}</b>
                    <div><span className="rt-title">{e.title}</span> <span className="muted small">· <Link to={`/project/${e.project.id}`}>{e.project.name}</Link></span></div>
                  </li>
                ))}
                {dueToday.map(t => taskRow(t, false))}
                {todayItems.map(o => row(o))}
              </ul>
            ) : <p className="muted small">Nothing scheduled today.</p>}
          </div>
          {open.length + overdue.length > 0 && (
            <div>
              <h3 className="sub">Still open</h3>
              <ul className="rt-list">{overdue.map(t => taskRow(t, true))}{open.map(o => row(o, true))}</ul>
            </div>
          )}
          <div>
            <h3 className="sub">Coming up</h3>
            {comingAll.length
              ? <ul className="rt-soon">{comingAll.map(x => <li key={x.k}><b>{x.day.toLocaleDateString(undefined, { weekday: 'short' })}</b> {x.at && <span className="muted small">{x.at} </span>}{x.label}{x.pr && <span className="muted small"> · {x.pr.name}</span>}</li>)}</ul>
              : <p className="muted small">Nothing in the next few days.</p>}
          </div>
        </div>
      )}
      {routines.length > 0 && <p className="muted small rt-foot">{routines.length} routine{routines.length === 1 ? '' : 's'}: {[...new Set(routines.flatMap(r => r.weekdays))].length ? dayList([...new Set(routines.flatMap(r => r.weekdays))]) : ''}</p>}
    </section>
  )
}
