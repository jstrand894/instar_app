import { useEffect, useRef, useState } from 'react'
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
  const lastBody = new Map<string, string>()
  for (const u of [...d.updates].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (!lastBody.has(u.project_id) && u.kind !== 'commit') lastBody.set(u.project_id, u.body.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').slice(0, 110))
  }
  const touched = (p: Project) => last.get(p.id) ?? p.created_at
  const rank = (p: Project) => p.sort_order ?? Number.MAX_SAFE_INTEGER
  const open = d.projects.filter(p => p.status !== 'done')
  const pinned = open.filter(p => p.pinned).sort((a, b) => rank(a) - rank(b) || touched(b).localeCompare(touched(a)))
  const others = open.filter(p => !p.pinned).sort((a, b) => a.name.localeCompare(b.name))
  const todosOf = (p: Project) => d.openTasks.filter(t => t.project_id === p.id)

  const setPinned = (p: Project, pinned: boolean) => store.patchProject(p.id, { pinned }).then(d.reload).catch(e => d.setError(friendlyError(e)))

  const [adding, setAdding] = useState(false)
  const menu = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!adding) return
    const away = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setAdding(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAdding(false) }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [adding])
  const row = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ left: false, right: false })
  const measure = () => { const el = row.current; if (el) setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }) }
  useEffect(() => { measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure) }, [pinned.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const go = (dir: number) => row.current?.scrollBy({ left: dir * row.current.clientWidth, behavior: 'smooth' })

  return (
    <section className="pin-section">
      <div className="pin-head">
        <h2><Icon name="star" size={16} filled className="pin-ico" /> Pinned projects {pinned.length > 0 && <span className="count-pill">{pinned.length}</span>}</h2>
        {others.length > 0 && (
          <span className="when-menu" ref={menu}>
            <button type="button" className="pin-plus" onClick={() => setAdding(a => !a)} aria-haspopup="menu" aria-expanded={adding} aria-label="Pin a project" title="Pin a project">+</button>
            {adding && (
              <div className="when-pop pin-pop" role="menu" style={{ left: 0, right: 'auto' }}>
                {others.map(p => <button key={p.id} type="button" role="menuitem" onClick={() => { setAdding(false); setPinned(p, true) }}>{p.name}</button>)}
              </div>
            )}
          </span>
        )}
      </div>
      {pinned.length > 0 && (
        <div className="pin-wrap">
          <button type="button" className="pin-arrow left" onClick={() => go(-1)} disabled={!edge.left} aria-label="Scroll left">‹</button>
          <div className="pin-row" ref={row} onScroll={measure}>
            {pinned.map(p => (
              <article className={`pin-card t-${p.type}`} key={p.id}>
                <Link to={`/project/${p.id}`} className="pin-name">{p.name}</Link>
                <span className="pin-meta"><span className="pin-chip">{p.stage ? p.stage : p.type}</span></span>
                {todosOf(p).length > 0
                  ? (
                    <ul className="pin-todos">
                      {todosOf(p).slice(0, 4).map(t => (
                        <li key={t.id} className={d.leaving.has('t' + t.id) ? 'leaving' : ''}>
                          <input type="checkbox" className="tick" checked={d.leaving.has('t' + t.id)} onChange={() => d.checkOff(t.id)} aria-label={`Mark "${t.title}" done`} />
                          <span className="pin-todo-title">{t.title}</span>
                        </li>
                      ))}
                      {todosOf(p).length > 4 && <li className="muted small pin-more"><Link to={`/project/${p.id}`}>+{todosOf(p).length - 4} more</Link></li>}
                    </ul>
                  )
                  : lastBody.get(p.id) && <p className="pin-last small">{lastBody.get(p.id)}</p>}
                <span className="task-fill" />
                <div className="row between">
                  <span className="muted small">touched {ago(touched(p))}</span>
                  <button type="button" className="link small pin-unpin" onClick={() => setPinned(p, false)} aria-label={`Unpin ${p.name}`}>Unpin</button>
                </div>
              </article>
            ))}
          </div>
          <button type="button" className="pin-arrow right" onClick={() => go(1)} disabled={!edge.right} aria-label="Scroll right">›</button>
        </div>
      )}
      {!pinned.length && <p className="muted">Pin the projects you want to keep coming back to. They stay here until you unpin them.</p>}
    </section>
  )
}
