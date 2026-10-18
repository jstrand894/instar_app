import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../lib/store'
import { ago, occurrencesBetween } from '../lib/util'
import { deadlineInfo, stageLabel } from '../lib/manuscript'
import type { Paper, Project, ProjectEvent, ProjectUpdate } from '../types'

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
  const [target, setTarget] = useState('')
  const [text, setText] = useState('')
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [p, u, e, pa] = await Promise.all([store.projects(), store.updates(), store.events().catch(() => [] as ProjectEvent[]), store.papers()])
      setProjects(p); setUpdates(u); setEvents(e); setPapers(pa)
    } catch (er) { setError((er as Error).message) }
  }, [])
  useEffect(() => { load() }, [load])

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

  const deadlines = projects
    .filter(p => p.type === 'manuscript' && p.stage !== 'accepted' && p.deadline)
    .map(p => ({ p, d: deadlineInfo(p.deadline)! })).filter(x => x.d.days <= 21).sort((a, b) => a.d.days - b.d.days)

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

  async function log(e: React.FormEvent) {
    e.preventDefault()
    if (!target || !text.trim()) return
    try {
      await store.addUpdate(target, text.trim()); setSaved(`Logged to ${byId.get(target)?.name}`); setText(''); load()
      setTimeout(() => setSaved(''), 3000)
    } catch (er) { setError((er as Error).message) }
  }

  const choices = [...live].sort((a, b) => (lastTouch.get(b.id) ?? '').localeCompare(lastTouch.get(a.id) ?? ''))
  const group = (label: string, list: Project[]) => list.length > 0 && <optgroup label={label}>{list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>

  return (
    <div className="page today">
      <header className="page-head">
        <div><h1>Today</h1><p className="muted today-date">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p></div>
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
          <h2>Deadlines</h2>
          {deadlines.map(({ p, d }) => (
            <div className="trow" key={p.id}>
              <span className={`pill dl-${d.tone}`}>{d.text}</span>
              <Link to={link(p)}>{p.name}</Link><span className="muted small">{stageLabel(p.stage)}</span>
            </div>
          ))}
          {!deadlines.length && <p className="muted">No manuscript deadlines in the next three weeks.</p>}
        </section>

        <section className="card">
          <h2>Needs attention</h2>
          {stale.map(({ p, days }) => (
            <div className="trow" key={p.id}><Link to={link(p)}>{p.name}</Link><span className="muted small">no update in {days} days</span></div>
          ))}
          {!stale.length && <p className="muted">Every active project has been touched in the last two weeks.</p>}
        </section>

        <section className="card">
          <h2>Reading now</h2>
          {reading.map(p => (
            <div className="trow" key={p.id}><Link to={`/read/${p.id}`}>{p.title}</Link><span className="muted small">{[p.authors.split(',')[0], p.year].filter(Boolean).join(' ')}</span></div>
          ))}
          {!reading.length && <p className="muted">Nothing marked "Reading". Set a paper's status in the Papers tab.</p>}
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
