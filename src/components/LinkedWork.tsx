import { useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../lib/store'
import { friendlyError } from '../lib/errors'
import { ago } from '../lib/util'
import type { Project, ProjectLink, ProjectTask } from '../types'

/** How one piece of linked work is going, for the line under its name. */
export interface Progress { done: number; total: number; last?: string; commits: number; nextDue?: string }

/** The projects linked to a manuscript, or the manuscripts linked to a project: the two kinds of work that belong together. */
export const linkedTo = (id: string, links: ProjectLink[]) =>
  links.filter(l => l.project_id === id || l.linked_id === id).map(l => (l.project_id === id ? l.linked_id : l.project_id))

export default function LinkedWork({ project, projects, links, progress, onChange, onError }: {
  project: Project; projects: Project[]; links: ProjectLink[]; progress?: Map<string, Progress>; onChange: () => void; onError: (m: string) => void
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
              <div className="muted small">{p.type === 'manuscript' ? (p.stage ? p.stage.replace(/^./, c => c.toUpperCase()) : 'Manuscript') : p.type}</div>
              <ProgressLine pr={progress?.get(p.id)} /></div>
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

function ProgressLine({ pr }: { pr?: Progress }) {
  if (!pr) return null
  const bits = [
    pr.total ? `${pr.done}/${pr.total} to-dos done` : 'No to-dos yet',
    pr.commits ? `${pr.commits} recent commit${pr.commits === 1 ? '' : 's'}` : '',
    pr.last ? `active ${ago(pr.last)}` : 'no activity yet',
    pr.nextDue ? `next deadline ${new Date(pr.nextDue + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '',
  ].filter(Boolean)
  return (
    <div className="linked-progress small">
      {pr.total > 0 && <span className="linked-bar" aria-hidden><i style={{ width: `${Math.round(pr.done / pr.total * 100)}%` }} /></span>}
      <span className="muted">{bits.join(' · ')}</span>
    </div>
  )
}

/** A small line on a card naming what it is linked with, how far along each piece is, and the total across the card and its links. */
export function LinkedChips({ linked, tasks, self }: { linked: Project[]; tasks?: ProjectTask[]; self?: string }) {
  if (!linked.length) return null
  const count = (id: string) => { const ts = (tasks ?? []).filter(t => t.project_id === id); return { done: ts.filter(t => t.done).length, total: ts.length } }
  const all = [...linked.map(l => l.id), ...(self ? [self] : [])].map(count)
  const done = all.reduce((a, c) => a + c.done, 0), total = all.reduce((a, c) => a + c.total, 0)
  return (
    <>
      <div className="linked-chips">
        {linked.slice(0, 3).map(l => {
          const c = count(l.id)
          return <Link key={l.id} to={`/project/${l.id}`} className="linked-chip" title={`Linked ${l.type === 'manuscript' ? 'manuscript' : 'project'}`}>{l.name}{tasks && c.total > 0 && <span className="muted"> {c.done}/{c.total}</span>}</Link>
        })}
        {linked.length > 3 && <span className="muted small">+{linked.length - 3} more</span>}
      </div>
      {tasks && total > 0 && (
        <div className="linked-progress small" title="To-dos done across this and its linked work">
          <span className="linked-bar" aria-hidden><i style={{ width: `${Math.round(done / total * 100)}%` }} /></span>
          <span className="muted">{done}/{total} to-dos done together</span>
        </div>
      )}
    </>
  )
}
