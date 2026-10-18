import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../lib/store'
import { friendlyError } from '../lib/errors'
import { ago, fmtMinutes, greeting, occurrencesBetween } from '../lib/util'
import { firstName } from '../lib/user'
import { deadlineInfo } from '../lib/manuscript'
import ProgressChart from '../components/ProgressChart'
import GettingStarted from '../components/GettingStarted'
import RoutineCard from '../components/RoutineCard'
import RoutineManager from '../components/RoutineManager'
import type { Deadline, Paper, Project, ProjectEvent, ProjectTask, ProjectUpdate, Routine, RoutineCheck, TimeEntry } from '../types'

const DAY = 864e5
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const link = (p: Project) => `/project/${p.id}`

export default function Today() {
  const [projects, setProjects] = useState<Project[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [events, setEvents] = useState<ProjectEvent[]>([])
  const [papers, setPapers] = useState<Paper[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [time, setTime] = useState<TimeEntry[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [checks, setChecks] = useState<RoutineCheck[]>([])
  const [manage, setManage] = useState(false)
  const [todo, setTodo] = useState('')
  const [todoDue, setTodoDue] = useState('')
  useEffect(() => { const on = () => setManage(true); window.addEventListener('tm-routines', on); return () => window.removeEventListener('tm-routines', on) }, [])
  const [dlOpen, setDlOpen] = useState(false)
  const [dlTitle, setDlTitle] = useState('')
  const [dlDate, setDlDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  const [dlProject, setDlProject] = useState('')
  const [target, setTarget] = useState('')
  const [text, setText] = useState('')
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  useEffect(() => { firstName().then(setName).catch(() => {}) }, [])

  const load = useCallback(async () => {
    try {
      const [p, u, e, pa, dl, tk, te, ro, rc] = await Promise.all([store.projects(), store.updates(), store.events().catch(() => [] as ProjectEvent[]), store.papers(), store.deadlines().catch(() => [] as Deadline[]), store.tasks().catch(() => [] as ProjectTask[]), store.timeEntries().catch(() => [] as TimeEntry[]), store.routines().catch(() => [] as Routine[]), store.routineChecks().catch(() => [] as RoutineCheck[])])
      setProjects(p); setUpdates(u); setEvents(e); setPapers(pa); setDeadlines(dl); setTasks(tk); setTime(te); setRoutines(ro); setChecks(rc)
    } catch (er) { setError(friendlyError(er)) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { window.addEventListener('tm-data', load); return () => window.removeEventListener('tm-data', load) }, [load])

  const byId = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])
  const live = projects.filter(p => p.status === 'active' && p.stage !== 'accepted')
  const now = new Date(); const today = startOfDay(now)

  // schedule: today + next 7 days
  const upcoming = useMemo(() => {
    const out: { when: Date; title: string; project: Project }[] = []
    for (const e of events) {
      const pr = byId.get(e.project_id); if (!pr) continue
      for (const d of occurrencesBetween(e, today, addDays(today, 8))) if (d.getTime() >= now.getTime() - 36e5 || d < addDays(today, 1)) out.push({ when: d, title: e.title, project: pr })
    }
    return out.sort((a, b) => a.when.getTime() - b.when.getTime())
  }, [events, byId]) // eslint-disable-line react-hooks/exhaustive-deps
  const todays = upcoming.filter(x => x.when < addDays(today, 1))
  const later = upcoming.filter(x => x.when >= addDays(today, 1))

  // manuscript "next deadline" fields plus standalone deadlines, soonest first
  const dueItems = [
    ...projects.filter(p => p.type === 'manuscript' && p.stage !== 'accepted' && p.deadline)
      .map(p => ({ key: 'm' + p.id, title: 'Next deadline', project: p, date: p.deadline!, id: null as string | null })),
    ...deadlines.filter(d => !d.done).map(d => ({ key: d.id, title: d.title, project: byId.get(d.project_id), date: d.due_on, id: d.id as string | null })),
  ].map(x => ({ ...x, info: deadlineInfo(x.date)! })).filter(x => x.project && x.info.days <= 21).sort((a, b) => a.info.days - b.info.days)

  const lastTouch = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of updates) { const c = m.get(u.project_id); if (!c || u.created_at > c) m.set(u.project_id, u.created_at) }
    return m
  }, [updates])
  const stale = live.map(p => ({ p, days: Math.floor((now.getTime() - new Date(lastTouch.get(p.id) ?? p.created_at).getTime()) / DAY) }))
    .filter(x => x.days >= 14).sort((a, b) => b.days - a.days).slice(0, 6)

  const reading = papers.filter(p => p.status === 'reading').slice(0, 6)
  const coreLeft = papers.filter(p => p.status === 'to-read' && p.priority === 'Core').length
  const recent = [...updates].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8)

  // open tasks across every project, soonest first; undated ones come last
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayIso = iso(today)
  const openTasks = tasks.filter(t => !t.done && (!t.project_id || byId.has(t.project_id)))
    .sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999') || a.created_at.localeCompare(b.created_at))
  const tasksDueNow = openTasks.filter(t => t.due_on && t.due_on <= todayIso).length

  // focus time from the timer: this week, by day and by project
  const monday = new Date(today); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const weekTime = time.filter(t => new Date(t.started_at) >= monday)
  const weekMinutes = weekTime.reduce((a, t) => a + t.minutes, 0)
  const perProject = [...weekTime.reduce((m, t) => m.set(t.project_id ?? '', (m.get(t.project_id ?? '') ?? 0) + t.minutes), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i)
    return { d, m: time.filter(t => { const x = new Date(t.started_at); return x >= d && x < addDays(d, 1) }).reduce((a, t) => a + t.minutes, 0) }
  })
  const dayMax = Math.max(30, ...perDay.map(x => x.m))

  const dueThisWeek = dueItems.filter(x => x.info.days <= 7).length
  const summary = [
    todays.length ? `${todays.length} event${todays.length === 1 ? '' : 's'} today` : '',
    tasksDueNow ? `${tasksDueNow} task${tasksDueNow === 1 ? '' : 's'} due` : '',
    dueThisWeek ? `${dueThisWeek} deadline${dueThisWeek === 1 ? '' : 's'} this week` : '',
  ].filter(Boolean).join(' · ')

  async function addDeadline(e: React.FormEvent) {
    e.preventDefault()
    if (!dlTitle.trim() || !dlDate || !dlProject) return
    try { await store.addDeadline(dlProject, dlTitle.trim(), dlDate); setDlTitle(''); setDlOpen(false); load() } catch (er) { setError(friendlyError(er)) }
  }
  async function addTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!todo.trim()) return
    try { await store.addTask(null, todo.trim(), todoDue || null); setTodo(''); setTodoDue(''); load() } catch (er) { setError(friendlyError(er)) }
  }
  async function checkOff(id: string) {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: true } : t))
    try { await store.patchTask(id, { done: true }) } catch (er) { setError(friendlyError(er)); load() }
  }
  async function finish(id: string) {
    setDeadlines(ds => ds.map(d => d.id === id ? { ...d, done: true } : d))
    try { await store.patchDeadline(id, { done: true }) } catch (er) { setError(friendlyError(er)); load() }
  }

  async function log(e: React.FormEvent) {
    e.preventDefault()
    if (!target || !text.trim()) return
    try {
      await store.addUpdate(target, text.trim()); setSaved(`Logged to ${byId.get(target)?.name}`); setText(''); load()
      setTimeout(() => setSaved(''), 3000)
    } catch (er) { setError(friendlyError(er)) }
  }

  const choices = [...live].sort((a, b) => (lastTouch.get(b.id) ?? '').localeCompare(lastTouch.get(a.id) ?? ''))
  const group = (label: string, list: Project[]) => list.length > 0 && <optgroup label={label}>{list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>

  return (
    <div className="page today">
      <header className="page-head">
        <div>
          <h1>{greeting(now.getHours())}{name ? `, ${name}` : ''}</h1>
          <p className="muted today-date">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}{summary && ` · ${summary}`}</p>
        </div>
        <button className="today-search" onClick={() => window.dispatchEvent(new CustomEvent('tm-search'))} aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg> Search <kbd>⌘K</kbd>
        </button>
      </header>
      {error && <p className="error">{error}</p>}

      <form className="card quick" onSubmit={log}>
        <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Project">
          <option value="">Log an update to…</option>
          {group('Manuscripts', choices.filter(p => p.type === 'manuscript'))}
          {group('Work', choices.filter(p => p.type !== 'manuscript' && (p.area ?? 'work') === 'work'))}
          {group('Home', choices.filter(p => p.type !== 'manuscript' && p.area === 'home'))}
        </select>
        <input placeholder="What did you do or decide?" value={text} onChange={e => setText(e.target.value)} />
        <button className="primary" disabled={!target || !text.trim()}>Log</button>
        {saved && <span className="ok small">{saved}</span>}
      </form>

      <GettingStarted projects={projects} updates={updates} papers={papers} />

      <RoutineCard routines={routines} checks={checks} projects={projects} onManage={() => setManage(true)} onChange={load} />
      {manage && <RoutineManager routines={routines} projects={projects} onClose={() => { setManage(false); load() }} />}

      <ProgressChart updates={updates} projects={projects} papers={papers} tasks={tasks} />

      <div className="today-grid">
        <section className="card">
          <h2>On your schedule</h2>
          {todays.length > 0 && <>
            <h3 className="sub">Today</h3>
            {todays.map((x, i) => <Row key={i} when={clock(x.when)} title={x.title} project={x.project} />)}
          </>}
          {later.length > 0 && <>
            <h3 className="sub">Coming up</h3>
            {later.map((x, i) => <Row key={i} when={`${x.when.toLocaleDateString(undefined, { weekday: 'short' })} ${clock(x.when)}`} title={x.title} project={x.project} />)}
          </>}
          {!upcoming.length && <p className="muted">Nothing scheduled in the next week. Add meetings from a project's Schedule section.</p>}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Deadlines</h2>
            <button className="plus" onClick={() => setDlOpen(!dlOpen)} aria-label="Add a deadline" aria-expanded={dlOpen} title="Add a deadline"><svg className={`plus-ico ${dlOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" /></svg></button>
          </div>
          {dlOpen && (
            <form className="dl-form" onSubmit={addDeadline}>
              <input autoFocus placeholder="What's due? e.g. Reviewer responses" value={dlTitle} onChange={e => setDlTitle(e.target.value)} />
              <div className="row">
                <input type="date" value={dlDate} onChange={e => setDlDate(e.target.value)} aria-label="Due date" />
                <select value={dlProject} onChange={e => setDlProject(e.target.value)} aria-label="Project or manuscript">
                  <option value="">For which project…</option>
                  {group('Manuscripts', projects.filter(p => p.type === 'manuscript' && p.stage !== 'accepted'))}
                  {group('Projects', projects.filter(p => p.type !== 'manuscript' && p.status !== 'done'))}
                </select>
              </div>
              <button className="primary" disabled={!dlTitle.trim() || !dlProject || !dlDate}>Add deadline</button>
            </form>
          )}
          {dueItems.map(x => (
            <div className="trow" key={x.key}>
              {x.id
                ? <input type="checkbox" className="tick" aria-label={`Mark "${x.title}" done`} onChange={() => finish(x.id!)} />
                : <span className="tick-gap" />}
              <span className={`pill dl-${x.info.tone}`}>{x.info.text}</span>
              <span>{x.title}</span>
              <Link to={link(x.project!)} className="muted small">{x.project!.name}</Link>
            </div>
          ))}
          {!dueItems.length && !dlOpen && <p className="muted">Nothing due in the next three weeks. Use + to add a deadline.</p>}
        </section>

        <section className="card">
          <div className="card-head"><h2>To-dos {openTasks.length > 0 && <span className="count-pill">{openTasks.length}</span>}</h2></div>
          <form className="todo-add" onSubmit={addTodo}>
            <input placeholder="Add a to-do (not tied to a project)…" value={todo} onChange={e => setTodo(e.target.value)} />
            <input type="date" value={todoDue} onChange={e => setTodoDue(e.target.value)} aria-label="Due date (optional)" />
            <button className="primary" disabled={!todo.trim()}>Add</button>
          </form>
          {openTasks.slice(0, 8).map(t => {
            const info = deadlineInfo(t.due_on); const pr = t.project_id ? byId.get(t.project_id) : undefined
            return (
              <div className="trow" key={t.id}>
                <input type="checkbox" className="tick" aria-label={`Mark "${t.title}" done`} onChange={() => checkOff(t.id)} />
                <span>{t.title}</span>
                {info && <span className={`pill dl-${info.tone}`}>{info.text}</span>}
                {pr ? <Link to={link(pr)} className="muted small">{pr.name}</Link> : <span className="muted small">General</span>}
              </div>
            )
          })}
          {openTasks.length > 8 && <p className="muted small">+{openTasks.length - 8} more inside your projects</p>}
          {!openTasks.length && <p className="muted">Nothing to do right now. Add a to-do above, or add tasks inside a project.</p>}
        </section>

        <section className="card">
          <h2>Needs attention</h2>
          {stale.map(({ p, days }) => (
            <div className="trow" key={p.id}><Link to={link(p)}>{p.name}</Link><span className="muted small">no update in {days} days</span></div>
          ))}
          {!stale.length && <p className="muted">Every active project has been touched in the last two weeks.</p>}
        </section>

        <section className="card">
          <h2>Focus time</h2>
          {weekMinutes > 0 ? (
            <>
              <p className="focus-total"><b>{fmtMinutes(weekMinutes)}</b> <span className="muted">this week · {weekTime.length} session{weekTime.length === 1 ? '' : 's'}</span></p>
              <div className="focus-days" role="img" aria-label={perDay.map(x => `${x.d.toLocaleDateString(undefined, { weekday: 'long' })} ${fmtMinutes(x.m)}`).join(', ')}>
                {perDay.map(x => (
                  <div key={+x.d} className={`fd ${+x.d === +today ? 'today' : ''}`} title={`${x.d.toLocaleDateString(undefined, { weekday: 'long' })}: ${fmtMinutes(x.m)}`}>
                    <i style={{ height: `${Math.max(x.m ? 6 : 0, (x.m / dayMax) * 100)}%` }} /><span>{x.d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                  </div>
                ))}
              </div>
              {perProject.map(([id, m]) => (
                <div className="trow" key={id || 'none'}>
                  <span className="muted small fp-time">{fmtMinutes(m)}</span>
                  {id && byId.get(id) ? <Link to={link(byId.get(id)!)} className="small">{byId.get(id)!.name}</Link> : <span className="muted small">No project</span>}
                </div>
              ))}
            </>
          ) : <p className="muted">No focus time yet this week. Start the timer in the sidebar (on a Mac), pick a project, and your focused time adds up here.</p>}
        </section>

        <section className="card">
          <h2>Reading now</h2>
          {reading.map(p => (
            <div className="trow" key={p.id}><Link to={`/read/${p.id}`}>{p.title}</Link><span className="muted small">{[p.authors.split(',')[0], p.year].filter(Boolean).join(' ')}</span></div>
          ))}
          {!reading.length && <p className="muted">Nothing marked "Reading". Set a paper's status in the Reading tab.</p>}
          {coreLeft > 0 && <Link to="/library" className="link small">{coreLeft} Core papers still to read →</Link>}
        </section>

        <section className="card wide">
          <h2>Recent activity</h2>
          {recent.map(u => {
            const pr = byId.get(u.project_id)
            return (
              <div className="trow act" key={u.id}>
                <time className="muted small">{ago(u.created_at)}</time>
                {pr ? <Link to={link(pr)} className="small"><b>{pr.name}</b></Link> : <span />}
                <span>{u.kind === 'note' ? 'Note · ' : ''}{u.body.length > 120 ? u.body.slice(0, 120) + '…' : u.body}</span>
              </div>
            )
          })}
          {!recent.length && <p className="muted">No activity yet.</p>}
        </section>
      </div>
    </div>
  )
}

function Row({ when, title, project }: { when: string; title: string; project: Project }) {
  return (
    <div className="trow">
      <b className="when">{when}</b>
      <span>{title}</span>
      <Link to={link(project)} className="muted small">{project.name}</Link>
    </div>
  )
}
