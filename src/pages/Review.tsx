import { useEffect, useMemo, useState } from 'react'
import BackButton from '../components/BackButton'
import { Link } from 'react-router-dom'
import { store } from '../lib/store'
import { usePrefs } from '../lib/prefs'
import { fmtMinutes } from '../lib/util'
import Icon from '../components/Icon'
import type { Deadline, Paper, Project, ProjectTask, ProjectUpdate, Routine, RoutineCheck, TimeEntry } from '../types'

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** The last seven days at a glance: what got done, what you wrote, how long you focused, what is still open. */
export default function Review() {
  const { weekStart } = usePrefs()
  const [offset, setOffset] = useState(0) // weeks back from this one
  const [data, setData] = useState<{ projects: Project[]; updates: ProjectUpdate[]; tasks: ProjectTask[]; papers: Paper[]; time: TimeEntry[]; routines: Routine[]; checks: RoutineCheck[]; deadlines: Deadline[] } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let dead = false
    Promise.all([store.projects(), store.updates(), store.tasks().catch(() => [] as ProjectTask[]), store.papers(), store.timeEntries().catch(() => [] as TimeEntry[]), store.routines().catch(() => [] as Routine[]), store.routineChecks().catch(() => [] as RoutineCheck[]), store.deadlines().catch(() => [] as Deadline[])])
      .then(([projects, updates, tasks, papers, time, routines, checks, deadlines]) => { if (!dead) setData({ projects, updates, tasks, papers, time, routines, checks, deadlines }) })
      .catch(e => { if (!dead) setError(String(e?.message ?? e)) })
    return () => { dead = true }
  }, [])

  const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = addDays(today, -((today.getDay() - weekStart + 7) % 7) - offset * 7); const end = addDays(start, 7)
  const inWeek = (s?: string | null) => !!s && new Date(s) >= start && new Date(s) < end

  const r = useMemo(() => {
    if (!data) return null
    const byId = new Map(data.projects.map(p => [p.id, p]))
    const doneTasks = data.tasks.filter(t => t.done && inWeek(t.done_at))
    const ups = data.updates.filter(u => inWeek(u.created_at) && byId.has(u.project_id))
    const commits = ups.filter(u => u.kind === 'commit').length
    const writes = ups.filter(u => u.kind !== 'commit')
    const read = data.papers.filter(p => inWeek(p.read_at))
    const mins = data.time.filter(t => inWeek(t.started_at)).reduce((a, t) => a + t.minutes, 0)
    const perDay = Array.from({ length: 7 }, (_, i) => { const d = addDays(start, i); return { d, m: data.time.filter(t => { const x = new Date(t.started_at); return x >= d && x < addDays(d, 1) }).reduce((a, t) => a + t.minutes, 0) } })
    // routines: each active routine counts once for every scheduled day in the week (on or after the day it was created, up to today)
    let sched = 0, ticked = 0
    const checkSet = new Set(data.checks.map(c => `${c.routine_id}|${c.on_date}`))
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i); if (d > today) break
      for (const ro of data.routines.filter(x => x.active && x.weekdays.includes(d.getDay()) && iso(d) >= iso(new Date(x.created_at)))) { sched++; if (checkSet.has(`${ro.id}|${iso(d)}`)) ticked++ }
    }
    const byProject = new Map<string, { p: Project; updates: ProjectUpdate[]; tasks: ProjectTask[] }>()
    const slot = (id: string) => { const p = byId.get(id); if (!p) return null; if (!byProject.has(id)) byProject.set(id, { p, updates: [], tasks: [] }); return byProject.get(id)! }
    for (const u of writes) slot(u.project_id)?.updates.push(u)
    for (const t of doneTasks) if (t.project_id) slot(t.project_id)?.tasks.push(t)
    const general = doneTasks.filter(t => !t.project_id)
    const carry = data.tasks.filter(t => !t.done && t.due_on && t.due_on < iso(end) && (!t.project_id || byId.has(t.project_id)))
    const dlHit = data.deadlines.filter(d => d.done && inWeek(d.due_on)).length
    return { byId, doneTasks, ups: writes, commits, read, mins, perDay, sched, ticked, groups: [...byProject.values()].sort((a, b) => (b.updates.length + b.tasks.length) - (a.updates.length + a.tasks.length)), general, carry, dlHit }
  }, [data, offset, weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  const label = `${short(start)} – ${short(addDays(end, -1))}`
  const dayMax = Math.max(30, ...(r?.perDay.map(x => x.m) ?? [0]))
  return (
    <div className="page review">
      <header className="page-head">
        <div><div className="title-row"><h1>Weekly review</h1><BackButton /></div><p className="muted today-date">{offset === 0 ? 'This week' : offset === 1 ? 'Last week' : `${offset} weeks ago`} · {label}</p></div>
        <div className="seg" role="group" aria-label="Week">
          <button onClick={() => setOffset(offset + 1)} aria-label="Previous week">← Earlier</button>
          <button onClick={() => setOffset(0)} className={offset === 0 ? 'on' : ''}>This week</button>
          <button onClick={() => setOffset(Math.max(0, offset - 1))} disabled={offset === 0} aria-label="Next week">Later →</button>
        </div>
      </header>
      {error && <div className="errbar" role="alert">{error}</div>}
      {!r ? <div className="today-skel"><div className="sk sk-row" /><div className="sk sk-card" /></div> : (
        <>
          <div className="rv-stats">
            <div><b>{r.doneTasks.length}</b><span>tasks done</span></div>
            <div><b>{r.ups.length}</b><span>updates and notes</span></div>
            <div><b>{r.commits}</b><span>pushes to GitHub</span></div>
            <div><b>{r.read.length}</b><span>papers read</span></div>
            <div><b>{r.mins ? fmtMinutes(r.mins) : '0m'}</b><span>focus time</span></div>
            <div><b>{r.sched ? `${r.ticked}/${r.sched}` : '–'}</b><span>routines kept</span></div>
          </div>

          <div className="today-grid rv-grid">
            <section className="card">
              <h2>Focus by day</h2>
              {r.mins > 0 ? (
                <div className="focus-days" role="img" aria-label={r.perDay.map(x => `${x.d.toLocaleDateString(undefined, { weekday: 'long' })} ${fmtMinutes(x.m)}`).join(', ')}>
                  {r.perDay.map(x => <div key={+x.d} className={`fd ${+x.d === +today ? 'today' : ''}`} title={`${x.d.toLocaleDateString(undefined, { weekday: 'long' })}: ${fmtMinutes(x.m)}`}><i style={{ height: `${Math.max(x.m ? 6 : 0, (x.m / dayMax) * 100)}%` }} /><span>{x.d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span></div>)}
                </div>
              ) : <p className="muted">No timer sessions this week.</p>}
              {r.dlHit > 0 && <p className="small muted" style={{ margin: 0 }}>{r.dlHit} deadline{r.dlHit === 1 ? '' : 's'} met this week.</p>}
            </section>

            <section className="card">
              <h2>Still open {r.carry.length > 0 && <span className="count-pill">{r.carry.length}</span>}</h2>
              <p className="muted small" style={{ margin: 0 }}>Tasks due by the end of this week that aren't done yet.</p>
              {r.carry.slice(0, 8).map(t => { const pr = t.project_id ? r.byId.get(t.project_id) : undefined; return <div className="trow" key={t.id}><span>{t.title}</span><span className="muted small">{t.due_on}</span>{pr ? <Link to={`/project/${pr.id}`} className="muted small">{pr.name}</Link> : null}</div> })}
              {r.carry.length > 8 && <p className="muted small" style={{ margin: 0 }}>+{r.carry.length - 8} more</p>}
              {!r.carry.length && <p className="muted" style={{ margin: 0 }}>Nothing left over. Clean slate.</p>}
            </section>

            <section className="card wide">
              <h2>What happened, by project</h2>
              {r.groups.map(g => (
                <div className="rv-proj" key={g.p.id}>
                  <Link to={`/project/${g.p.id}`}><b>{g.p.name}</b></Link>
                  <ul>
                    {g.tasks.map(t => <li key={t.id}><Icon name="check" size={13} /> {t.title}</li>)}
                    {g.updates.map(u => <li key={u.id}><span className="muted small">{new Date(u.created_at).toLocaleDateString(undefined, { weekday: 'short' })}</span> {u.body.length > 160 ? u.body.slice(0, 160) + '…' : u.body}</li>)}
                  </ul>
                </div>
              ))}
              {r.general.length > 0 && <div className="rv-proj"><b>General to-dos</b><ul>{r.general.map(t => <li key={t.id}><Icon name="check" size={13} /> {t.title}</li>)}</ul></div>}
              {r.read.length > 0 && <div className="rv-proj"><b>Read this week</b><ul>{r.read.map(p => <li key={p.id}><Link to={`/read/${p.id}`}>{p.title}</Link></li>)}</ul></div>}
              {!r.groups.length && !r.general.length && !r.read.length && <p className="muted" style={{ margin: 0 }}>Nothing logged for this week yet.</p>}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
