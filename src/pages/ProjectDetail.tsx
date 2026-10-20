import Icon from '../components/Icon'
import BackButton from '../components/BackButton'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { store, type ProjectPage } from '../lib/store'
import { notify } from '../lib/notify'
import { forgetOpen, rememberOpen } from '../lib/resume'
import { friendlyError } from '../lib/errors'
import { ago, commitText, fmtMinutes, fmtWhen, fromLocalInput, nextOccurrence, toLocalInput } from '../lib/util'
import { STAGES, deadlineInfo, stageLabel } from '../lib/manuscript'
import TaskList from '../components/TaskList'
import TagEditor from '../components/TagEditor'
import GithubLink from '../components/GithubLink'
import EntryBody from '../components/EntryBody'
import RichTextarea from '../components/RichText'
import LinkedText from '../components/LinkedText'
import { parsePieces, useLinks } from '../lib/links'
import LinkedWork, { linkedTo } from '../components/LinkedWork'
import type { Area, Deadline, ProjectLink, ProjectTask, TimeEntry, Paper, PaperLink, Project, ProjectEvent, ProjectStatus, ProjectType, ProjectUpdate, Stage } from '../types'

const TYPES: { id: ProjectType; label: string }[] = [
  { id: 'manuscript', label: 'Manuscript' }, { id: 'data', label: 'Data' },
  { id: 'field', label: 'Field work' }, { id: 'code', label: 'Code' }, { id: 'other', label: 'Other' },
]

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
  ' · ' + new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

const meetingTemplate = () => `## Meeting — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}\n**Attendees:** \n\n**Agenda**\n- [ ] \n\n**Notes**\n- \n\n**Action items**\n- [ ] `

