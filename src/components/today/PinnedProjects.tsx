import { Link } from 'react-router-dom'
import Icon from '../Icon'
import { store } from '../../lib/store'
import { friendlyError } from '../../lib/errors'
import { ago } from '../../lib/util'
import type { TodayData } from '../../lib/useTodayData'
import type { Project } from '../../types'

/** The projects you pinned on the Projects page, so the next thing to pick up is one glance away. */
export default function PinnedProjects({ d }: { d: TodayData }) {
  const last = new Map<string, string>()
  for (const u of d.updates) { const c = last.get(u.project_id); if (!c || u.created_at > c) last.set(u.project_id, u.created_at) }
  const touched = (p: Project) => last.get(p.id) ?? p.created_at
  const rank = (p: Project) => p.sort_order ?? Number.MAX_SAFE_INTEGER
  const open = d.projects.filter(p => p.status !== 'done')
  const pinned = open.filter(p => p.pinned).sort((a, b) => rank(a) - rank(b) || touched(b).localeCompare(touched(a)))
  const others = open.filter(p => !p.pinned).sort((a, b) => a.name.localeCompare(b.name))
  const tasksOf = (p: Project) => d.openTasks.filter(t => t.project_id === p.id).length

  const setPinned = (p: Project, pinned: boolean) => store.patchProject(p.id, { pinned }).then(d.reload).catch(e => d.setError(friendlyError(e)))

  return (
    <section className={`card ${pinned.length ? '' : 'slim'}`}>
      <h2><Icon name="star" size={16} filled className="pin-ico" /> Pinned projects {pinned.length > 0 && <span className="count-pill">{pinned.length}</span>}</h2>
      {pinned.map(p => (
        <div className="trow" key={p.id}>
          <Link to={`/project/${p.id}`}><b>{p.name}</b></Link>
          <span className="muted small">{tasksOf(p) > 0 ? `${tasksOf(p)} open to-do${tasksOf(p) === 1 ? '' : 's'} · ` : ''}last touched {ago(touched(p))}</span>
          <span className="task-fill" />
          <button type="button" className="link small" onClick={() => setPinned(p, false)} aria-label={`Unpin ${p.name}`}>Unpin</button>
        </div>
      ))}
      {!pinned.length && <p className="muted">Pin the projects you want to keep coming back to. They stay here until you unpin them.</p>}
      {others.length > 0 && (
        <select value="" onChange={e => { const p = others.find(x => x.id === e.target.value); if (p) setPinned(p, true) }} aria-label="Pin a project">
          <option value="">Pin a project…</option>
          {others.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
    </section>
  )
}
