import { useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../lib/store'
import { friendlyError } from '../lib/errors'
import type { Project, ProjectLink } from '../types'

/** The projects linked to a manuscript, or the manuscripts linked to a project: the two kinds of work that belong together. */
export const linkedTo = (id: string, links: ProjectLink[]) =>
  links.filter(l => l.project_id === id || l.linked_id === id).map(l => (l.project_id === id ? l.linked_id : l.project_id))

export default function LinkedWork({ project, projects, links, onChange, onError }: {
  project: Project; projects: Project[]; links: ProjectLink[]; onChange: () => void; onError: (m: string) => void
}) {
  const [q, setQ] = useState('')
  const isMs = project.type === 'manuscript'
  const noun = isMs ? 'project' : 'manuscript'
  const ids = new Set(linkedTo(project.id, links))
  const byId = new Map(projects.map(p => [p.id, p]))
  const linked = [...ids].map(i => byId.get(i)).filter((p): p is Project => !!p)
  const needle = q.trim().toLowerCase()
  const matches = needle
    ? projects.filter(p => p.id !== project.id && (p.type === 'manuscript') !== isMs && !ids.has(p.id) && p.name.toLowerCase().includes(needle)).slice(0, 6)
    : []
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); onChange() } catch (e) { onError(friendlyError(e)) } }
  return (
    <section className="card reading linked-work">
      <h2>{isMs ? 'Linked projects' : 'Linked manuscripts'}</h2>
      <ul className="linked">
        {linked.map(p => (
          <li key={p.id}>
            <div><Link to={`/project/${p.id}`} className="paper-title">{p.name}</Link>
              <div className="muted small">{p.type === 'manuscript' ? (p.stage ? p.stage.replace(/^./, c => c.toUpperCase()) : 'Manuscript') : p.type}</div></div>
            <button className="link small danger" onClick={() => run(() => store.unlinkProject(project.id, p.id))}>Unlink</button>
          </li>
        ))}
        {!linked.length && <li className="muted">No {noun}s linked yet. Link the {noun} this belongs with and each will show the other.</li>}
      </ul>
      <input placeholder={`Search ${noun}s to link…`} value={q} onChange={e => setQ(e.target.value)} />
      {matches.length > 0 && (
        <ul className="matches">
          {matches.map(p => (
            <li key={p.id}><button onClick={() => { setQ(''); run(() => store.linkProject(project.id, p.id)) }}>
              <b>{p.name}</b><span className="muted small">{p.type}</span></button></li>
          ))}
        </ul>
      )}
      {needle && !matches.length && <p className="muted small">No unlinked {noun}s match.</p>}
    </section>
  )
}

/** A small line on a card naming what it is linked with. */
export function LinkedChips({ linked }: { linked: Project[] }) {
  if (!linked.length) return null
  return (
    <div className="linked-chips">
      {linked.slice(0, 3).map(l => <Link key={l.id} to={`/project/${l.id}`} className="linked-chip" title={`Linked ${l.type === 'manuscript' ? 'manuscript' : 'project'}`}>{l.name}</Link>)}
      {linked.length > 3 && <span className="muted small">+{linked.length - 3} more</span>}
    </div>
  )
}
