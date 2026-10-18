import { useCallback, useEffect, useMemo, useState } from 'react'
import { store } from '../lib/store'
import { ago } from '../lib/util'
import type { Project, ProjectStatus, ProjectType, ProjectUpdate } from '../types'

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
  const [filter, setFilter] = useState<ProjectType | 'all'>('all')
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [p, u] = await Promise.all([store.projects(), store.updates()])
      setProjects(p); setUpdates(u)
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  const byProject = useMemo(() => {
    const m = new Map<string, ProjectUpdate[]>()
    for (const u of updates) (m.get(u.project_id) ?? m.set(u.project_id, []).get(u.project_id)!).push(u)
    for (const list of m.values()) list.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return m
  }, [updates])

  const lastActivity = (p: Project) => byProject.get(p.id)?.[0]?.created_at ?? p.created_at

  const visible = projects
    .filter(p => (filter === 'all' || p.type === filter) && (showDone || p.status !== 'done'))
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))

  return (
    <div className="page">
      <header className="page-head">
        <h1>Projects</h1>
        <button className="primary" onClick={() => setAdding(true)}>New project</button>
      </header>

      <div className="stats">
        <div><b>{projects.filter(p => p.status === 'active').length}</b><span>active</span></div>
        <div><b>{updates.filter(u => Date.now() - new Date(u.created_at).getTime() < 7 * 864e5).length}</b><span>updates this week</span></div>
        <div><b>{projects.filter(p => p.status === 'paused').length}</b><span>paused</span></div>
      </div>

      <div className="chips">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
        {TYPES.map(t => (
          <button key={t.id} className={filter === t.id ? 'on' : ''} onClick={() => setFilter(t.id)}>{t.label}</button>
        ))}
        <label className="check"><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> Show done</label>
      </div>

      {error && <p className="error">{error}</p>}
      {adding && <NewProject onClose={() => setAdding(false)} onCreated={() => { setAdding(false); refresh() }} />}

      <div className="grid">
        {visible.map(p => (
          <ProjectCard key={p.id} project={p} updates={byProject.get(p.id) ?? []} onChange={refresh} />
        ))}
      </div>
      {!visible.length && !adding && (
        <div className="empty-box">
          <h2>{projects.length ? 'Nothing matches this filter' : 'No projects yet'}</h2>
          <p className="muted">{projects.length ? 'Try another type or show finished projects.' : 'Add a manuscript, dataset, field season or code project to track its updates here.'}</p>
          {!projects.length && <button className="primary" onClick={() => setAdding(true)}>New project</button>}
        </div>
      )}
    </div>
  )
}

function NewProject({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ProjectType>('manuscript')
  const [description, setDescription] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await store.addProject({ name: name.trim(), type, description: description.trim() })
    onCreated()
  }
  return (
    <form className="card form" onSubmit={submit}>
      <input autoFocus placeholder="Project name" value={name} onChange={e => setName(e.target.value)} />
      <select value={type} onChange={e => setType(e.target.value as ProjectType)}>
        {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <input placeholder="Short description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
      <div className="row">
        <button className="primary">Create</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  )
}

function ProjectCard({ project, updates, onChange }: { project: Project; updates: ProjectUpdate[]; onChange: () => void }) {
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
    if (confirm(`Delete "${project.name}" and all its updates?`)) { await store.deleteProject(project.id); onChange() }
  }

  return (
    <article className={`card project t-${project.type}`}>
      <div className="project-head">
        <span className="tag"><i className="dotc" />{TYPES.find(t => t.id === project.type)?.label}</span>
        <select className="status" value={project.status} onChange={e => setStatus(e.target.value as ProjectStatus)} aria-label="Status">
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <h2>{project.name}</h2>
      {project.description && <p className="muted">{project.description}</p>}

      <ul className="updates">
        {shown.map(u => (
          <li key={u.id}>
            <span>{u.body}</span>
            <time>{ago(u.created_at)}</time>
          </li>
        ))}
        {!updates.length && <li className="muted">No updates yet</li>}
      </ul>
      {updates.length > 3 && (
        <button className="link small" onClick={() => setOpen(!open)}>{open ? 'Show less' : `Show all ${updates.length}`}</button>
      )}

      <form className="row" onSubmit={add}>
        <input placeholder="Add an update…" value={text} onChange={e => setText(e.target.value)} />
        <button disabled={!text.trim()}>Add</button>
      </form>
      <button className="link small danger del" onClick={remove}>Delete project</button>
    </article>
  )
}
