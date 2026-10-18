import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { friendlyError, UserError } from '../lib/errors'
import { ago, fmtWhen, nextOccurrence } from '../lib/util'
import type { ProjectTask, Area, Project, ProjectEvent, ProjectImport, ProjectStatus, ProjectType, ProjectUpdate } from '../types'

const TYPES: { id: ProjectType; label: string }[] = [
  { id: 'manuscript', label: 'Manuscript' },
  { id: 'data', label: 'Data' },
  { id: 'field', label: 'Field work' },
  { id: 'code', label: 'Code' },
  { id: 'other', label: 'Other' },
]
const STATUSES: ProjectStatus[] = ['active', 'paused', 'done']

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [events, setEvents] = useState<ProjectEvent[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [area, setAreaState] = useState<Area>(() => {
    try { return localStorage.getItem('tm-area') === 'home' ? 'home' : 'work' } catch { return 'work' }
  })
  const setArea = (a: Area) => { setAreaState(a); try { localStorage.setItem('tm-area', a) } catch { /* ignore */ } }
  const [filter, setFilter] = useState<ProjectType | 'all'>('all')
  const [doneOpen, setDoneOpenState] = useState(() => { try { return localStorage.getItem('tm-done-open') === '1' } catch { return false } })
  const setDoneOpen = (v: boolean) => { setDoneOpenState(v); try { localStorage.setItem('tm-done-open', v ? '1' : '0') } catch { /* ignore */ } }
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const importInput = useRef<HTMLInputElement>(null)

  async function importHistory(file: File) {
    setError(''); setNote('')
    try {
      const data = JSON.parse(await file.text()) as { projects?: ProjectImport[] }
      if (!Array.isArray(data.projects)) throw new UserError('That file is not a project history export.')
      const n = data.projects.reduce((a, p) => a + p.entries.length, 0)
      if (!confirm(`Import ${data.projects.length} projects with ${n} dated entries? Anything already in the app is skipped.`)) return
      const r = await store.importProjects(data.projects)
      setNote(`Added ${r.projects} projects and ${r.entries} timeline entries.`)
      refresh()
    } catch (e) { setError(friendlyError(e)) }
  }

  const refresh = useCallback(async () => {
    try {
      const [p, u, ev, tk] = await Promise.all([store.projects(), store.updates(), store.events().catch(() => [] as ProjectEvent[]), store.tasks().catch(() => [] as ProjectTask[])])
      setProjects(p); setUpdates(u); setEvents(ev); setTasks(tk)
    } catch (e) { setError(friendlyError(e)) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { window.addEventListener('tm-data', refresh); return () => window.removeEventListener('tm-data', refresh) }, [refresh])

  const byProject = useMemo(() => {
    const m = new Map<string, ProjectUpdate[]>()
    for (const u of updates) (m.get(u.project_id) ?? m.set(u.project_id, []).get(u.project_id)!).push(u)
    for (const list of m.values()) list.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return m
  }, [updates])

  const upcomingByProject = useMemo(() => {
    const now = new Date(); const m = new Map<string, { id: string; title: string; when: Date; weekly: boolean }[]>()
    for (const e of events) {
      const when = nextOccurrence(e, now); if (!when) continue
      ;(m.get(e.project_id) ?? m.set(e.project_id, []).get(e.project_id)!).push({ id: e.id, title: e.title, when, weekly: e.repeat === 'weekly' })
    }
    for (const l of m.values()) l.sort((a, b) => a.when.getTime() - b.when.getTime())
    return m
  }, [events])

  const notMs = projects.filter(p => p.type !== 'manuscript') // manuscripts live on their own page
  const inArea = notMs.filter(p => (p.area ?? 'work') === area)
  const areaCount = (a: Area) => notMs.filter(p => (p.area ?? 'work') === a && p.status !== 'done').length
  const lastActivity = (p: Project) => byProject.get(p.id)?.[0]?.created_at ?? p.created_at

  const rank = (p: Project) => p.sort_order ?? Number.MAX_SAFE_INTEGER
  const cmp = (a: Project, b: Project) => rank(a) - rank(b) || lastActivity(b).localeCompare(lastActivity(a))
  type Kind = 'pinned' | 'active' | 'done'
  const group = (kind: Kind) => inArea.filter(p =>
    kind === 'done' ? p.status === 'done' : p.status !== 'done' && !!p.pinned === (kind === 'pinned')).sort(cmp)
  const show = (p: Project) => filter === 'all' || p.type === filter
  const pinnedList = group('pinned').filter(show)
  const otherList = group('active').filter(show)
  const doneList = group('done').filter(show)
  const visible = [...pinnedList, ...otherList, ...doneList]
  const hasManualOrder = inArea.some(p => p.sort_order != null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function onDragEnd(kind: Kind, e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const full = group(kind)
    const from = full.findIndex(p => p.id === active.id), to = full.findIndex(p => p.id === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(full, from, to)
    setProjects(ps => ps.map(p => { const i = next.findIndex(n => n.id === p.id); return i >= 0 ? { ...p, sort_order: i } : p }))
    try { await store.reorderProjects(next.map(p => p.id)) } catch (er) { setError(friendlyError(er)); refresh() }
  }

  async function resetOrder() {
    const ids = inArea.map(p => p.id)
    setProjects(ps => ps.map(p => ids.includes(p.id) ? { ...p, sort_order: null } : p))
    try { await store.reorderProjects(ids, true) } catch (er) { setError(friendlyError(er)); refresh() }
  }

  async function togglePin(p: Project) {
    setProjects(ps => ps.map(x => x.id === p.id ? { ...x, pinned: !p.pinned } : x))
    try { await store.patchProject(p.id, { pinned: !p.pinned }) } catch (er) { setError(friendlyError(er)); refresh() }
  }

  const renderGrid = (list: Project[], kind: Kind) => (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => onDragEnd(kind, e)}>
      <SortableContext items={list.map(p => p.id)} strategy={rectSortingStrategy}>
        <div className="grid">
          {list.map(p => (
            <ProjectCard key={p.id} project={p} updates={byProject.get(p.id) ?? []} upcoming={upcomingByProject.get(p.id) ?? []} openTasks={tasks.filter(t => t.project_id === p.id && !t.done)}
              onChange={refresh} onPin={() => togglePin(p)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )

  return (
    <div className="page">
      <header className="page-head">
        <h1>Projects</h1>
        <div className="rocker" data-area={area} role="group" aria-label="Work or home projects">
          <i className="thumb" />
          <button className={area === 'work' ? 'on' : ''} onClick={() => setArea('work')} aria-pressed={area === 'work'}>Work <small>{areaCount('work')}</small></button>
          <button className={area === 'home' ? 'on' : ''} onClick={() => setArea('home')} aria-pressed={area === 'home'}>Home <small>{areaCount('home')}</small></button>
        </div>
        <div className="row">
          <button onClick={() => importInput.current?.click()}>Import history</button>
          <button className="primary" onClick={() => setAdding(true)}>New project</button>
        </div>
        <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importHistory(f); e.target.value = '' }} />
      </header>

      <div className="stats">
        <div><b>{inArea.filter(p => p.status === 'active').length}</b><span>active</span></div>
        <div><b>{updates.filter(u => inArea.some(p => p.id === u.project_id) && Date.now() - new Date(u.created_at).getTime() < 7 * 864e5).length}</b><span>updates this week</span></div>
        <div><b>{inArea.reduce((n, p) => n + (upcomingByProject.get(p.id) ?? []).filter(e => e.when.getTime() - Date.now() < 7 * 864e5).length, 0)}</b><span>scheduled this week</span></div>
        <div><b>{inArea.filter(p => p.status === 'paused').length}</b><span>paused</span></div>
      </div>

      <div className="chips">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
        {TYPES.filter(t => t.id !== 'manuscript').map(t => (
          <button key={t.id} className={filter === t.id ? 'on' : ''} onClick={() => setFilter(t.id)}>{t.label}</button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {note && <p className="ok">{note}</p>}
      {adding && <NewProject area={area} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); refresh() }} />}

      {pinnedList.length > 0 && (
        <section className="sect">
          <h2 className="sect-title"><span className="pin-ico">★</span> Pinned</h2>
          {renderGrid(pinnedList, 'pinned')}
        </section>
      )}
      {otherList.length > 0 && (
        <section className="sect">
          {pinnedList.length > 0 && <h2 className="sect-title">Everything else</h2>}
          {renderGrid(otherList, 'active')}
        </section>
      )}
      {doneList.length > 0 && (
        <section className="sect">
          <button className="sect-toggle" onClick={() => setDoneOpen(!doneOpen)} aria-expanded={doneOpen}>
            <span className="chev">{doneOpen ? '▾' : '▸'}</span> Completed <span className="count-pill">{doneList.length}</span>
          </button>
          {doneOpen && renderGrid(doneList, 'done')}
        </section>
      )}
      {hasManualOrder && visible.length > 1 && (
        <button className="link small" onClick={resetOrder}>Reset to recent-activity order</button>
      )}
      {!visible.length && !adding && (
        <div className="empty-box">
          <h2>{inArea.length ? 'Nothing matches this filter' : `No ${area} projects yet`}</h2>
          <p className="muted">{inArea.length ? 'Try another type.' : `Create a project, or move one here from the other side using the project page.`}</p>
          {!inArea.length && <button className="primary" onClick={() => setAdding(true)}>New project</button>}
        </div>
      )}
    </div>
  )
}

function NewProject({ area, onClose, onCreated }: { area: Area; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ProjectType>('data')
  const [description, setDescription] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await store.addProject({ name: name.trim(), type, description: description.trim(), area })
    onCreated()
  }
  return (
    <form className="card form" onSubmit={submit}>
      <input autoFocus placeholder="Project name" value={name} onChange={e => setName(e.target.value)} />
      <select value={type} onChange={e => setType(e.target.value as ProjectType)}>
        {TYPES.filter(t => t.id !== 'manuscript').map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <input placeholder="Short description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
      <div className="row">
        <button className="primary">Create</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

const overdueCount = (ts: ProjectTask[]) => ts.filter(t => t.due_on && t.due_on < new Date().toISOString().slice(0, 10)).length

function ProjectCard({ project, updates, upcoming, onChange, onPin, openTasks }: {
  openTasks: ProjectTask[]
  project: Project; updates: ProjectUpdate[]; upcoming: { id: string; title: string; when: Date; weekly: boolean }[]; onChange: () => void; onPin: () => void }) {
  const nav = useNavigate()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const dragStyle = { transform: CSS.Transform.toString(transform), transition }
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const shown = open ? updates : updates.slice(0, 3)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await store.addUpdate(project.id, text.trim()); setText(''); onChange()
  }
  async function setStatus(status: ProjectStatus) { await store.patchProject(project.id, { status }); onChange() }
  async function remove() {
    notify.undoable(`Deleted "${project.name}"`, () => store.deleteProject(project.id), [project.id])
  }

  return (
    <article ref={setNodeRef} style={dragStyle} className={`card project clickable t-${project.type} ${isDragging ? 'dragging-card' : ''}`}
      onClick={e => { if (!(e.target as HTMLElement).closest('select, input, button, a, textarea, form')) nav(`/project/${project.id}`) }}>
      <div className="project-head">
        <span className="tag"><i className="dotc" />{TYPES.find(t => t.id === project.type)?.label}</span>
        <span className="card-tools">
          <button className={`star ${project.pinned ? 'on' : ''}`} onClick={onPin} aria-pressed={!!project.pinned} title={project.pinned ? 'Unpin' : 'Pin to top'} aria-label={project.pinned ? 'Unpin project' : 'Pin project to top'}>{project.pinned ? '★' : '☆'}</button>
          <button className="grip" ref={setActivatorNodeRef} {...attributes} {...listeners} title="Drag to reorder" aria-label="Drag to reorder">⠿</button>
        </span>
        <select className="status" value={project.status} onChange={e => setStatus(e.target.value as ProjectStatus)} aria-label="Status">
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <h2><Link to={`/project/${project.id}`} className="plink">{project.name}</Link></h2>
      {project.description && <p className="muted">{project.description}</p>}

      {upcoming.length > 0 && (
        <ul className="sched">
          {upcoming.slice(0, 2).map(e => (
            <li key={e.id}><b>{fmtWhen(e.when)}</b><span>{e.title}{e.weekly && <i className="rep" title="Repeats weekly"> ↻</i>}</span></li>
          ))}
          {upcoming.length > 2 && <li className="muted small">+{upcoming.length - 2} more</li>}
        </ul>
      )}

      {openTasks.length > 0 && (
        <div className="task-chip">
          <span>☑ {openTasks.length} open task{openTasks.length === 1 ? '' : 's'}</span>
          {overdueCount(openTasks) > 0 && <b>{overdueCount(openTasks)} overdue</b>}
        </div>
      )}

      <ul className="updates">
        {shown.map(u => (
          <li key={u.id}>
            <span>{u.kind === 'note' && <em className="notetag">Note · </em>}{u.body.length > 140 ? u.body.slice(0, 140) + '…' : u.body}</span>
            <time>{ago(u.created_at)}</time>
          </li>
        ))}
        {!updates.length && <li className="muted">No updates yet</li>}
      </ul>
      {updates.length > 3 && (
        <button className="link small" onClick={() => setOpen(!open)}>{open ? 'Show less' : `Show all ${updates.length}`}</button>
      )}

      <Link to={`/project/${project.id}`} className="link small open">Open notes and full history →</Link>
      <form className="row" onSubmit={add}>
        <input placeholder="Add an update…" value={text} onChange={e => setText(e.target.value)} />
        <button disabled={!text.trim()}>Add</button>
      </form>
      <button className="link small danger del" onClick={remove}>Delete project</button>
    </article>
  )
}