export default function ProjectDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [entries, setEntries] = useState<ProjectUpdate[]>([])
  const [events, setEvents] = useState<ProjectEvent[]>([])
  const [papers, setPapers] = useState<Paper[]>([])
  const [links, setLinks] = useState<PaperLink[]>([])
  const [paperQ, setPaperQ] = useState('')
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [projLinks, setProjLinks] = useState<ProjectLink[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [time, setTime] = useState<TimeEntry[]>([])
  const [allUpdates, setAllUpdates] = useState<ProjectUpdate[]>([])
  const { resolve } = useLinks()
  const [dlTitle, setDlTitle] = useState('')
  const [dlDate, setDlDate] = useState('')
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const [evTitle, setEvTitle] = useState('')
  const [evDate, setEvDate] = useState(todayStr)
  const [evTime, setEvTime] = useState('10:00')
  const [evWeekly, setEvWeekly] = useState(false)
  type Mode = 'update' | 'note' | 'meeting'
  const [mode, setMode] = useState<Mode>('update')
  const loadDrafts = (pid?: string): Record<Mode, string> => {
    try { return { update: '', note: '', meeting: '', ...JSON.parse(localStorage.getItem(`draft:${pid}`) ?? '{}') } } catch { return { update: '', note: '', meeting: '' } }
  }
  const [drafts, setDraftsRaw] = useState(() => loadDrafts(id))
  const [draftsFor, setDraftsFor] = useState(id)
  if (draftsFor !== id) { setDraftsFor(id); setDraftsRaw(loadDrafts(id)); setMode('update') }
  const setDrafts = (fn: (d: Record<Mode, string>) => Record<Mode, string>) => {
    const next = fn(drafts); setDraftsRaw(next)
    try {
      const keep = Object.fromEntries(Object.entries(next).filter(([k, v]) => v.trim() && !(k === 'meeting' && v === meetingTemplate())))
      if (Object.keys(keep).length) localStorage.setItem(`draft:${id}`, JSON.stringify(keep)); else localStorage.removeItem(`draft:${id}`)
    } catch { /* storage unavailable */ }
  }
  const [editingId, setEditingId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  useEffect(() => {
    if (!menuId) return
    const close = (e: Event) => { if (e instanceof KeyboardEvent && e.key !== 'Escape') return; setMenuId(null) }
    document.addEventListener('click', close); document.addEventListener('keydown', close)
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', close) }
  }, [menuId])
  const text = drafts[mode], kind = mode === 'update' ? 'update' : 'note', isMeeting = mode === 'meeting'
  const setText = (v: string) => setDrafts(d => ({ ...d, [mode]: v }))
  const pickMode = (m: Mode) => { setMode(m); if (m === 'meeting') setDrafts(d => d.meeting.trim() ? d : { ...d, meeting: meetingTemplate() }) }
  const [error, setError] = useState('')
  const [when, setWhen] = useState('')
  const [shown, setShown] = useState(5)
  const [total, setTotal] = useState(0)
  const [pushes, setPushes] = useState<{ n: number; last?: string }>({ n: 0 })
  const [timeId, setTimeId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [ps, us, evs, pp, ls, dls, tks, tes, pls] = await Promise.all([store.projects(), id ? store.projectUpdates(id, shown) : Promise.resolve({ rows: [], total: 0, commits: 0 } as ProjectPage), store.events().catch(() => [] as ProjectEvent[]), store.papers(), store.projectPapers().catch(() => [] as PaperLink[]), store.deadlines().catch(() => [] as Deadline[]), store.tasks().catch(() => [] as ProjectTask[]), store.timeEntries().catch(() => [] as TimeEntry[]), store.projectLinks().catch(() => [] as ProjectLink[])])
      setAllProjects(ps); setProjLinks(pls)
      setEvents(evs.filter(e => e.project_id === id)); setPapers(pp); setLinks(ls.filter(l => l.project_id === id)); setDeadlines(dls.filter(d => d.project_id === id)); setTasks(tks.filter(t => t.project_id === id)); setTime(tes.filter(t => t.project_id === id))
      const p = ps.find(x => x.id === id) ?? null
      setProject(p); setTotal(us.total); setPushes({ n: us.commits, last: us.lastPush })
      setEntries(us.rows)
      setAllUpdates(p ? await store.mentionsOf(p.name, p.id).catch(() => []) : [])
      if (!p) setError('Project not found.')
    } catch (e) { setError(friendlyError(e)) }
  }, [id, shown])
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
    try { await store.addDeadline(project.id, dlTitle.trim(), dlDate); setDlTitle(''); load(); notify.added() } catch (er) { setError(friendlyError(er)) }
  }

  async function setStage(next: Stage) {
    if (!project) return
    const prev = project.stage ?? 'drafting'; if (prev === next) return
    await patch({ stage: next })
    try { await store.addUpdate(project.id, `Stage: ${stageLabel(prev)} → ${stageLabel(next)}`); load() } catch (e) { setError(friendlyError(e)) }
  }

  // other projects' notes that link here with [[this name]]
  const [mentionNames, setMentionNames] = useState<Map<string, string>>(new Map())
  useEffect(() => { store.projects().then(ps => setMentionNames(new Map(ps.map(p => [p.id, p.name])))).catch(() => {}) }, [allUpdates])
  const mentions = project ? allUpdates.filter(u => u.project_id !== project.id && parsePieces(u.body).some(pc => pc.t === 'link' && (() => { const t = resolve(pc.s); return t?.kind === 'project' && t.id === project.id })())) : []

  const linkedIds = new Set(links.map(l => l.paper_id))
  const linked = papers.filter(p => linkedIds.has(p.id))
  const needle = paperQ.trim().toLowerCase()
  const matches = needle ? papers.filter(p => !linkedIds.has(p.id) && `${p.title} ${p.authors} ${p.year}`.toLowerCase().includes(needle)).slice(0, 8) : []

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !project) return
    try { await store.addUpdate(project.id, text.trim(), kind, fromLocalInput(when)); setText(''); setWhen(''); load(); notify.added() } catch (er) { setError(friendlyError(er)) }
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!evTitle.trim() || !evDate || !evTime || !project) return
    const starts = new Date(`${evDate}T${evTime}`)
    if (isNaN(starts.getTime())) return
    try { await store.addEvent(project.id, evTitle.trim(), starts.toISOString(), evWeekly ? 'weekly' : 'none'); setEvTitle(''); load(); notify.added() } catch (er) { setError(friendlyError(er)) }
  }

  async function saveTime(u: ProjectUpdate, v: string) {
    setTimeId(null)
    const at = fromLocalInput(v); if (!at || at === u.created_at) return
    setEntries(es => es.map(x => x.id === u.id ? { ...x, created_at: at } : x).sort((a, b) => b.created_at.localeCompare(a.created_at)))
    try { await store.patchUpdate(u.id, { created_at: at }) } catch (e) { setError(friendlyError(e)); load() }
  }

  async function saveEntry(u: ProjectUpdate, body: string) {
    if (body === u.body) return
    if (!body.trim()) { setError('An entry can’t be empty. Use Delete to remove it.'); load(); return }
    setEntries(es => es.map(x => x.id === u.id ? { ...x, body } : x))
    try { await store.patchUpdate(u.id, { body }) } catch (e) { setError(friendlyError(e)) }
  }

  const kindOf = project?.type, pid = project?.id
  useEffect(() => { if (pid && kindOf) rememberOpen(kindOf === 'manuscript' ? 'manuscripts' : 'projects', pid) }, [pid, kindOf])

  if (!project) return <div className="page">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}<Link to="/projects" className="link">← Projects</Link></div>

  return (
    <div className="page detail">
      <div className="title-row"><BackButton /><Link to={project.type === 'manuscript' ? '/manuscripts' : '/projects'} className="link back-link" onClick={() => forgetOpen(project.type === 'manuscript' ? 'manuscripts' : 'projects')}>← {project.type === 'manuscript' ? 'Manuscripts' : 'Projects'}</Link></div>
      <header className="detail-head">
        <button className={`star big ${project.pinned ? 'on' : ''}`} onClick={() => patch({ pinned: !project.pinned })} aria-pressed={!!project.pinned} title={project.pinned ? 'Unpin' : 'Pin to top'}><Icon name="star" size={20} filled={!!project.pinned} /></button>
        <input className="title-input" defaultValue={project.name} aria-label="Project name"
          onBlur={e => e.target.value.trim() && e.target.value !== project.name && patch({ name: e.target.value.trim() })} />
        {(() => {
          const names = linkedTo(project.id, projLinks).map(i => allProjects.find(x => x.id === i)).filter((x): x is Project => !!x)
          return names.length > 0 && (
            <div className="head-links" aria-label={`Linked ${project.type === 'manuscript' ? 'projects' : 'manuscripts'}`}>
              {names.slice(0, 2).map(l => <Link key={l.id} to={`/project/${l.id}`} className="head-link" title={`Linked ${l.type === 'manuscript' ? 'manuscript' : 'project'}: ${l.name}`}><Icon name="link" size={14} /><span>{l.name}</span></Link>)}
              {names.length > 2 && <a href="#linked-work" className="head-link more" title="See all links" onClick={e => { e.preventDefault(); document.querySelector('.linked-work')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>+{names.length - 2}</a>}
            </div>
          )
        })()}
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
      <TagEditor tags={project.tags ?? []} onChange={t => patch({ tags: t })} />
      <input className="desc-input" placeholder="Short description" defaultValue={project.description}
        onBlur={e => e.target.value !== project.description && patch({ description: e.target.value })} />
      {error && <p className="error">{error}</p>}

      <div className="detail-cols">
        <div className="col-main">
      {mentions.length > 0 && (
        <section className="card">
          <h2>Mentioned in</h2>
          <ul className="backlinks">
            {mentions.map(u => (
              <li key={u.id}>
                <Link to={`/project/${u.project_id}`} className="small"><b>{mentionNames.get(u.project_id) ?? 'Another project'}</b></Link>
                <span><LinkedText text={u.body.length > 160 ? u.body.slice(0, 160) + '…' : u.body} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="card composer" onSubmit={add}>
        <div className="seg" role="tablist">
          <button type="button" className={kind === 'update' ? 'on' : ''} onClick={() => pickMode('update')}>Update</button>
          <button type="button" className={mode === 'note' ? 'on' : ''} onClick={() => pickMode('note')}>Note</button>
          <button type="button" className={isMeeting ? 'on' : ''} onClick={() => pickMode('meeting')}>Meeting</button>
        </div>
        <RichTextarea
          placeholder={kind === 'update' ? 'What happened? e.g. “Resubmitted with revisions”' : 'Write a longer note. Type [[ to link a project or paper, # to tag.'}
          rows={kind === 'note' ? 5 : 2}
          value={text} onChange={setText}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add(e) }} />
        <div className="row between">
          <span className="row"><span className="muted small">⌘↵ to add</span>
            <label className="small muted">When <input type="datetime-local" value={when} max={toLocalInput(new Date().toISOString())} onChange={e => setWhen(e.target.value)} aria-label="When it happened (blank = now)" /></label>
            {when && <button type="button" className="link small" onClick={() => setWhen('')}>Now</button>}
          </span>
          <button className="primary" disabled={!text.trim()}>Add {kind}</button>
        </div>
      </form>

      <ol className="tl">
        {entries.map(u => (
          <li key={u.id} className={`tl-item ${u.kind}`}>
            <span className="tl-dot" />
            <div className="tl-meta">
              {timeId === u.id
                ? <input type="datetime-local" autoFocus defaultValue={toLocalInput(u.created_at)} aria-label="Entry time"
                    onBlur={e => saveTime(u, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTime(u, e.currentTarget.value); if (e.key === 'Escape') setTimeId(null) }} />
                : <time title={fmt(u.created_at)}>{ago(u.created_at)} · {fmt(u.created_at)}</time>}
              <div className="tl-menu" onClick={e => e.stopPropagation()}>
                <button type="button" className="tl-pen" aria-label="Entry actions" aria-haspopup="menu" aria-expanded={menuId === u.id} title="Edit or delete"
                  onClick={() => setMenuId(menuId === u.id ? null : u.id)}><Icon name="pen" size={14} /></button>
                {menuId === u.id && (
                  <div className="tl-pop" role="menu">
                    {u.kind !== 'commit' && <button type="button" role="menuitem" onClick={() => { setEditingId(editingId === u.id ? null : u.id); setMenuId(null) }}>{editingId === u.id ? 'Cancel edit' : 'Edit'}</button>}
                    {u.kind !== 'commit' && <button type="button" role="menuitem" onClick={() => { setTimeId(u.id); setMenuId(null) }}>Change time</button>}
                    <button type="button" role="menuitem" className="danger" onClick={() => {
                      setMenuId(null)
                      notify.undoable(u.kind === 'note' ? 'Note deleted' : 'Update deleted', () => store.deleteUpdate(u.id), [u.id])
                    }}>Delete</button>
                  </div>
                )}
              </div>
            </div>
            {u.kind === 'commit' ? (
              <div className="commit-box">
                <span className="tag"><Icon name="git" size={13} /> GitHub</span>
                <pre className="commit-body">{commitText(u.body)}</pre>
                {u.source_url && <a className="link small" href={u.source_url} target="_blank" rel="noreferrer">View on GitHub →</a>}
              </div>
            ) : u.kind === 'note' ? (
              <div className="note-box">
                <span className="tag">{u.body.startsWith('## Meeting') ? 'Meeting' : 'Note'}</span>
                <EntryBody note body={u.body} editing={editingId === u.id} setEditing={e => setEditingId(e ? u.id : null)} onSave={v => saveEntry(u, v)} />
              </div>
            ) : (
              <EntryBody body={u.body} editing={editingId === u.id} setEditing={e => setEditingId(e ? u.id : null)} onSave={v => saveEntry(u, v)} />
            )}
          </li>
        ))}
        {total > entries.length && (
          <li className="tl-empty row">
            <button type="button" className="link small" onClick={() => setShown(n => n + 5)}>Show 5 more</button>
            <button type="button" className="link small" onClick={() => setShown(Math.max(total, 5))}>Show all ({total - entries.length} more)</button>
          </li>
        )}
        {!entries.length && !total && <li className="tl-empty"><b>Nothing logged yet.</b> <span className="muted">This timeline fills in as you add updates and notes, so you can look back at what happened and when.</span> <button className="link" onClick={() => document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus()}>Log the first update</button></li>}
      </ol>

      <button className="link small danger" onClick={() => {
        notify.undoable(`Deleted "${project.name}"`, () => store.deleteProject(project.id), [project.id])
        forgetOpen(project.type === 'manuscript' ? 'manuscripts' : 'projects')
        nav(project.type === 'manuscript' ? '/manuscripts' : '/projects')
      }}>Delete project</button>
        </div>
        <aside className="col-side">
          <GithubLink repo={project.github_repo ?? null} lastPush={pushes.last} pushes={pushes.n} onChange={r => patch({ github_repo: r })} />
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

      <section className="card time-card">
        <h2>Focus time</h2>
        {time.length ? (() => {
          const now = Date.now(); const sum = (days: number) => time.filter(t => now - new Date(t.started_at).getTime() < days * 864e5).reduce((a, t) => a + t.minutes, 0)
          return (
            <>
              <div className="time-totals">
                <div><b>{fmtMinutes(sum(7))}</b><span>last 7 days</span></div>
                <div><b>{fmtMinutes(sum(30))}</b><span>last 30 days</span></div>
                <div><b>{fmtMinutes(time.reduce((a, t) => a + t.minutes, 0))}</b><span>all time</span></div>
              </div>
              <ul className="time-list">
                {[...time].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 5).map(t => (
                  <li key={t.id}><span>{new Date(t.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(t.started_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span><b>{fmtMinutes(t.minutes)}</b></li>
                ))}
              </ul>
            </>
          )
        })() : <p className="muted">No focus time logged here yet. Pick this project in the sidebar timer and your sessions will be added.</p>}
      </section>

      {project && <LinkedWork project={project} projects={allProjects} links={projLinks} onChange={load} onError={setError} />}

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
          {!linked.length && <li className="muted">No papers linked yet. Link the papers you are reading for this work and they will show up here and in the reader.</li>}
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

        </aside>
      </div>
    </div>
  )
}
