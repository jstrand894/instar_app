import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { friendlyError } from '../lib/errors'
import { ago, fmtWhen, nextOccurrence } from '../lib/util'
import { STAGES, deadlineInfo, stageLabel } from '../lib/manuscript'
import TaskList from '../components/TaskList'
import type { Area, Deadline, ProjectTask, Paper, PaperLink, Project, ProjectEvent, ProjectStatus, ProjectType, ProjectUpdate, Stage } from '../types'

const TYPES: { id: ProjectType; label: string }[] = [
  { id: 'manuscript', label: 'Manuscript' }, { id: 'data', label: 'Data' },
  { id: 'field', label: 'Field work' }, { id: 'code', label: 'Code' }, { id: 'other', label: 'Other' },
]

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
  ' · ' + new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export default function ProjectDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [entries, setEntries] = useState<ProjectUpdate[]>([])
  const [events, setEvents] = useState<ProjectEvent[]>([])
  const [papers, setPapers] = useState<Paper[]>([])
  const [links, setLinks] = useState<PaperLink[]>([])
  const [paperQ, setPaperQ] = useState('')
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [dlTitle, setDlTitle] = useState('')
  const [dlDate, setDlDate] = useState('')
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const [evTitle, setEvTitle] = useState('')
  const [evDate, setEvDate] = useState(todayStr)
  const [evTime, setEvTime] = useState('10:00')
  const [evWeekly, setEvWeekly] = useState(false)
  const [kind, setKind] = useState<'update' | 'note'>('update')
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [ps, us, evs, pp, ls, dls, tks] = await Promise.all([store.projects(), store.updates(), store.events().catch(() => [] as ProjectEvent[]), store.papers(), store.projectPapers().catch(() => [] as PaperLink[]), store.deadlines().catch(() => [] as Deadline[]), store.tasks().catch(() => [] as ProjectTask[])])
      setEvents(evs.filter(e => e.project_id === id)); setPapers(pp); setLinks(ls.filter(l => l.project_id === id)); setDeadlines(dls.filter(d => d.project_id === id)); setTasks(tks.filter(t => t.project_id === id))
      const p = ps.find(x => x.id === id) ?? null
      setProject(p)
      setEntries(us.filter(u => u.project_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)))
      if (!p) setError('Project not found.')
    } catch (e) { setError(friendlyError(e)) }
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { window.addEventListener('tm-data', load); return () => window.removeEventListener('tm-data', load) }, [load])

  async function patch(p: Partial<Project>) {
    if (!project) return
    setProject({ ...project, ...p })
    try { await store.patchProject(project.id, p) } catch (e) { setError(friendlyError(e)) }
  }

  async function addDeadline(e: React.FormEvent) {
    e.preventDefault()
    if (!project || !dlTitle.trim() || !dlDate) return
    try { await store.addDeadline(project.id, dlTitle.trim(), dlDate); setDlTitle(''); load() } catch (er) { setError(friendlyError(er)) }
  }

  async function setStage(next: Stage) {
    if (!project) return
    const prev = project.stage ?? 'drafting'; if (prev === next) return
    await patch({ stage: next })
    try { await store.addUpdate(project.id, `Stage: ${stageLabel(prev)} → ${stageLabel(next)}`); load() } catch (e) { setError(friendlyError(e)) }
  }

  const linkedIds = new Set(links.map(l => l.paper_id))
  const linked = papers.filter(p => linkedIds.has(p.id))
  const needle = paperQ.trim().toLowerCase()
  const matches = needle ? papers.filter(p => !linkedIds.has(p.id) && `${p.title} ${p.authors} ${p.year}`.toLowerCase().includes(needle)).slice(0, 8) : []

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !project) return
    try { await store.addUpdate(project.id, text.trim(), kind); setText(''); load() } catch (er) { setError(friendlyError(er)) }
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!evTitle.trim() || !evDate || !evTime || !project) return
    const starts = new Date(`${evDate}T${evTime}`)
    if (isNaN(starts.getTime())) return
    try { await store.addEvent(project.id, evTitle.trim(), starts.toISOString(), evWeekly ? 'weekly' : 'none'); setEvTitle(''); load() } catch (er) { setError(friendlyError(er)) }
  }

  async function saveEntry(u: ProjectUpdate, body: string) {
    if (body === u.body) return
    if (!body.trim()) { setError('An entry can’t be empty. Use Delete to remove it.'); load(); return }
    setEntries(es => es.map(x => x.id === u.id ? { ...x, body } : x))
    try { await store.patchUpdate(u.id, { body }) } catch (e) { setError(friendlyError(e)) }
  }

  if (!project) return <div className="page">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}<Link to="/projects" className="link">← Projects</Link></div>

  return (
    <div className="page detail">
      <Link to={project.type === 'manuscript' ? '/manuscripts' : '/projects'} className="link back-link">← {project.type === 'manuscript' ? 'Manuscripts' : 'Projects'}</Link>
      <header className="detail-head">
        <button className={`star big ${project.pinned ? 'on' : ''}`} onClick={() => patch({ pinned: !project.pinned })} aria-pressed={!!project.pinned} title={project.pinned ? 'Unpin' : 'Pin to top'}>{project.pinned ? '★' : '☆'}</button>
        <input className="title-input" defaultValue={project.name} aria-label="Project name"
          onBlur={e => e.target.value.trim() && e.target.value !== project.name && patch({ name: e.target.value.trim() })} />
        <div className="row wrap">
          <select value={project.area ?? 'work'} onChange={e => patch({ area: e.target.value as Area })} aria-label="Work or home">
            <option value="work">Work</option><option value="home">Home</option>
          </select>
          <select value={project.type} onChange={e => patch({ type: e.target.value as ProjectType })} aria-label="Type">
            {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select value={project.status} onChange={e => patch({ status: e.target.value as ProjectStatus })} aria-label="Status">
            {(['active', 'paused', 'done'] as ProjectStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </header>
      <input className="desc-input" placeholder="Short description" defaultValue={project.description}
        onBlur={e => e.target.value !== project.description && patch({ description: e.target.value })} />
      {error && <p className="error">{error}</p>}

      {project.type === 'manuscript' && (
        <section className="card ms-panel">
          <h2>Manuscript</h2>
          <div className="ms-grid">
            <label>Stage
              <select value={project.stage ?? 'drafting'} onChange={e => setStage(e.target.value as Stage)}>
                {STAGES.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
              </select>
            </label>
            <label>Journal
              <input placeholder="Target or submitted journal" defaultValue={project.journal ?? ''} onBlur={e => e.target.value !== (project.journal ?? '') && patch({ journal: e.target.value })} />
            </label>
            <label>Co-authors
              <input placeholder="e.g. Smith, Jones, Lee" defaultValue={project.coauthors ?? ''} onBlur={e => e.target.value !== (project.coauthors ?? '') && patch({ coauthors: e.target.value })} />
            </label>
            <label>Next deadline
              <span className="row">
                <input type="date" value={project.deadline ?? ''} onChange={e => patch({ deadline: e.target.value || null })} />
                {project.deadline && <button type="button" className="link small" onClick={() => patch({ deadline: null })}>Clear</button>}
              </span>
            </label>
          </div>
          {deadlineInfo(project.deadline) && <span className={`pill dl-${deadlineInfo(project.deadline)!.tone}`}>{deadlineInfo(project.deadline)!.text}</span>}
        </section>
      )}

      <section className="card schedule">
        <h2>Schedule</h2>
        <form className="sched-form" onSubmit={addEvent}>
          <input placeholder="What? e.g. Team meeting" value={evTitle} onChange={e => setEvTitle(e.target.value)} />
          <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} aria-label="Date" />
          <input type="time" value={evTime} onChange={e => setEvTime(e.target.value)} aria-label="Time" />
          <label className="check"><input type="checkbox" checked={evWeekly} onChange={e => setEvWeekly(e.target.checked)} />
            Repeats weekly{evWeekly && evDate ? ` on ${new Date(`${evDate}T00:00`).toLocaleDateString(undefined, { weekday: 'long' })}s` : ''}</label>
          <button className="primary" disabled={!evTitle.trim()}>Schedule</button>
        </form>
        <ul className="sched-list">
          {events.map(e => ({ e, when: nextOccurrence(e) })).filter(x => x.when).sort((a, b) => a.when!.getTime() - b.when!.getTime()).map(({ e, when }) => (
            <li key={e.id}>
              <b>{fmtWhen(when!)}</b><span>{e.title}{e.repeat === 'weekly' && <i className="rep"> ↻ weekly</i>}</span>
              <button className="link small danger" onClick={() => notify.undoable(`Removed "${e.title}"`, () => store.deleteEvent(e.id), [e.id])}>Remove</button>
            </li>
          ))}
          {!events.some(e => nextOccurrence(e)) && <li className="muted">Nothing scheduled.</li>}
        </ul>
      </section>

      <TaskList projectId={project.id} tasks={tasks} onChange={load} />

      <section className="card deadlines">
        <h2>Deadlines</h2>
        <form className="sched-form dl-row" onSubmit={addDeadline}>
          <input placeholder="What's due? e.g. Submit revision" value={dlTitle} onChange={e => setDlTitle(e.target.value)} />
          <input type="date" value={dlDate} onChange={e => setDlDate(e.target.value)} aria-label="Due date" />
          <button className="primary" disabled={!dlTitle.trim() || !dlDate}>Add</button>
        </form>
        <ul className="sched-list dl-list">
          {[...deadlines].sort((a, b) => Number(a.done) - Number(b.done) || a.due_on.localeCompare(b.due_on)).map(d => {
            const info = deadlineInfo(d.due_on)
            return (
              <li key={d.id} className={d.done ? 'done-row' : ''}>
                <label className="dl-check"><input type="checkbox" checked={d.done} onChange={async e => { await store.patchDeadline(d.id, { done: e.target.checked }); load() }} /> <span>{d.title}</span></label>
                {info && !d.done ? <span className={`pill dl-${info.tone}`}>{info.text}</span> : <span className="muted small">{d.done ? 'Done' : ''}</span>}
                <button className="link small danger" onClick={() => notify.undoable(`Removed deadline "${d.title}"`, () => store.deleteDeadline(d.id), [d.id])}>Remove</button>
              </li>
            )
          })}
          {!deadlines.length && <li className="muted">No deadlines yet.</li>}
        </ul>
      </section>

      <section className="card reading">
        <h2>Reading</h2>
        <ul className="linked">
          {linked.map(p => (
            <li key={p.id}>
              <div><Link to={`/read/${p.id}`} className="paper-title">{p.title}</Link>
                <div className="muted small">{[p.authors, p.year].filter(Boolean).join(' · ')} <span className={`pill st-${p.status}`}>{p.status.replace('-', ' ')}</span></div></div>
              <button className="link small danger" onClick={async () => { await store.unlinkPaper(project.id, p.id); load() }}>Unlink</button>
            </li>
          ))}
          {!linked.length && <li className="muted">No papers linked yet.</li>}
        </ul>
        <input placeholder="Search your library to link a paper…" value={paperQ} onChange={e => setPaperQ(e.target.value)} />
        {matches.length > 0 && (
          <ul className="matches">
            {matches.map(p => (
              <li key={p.id}><button onClick={async () => { await store.linkPaper(project.id, p.id); setPaperQ(''); load() }}>
                <b>{p.title}</b><span className="muted small">{[p.authors, p.year].filter(Boolean).join(' · ')}</span></button></li>
            ))}
          </ul>
        )}
        {needle && !matches.length && <p className="muted small">No unlinked papers match. <Link to="/library" className="link">Add papers in the library</Link>.</p>}
      </section>

      <form className="card composer" onSubmit={add}>
        <div className="seg" role="tablist">
          <button type="button" className={kind === 'update' ? 'on' : ''} onClick={() => setKind('update')}>Update</button>
          <button type="button" className={kind === 'note' ? 'on' : ''} onClick={() => setKind('note')}>Note</button>
        </div>
        <textarea
          placeholder={kind === 'update' ? 'What happened? e.g. “Resubmitted with revisions”' : 'Write a longer note: plans, to-dos, reviewer comments, methods, links…'}
          rows={kind === 'note' ? 5 : 2}
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add(e) }} />
        <div className="row between">
          <span className="muted small">⌘↵ to add</span>
          <button className="primary" disabled={!text.trim()}>Add {kind}</button>
        </div>
      </form>

      <ol className="tl">
        {entries.map(u => (
          <li key={u.id} className={`tl-item ${u.kind}`}>
            <span className="tl-dot" />
            <div className="tl-meta">
              <time title={fmt(u.created_at)}>{ago(u.created_at)} · {fmt(u.created_at)}</time>
              <button className="link small danger" onClick={async () => {
                notify.undoable(u.kind === 'note' ? 'Note deleted' : 'Update deleted', () => store.deleteUpdate(u.id), [u.id])
              }}>Delete</button>
            </div>
            {u.kind === 'note' ? (
              <div className="note-box">
                <span className="tag">Note</span>
                <textarea className="note-text" defaultValue={u.body}
                  ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }}
                  onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px` }}
                  onBlur={e => saveEntry(u, e.target.value)} />
              </div>
            ) : (
              <div className="tl-body" contentEditable suppressContentEditableWarning spellCheck
                onBlur={e => saveEntry(u, e.currentTarget.innerText.trim())}>{u.body}</div>
            )}
          </li>
        ))}
        {!entries.length && <li className="muted tl-empty">Nothing logged yet. Add the first update or note above.</li>}
      </ol>

      <button className="link small danger" onClick={() => {
        notify.undoable(`Deleted "${project.name}"`, () => store.deleteProject(project.id), [project.id])
        nav(project.type === 'manuscript' ? '/manuscripts' : '/projects')
      }}>Delete project</button>
    </div>
  )
}
