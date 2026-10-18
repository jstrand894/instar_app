import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { store } from '../lib/store'
import { ago } from '../lib/util'
import type { Project, ProjectStatus, ProjectType, ProjectUpdate } from '../types'

const TYPES: { id: ProjectType; label: string }[] = [
  { id: 'manuscript', label: 'Manuscript' }, { id: 'data', label: 'Data' },
  { id: 'field', label: 'Field work' }, { id: 'code', label: 'Code' }, { id: 'other', label: 'Other' },
]

export default function ProjectDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [text, setText] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const load = useCallback(async () => {
    try {
      const [ps, us] = await Promise.all([store.projects(), store.updates()])
      const p = ps.find(x => x.id === id) ?? null
      setProject(p); if (p) setNotes(n => n || p.notes || '')
      setUpdates(us.filter(u => u.project_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)))
      if (!p) setError('Project not found.')
    } catch (e) { setError((e as Error).message) }
  }, [id])
  useEffect(() => { load() }, [load])

  async function patch(p: Partial<Project>) {
    if (!project) return
    setProject({ ...project, ...p })
    try { await store.patchProject(project.id, p) } catch (e) { setError((e as Error).message) }
  }

  function onNotes(v: string) {
    setNotes(v); setSaved('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try { await patch({ notes: v }); setSaved('saved') } catch { /* surfaced by patch */ }
    }, 800)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !project) return
    await store.addUpdate(project.id, text.trim()); setText(''); load()
  }

  if (!project) return <div className="page">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}<Link to="/" className="link">← Projects</Link></div>

  return (
    <div className="page detail">
      <Link to="/" className="link back-link">← Projects</Link>
      <header className="detail-head">
        <input className="title-input" defaultValue={project.name} aria-label="Project name"
          onBlur={e => e.target.value.trim() && e.target.value !== project.name && patch({ name: e.target.value.trim() })} />
        <div className="row wrap">
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

      <div className="detail-cols">
        <section className="card">
          <div className="row between">
            <h2>Notes</h2>
            <span className="muted small">{saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : ''}</span>
          </div>
          <textarea className="notes-area" placeholder="Anything about this project: plans, to-dos, reviewer comments, methods, links…"
            value={notes} onChange={e => onNotes(e.target.value)} />
        </section>

        <section className="card">
          <h2>Activity</h2>
          <form className="row" onSubmit={add}>
            <input placeholder="Log an update…" value={text} onChange={e => setText(e.target.value)} />
            <button className="primary" disabled={!text.trim()}>Add</button>
          </form>
          <ul className="timeline">
            {updates.map(u => (
              <li key={u.id}>
                <div>{u.body}</div>
                <div className="row between">
                  <time className="muted small" title={new Date(u.created_at).toLocaleString()}>{ago(u.created_at)} · {new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
                  <button className="link small danger" onClick={async () => { await store.deleteUpdate(u.id); load() }}>Delete</button>
                </div>
              </li>
            ))}
            {!updates.length && <li className="muted">No activity yet.</li>}
          </ul>
        </section>
      </div>

      <button className="link small danger" onClick={async () => {
        if (confirm(`Delete "${project.name}" and all its activity?`)) { await store.deleteProject(project.id); nav('/') }
      }}>Delete project</button>
    </div>
  )
}
