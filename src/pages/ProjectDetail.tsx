import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { store } from '../lib/store'
import { ago } from '../lib/util'
import type { Project, ProjectStatus, ProjectType, ProjectUpdate } from '../types'

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
  const [kind, setKind] = useState<'update' | 'note'>('update')
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [ps, us] = await Promise.all([store.projects(), store.updates()])
      const p = ps.find(x => x.id === id) ?? null
      setProject(p)
      setEntries(us.filter(u => u.project_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)))
      if (!p) setError('Project not found.')
    } catch (e) { setError((e as Error).message) }
  }, [id])
  useEffect(() => { load() }, [load])

  async function patch(p: Partial<Project>) {
    if (!project) return
    setProject({ ...project, ...p })
    try { await store.patchProject(project.id, p) } catch (e) { setError((e as Error).message) }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !project) return
    try { await store.addUpdate(project.id, text.trim(), kind); setText(''); load() } catch (er) { setError((er as Error).message) }
  }

  async function saveEntry(u: ProjectUpdate, body: string) {
    if (body === u.body) return
    if (!body.trim()) { setError('An entry can’t be empty. Use Delete to remove it.'); load(); return }
    setEntries(es => es.map(x => x.id === u.id ? { ...x, body } : x))
    try { await store.patchUpdate(u.id, { body }) } catch (e) { setError((e as Error).message) }
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
                if (u.kind === 'note' && !confirm('Delete this note?')) return
                await store.deleteUpdate(u.id); load()
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

      <button className="link small danger" onClick={async () => {
        if (confirm(`Delete "${project.name}" and everything in its timeline?`)) { await store.deleteProject(project.id); nav('/') }
      }}>Delete project</button>
    </div>
  )
}
