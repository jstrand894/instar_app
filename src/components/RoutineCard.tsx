import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { dayList } from './RoutineManager'
import { WhenMenu } from './TaskRow'
import InlineEdit from './InlineEdit'
import { deadlineInfo } from '../lib/manuscript'
import type { Project, ProjectTask, Routine, RoutineCheck } from '../types'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

interface Occ { r: Routine; date: Date; key: string }
export interface Appt { when: Date; title: string; project: Project }

const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const COMING = 5 // days ahead shown under "Coming up"

/** One agenda: calendar events and weekly routines together, for today, anything still open, and what is coming up. */
export default function RoutineCard({ routines, checks, projects, events, tasks, leaving, onTask, onRename, onDue, onManage, onChange }: {
  routines: Routine[]; checks: RoutineCheck[]; projects: Project[]; events: Appt[]; tasks: ProjectTask[]; leaving: Set<string>
  onTask: (id: string) => void; onRename: (id: string, title: string) => void; onDue: (id: string, due: string | null) => void; onManage: () => void; onChange: () => void
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

  // every agenda line has the same shape: a marker (tick or dot), a title, and one quiet line of details underneath
  const projLink = (pr?: Project) => pr ? <Link to={`/project/${pr.id}`} className="ag-proj">{pr.name}</Link> : null
  const row = (o: Occ, showDay = false) => {
    const d = isDone(o); const pr = o.r.project_id ? byId.get(o.r.project_id) : undefined
    return (
      <li key={o.key} className={`ag-row${d ? ' done' : ''}`}>
        <input type="checkbox" className="tick" checked={d} onChange={() => toggle(o)} aria-label={`Mark "${o.r.title}" ${d ? 'not done' : 'done'}`} />
        <div className="ag-body">
          <div className="ag-title">{o.r.title}</div>
          {(showDay || pr || (o.r.notes && !d)) && (
            <div className="ag-meta">
              {showDay && <span>{o.date.toLocaleDateString(undefined, { weekday: 'long' })}</span>}
              {projLink(pr)}
              {o.r.notes && !d && <span>{o.r.notes}</span>}
            </div>
          )}
        </div>
      </li>
    )
  }

  const todayIso = iso(base)
  const doneCount = todayItems.filter(isDone).length
  const dueToday = tasks.filter(t => t.due_on === todayIso)
  const overdue = tasks.filter(t => t.due_on && t.due_on < todayIso)
  const taskRow = (t: ProjectTask, late: boolean) => {
    const info = deadlineInfo(t.due_on); const gone = leaving.has('t' + t.id)
    return (
      <li key={t.id} className={`ag-row${gone ? ' done leaving' : ''}${late ? ' late' : ''}`}>
        <input type="checkbox" className="tick" checked={gone} onChange={() => onTask(t.id)} aria-label={`Mark "${t.title}" done`} />
        <div className="ag-body">
          <InlineEdit value={t.title} className="ag-title" onSave={v => onRename(t.id, v)} />
          <div className="ag-meta">
            {projLink(t.project_id ? byId.get(t.project_id) : undefined)}
            <WhenMenu due={t.due_on} onPick={d => onDue(t.id, d)}>{info ? <span className={`pill dl-${info.tone}`}>{info.text}</span> : <span className="ag-add">+ date</span>}</WhenMenu>
          </div>
        </div>
        <button className="link small danger ag-x" aria-label={`Delete "${t.title}"`} onClick={() => notify.undoable(`Deleted task "${t.title}"`, () => store.deleteTask(t.id), [t.id])}>×</button>
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
        {routines.length > 0 && <span className="muted small rt-days">{routines.length} routine{routines.length === 1 ? '' : 's'}{[...new Set(routines.flatMap(r => r.weekdays))].length ? `: ${dayList([...new Set(routines.flatMap(r => r.weekdays))])}` : ''}</span>}
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
              <ul className="ag-list">
                {todayEvents.map((e, i) => (
                  <li key={`e${i}`} className="ag-row">
                    <i className="ag-dot" aria-hidden />
                    <div className="ag-body">
                      <div className="ag-title">{e.title}</div>
                      <div className="ag-meta"><b className="ag-time">{clock(e.when)}</b><Link to={`/project/${e.project.id}`} className="ag-proj">{e.project.name}</Link></div>
                    </div>
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
              <ul className="ag-list">{overdue.map(t => taskRow(t, true))}{open.map(o => row(o, true))}</ul>
            </div>
          )}
          <div>
            <h3 className="sub">Coming up</h3>
            {comingAll.length
              ? <ul className="ag-list">{comingAll.map(x => (
                <li key={x.k} className="ag-row ag-up">
                  <div className="ag-date" aria-hidden>
                    <span>{x.day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    <b>{x.day.getDate()}</b>
                  </div>
                  <div className="ag-body ag-event">
                    <div className="ag-title">{x.label}</div>
                    {(x.at || x.pr) && <div className="ag-meta">{x.at && <b className="ag-time">{x.at}</b>}{x.pr && <span>{x.pr.name}</span>}</div>}
                  </div>
                </li>
              ))}</ul>
              : <p className="muted small">Nothing in the next few days.</p>}
          </div>
        </div>
      )}
    </section>
  )
}
