import Icon from '../components/Icon'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import Empty from '../components/Empty'
import { store } from '../lib/store'
import { friendlyError } from '../lib/errors'
import { ago, fmtWhen, nextOccurrence } from '../lib/util'
import { STAGES, deadlineInfo, stageLabel } from '../lib/manuscript'
import type { ProjectTask, PaperLink, Project, ProjectEvent, ProjectUpdate, Stage } from '../types'

const stageOf = (p: Project): Stage => p.stage ?? 'drafting'

export default function Manuscripts() {
  const [all, setAll] = useState<Project[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [events, setEvents] = useState<ProjectEvent[]>([])
  const [links, setLinks] = useState<PaperLink[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [filter, setFilter] = useState<Stage | 'all'>('all')
  const [tag, setTag] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)
  const [params, setParams] = useSearchParams()
  useEffect(() => { if (params.get('new')) { setAdding(true); setParams({}, { replace: true }) } }, [params, setParams])
  const [view, setViewState] = useState<'board' | 'list'>(() => { try { const v = localStorage.getItem('tm-ms-view'); if (v === 'board' || v === 'list') return v } catch { /* ignore */ } return window.innerWidth > 900 ? 'board' : 'list' })
  const setView = (v: 'board' | 'list') => { setViewState(v); try { localStorage.setItem('tm-ms-view', v) } catch { /* ignore */ } }
  const [dragId, setDragId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [p, u, ev, l, tk] = await Promise.all([
        store.projects(), store.updates(),
        store.events().catch(() => [] as ProjectEvent[]), store.projectPapers().catch(() => [] as PaperLink[]), store.tasks().catch(() => [] as ProjectTask[]),
      ])
      setAll(p); setUpdates(u); setEvents(ev); setLinks(l); setTasks(tk)
    } catch (e) { setError(friendlyError(e)) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { window.addEventListener('tm-data', refresh); return () => window.removeEventListener('tm-data', refresh) }, [refresh])

  const ms = useMemo(() => all.filter(p => p.type === 'manuscript'), [all])
  const latest = useMemo(() => {
    const m = new Map<string, ProjectUpdate>()
    for (const u of updates) { const cur = m.get(u.project_id); if (!cur || u.created_at > cur.created_at) m.set(u.project_id, u) }
    return m
  }, [updates])
  const nextEvent = (id: string) => events.filter(e => e.project_id === id)
    .map(e => ({ e, when: nextOccurrence(e) })).filter(x => x.when).sort((a, b) => a.when!.getTime() - b.when!.getTime())[0]

  const counts = (s: Stage) => ms.filter(p => stageOf(p) === s).length
  const dueSoon = ms.filter(p => stageOf(p) !== 'accepted' && (deadlineInfo(p.deadline)?.days ?? 99) <= 30).length

  const allTags = [...new Set(ms.flatMap(p => p.tags ?? []))].sort()
  const shown = ms.filter(p => (!tag || (p.tags ?? []).includes(tag)) && (filter === 'all' || stageOf(p) === filter) && (showDone || filter === 'accepted' || stageOf(p) !== 'accepted'))
  const groups = STAGES.map(s => ({
    stage: s,
    items: shown.filter(p => stageOf(p) === s.id).sort((a, b) =>
      Number(!!b.pinned) - Number(!!a.pinned) ||
      (deadlineInfo(a.deadline)?.days ?? 1e6) - (deadlineInfo(b.deadline)?.days ?? 1e6) ||
      (latest.get(b.id)?.created_at ?? b.created_at).localeCompare(latest.get(a.id)?.created_at ?? a.created_at)),
  })).filter(g => g.items.length)

  async function setStage(p: Project, next: Stage) {
    const prev = stageOf(p); if (prev === next) return
    setAll(ps => ps.map(x => x.id === p.id ? { ...x, stage: next } : x))
    try {
      await store.patchProject(p.id, { stage: next })
      await store.addUpdate(p.id, `Stage: ${stageLabel(prev)} → ${stageLabel(next)}`)
      refresh()
    } catch (e) { setError(friendlyError(e)); refresh() }
  }
  async function togglePin(p: Project) {
    setAll(ps => ps.map(x => x.id === p.id ? { ...x, pinned: !p.pinned } : x))
    try { await store.patchProject(p.id, { pinned: !p.pinned }) } catch (e) { setError(friendlyError(e)); refresh() }
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null)
    const p = ms.find(x => x.id === e.active.id); const to = e.over?.id as Stage | undefined
    if (p && to && STAGES.some(s => s.id === to) && to !== stageOf(p)) setStage(p, to)
  }
  const dragged = ms.find(p => p.id === dragId)
  const cardFor = (p: Project) => (
    <ManuscriptCard p={p} last={latest.get(p.id)} next={nextEvent(p.id)}
      papers={links.filter(l => l.project_id === p.id).length} openTasks={tasks.filter(t => t.project_id === p.id && !t.done).length}
      onStage={s => setStage(p, s)} onPin={() => togglePin(p)} />
  )

  return (
    <div className="page wide-page">
      <header className="page-head">
        <h1>Manuscripts</h1>
        <div className="seg" role="group" aria-label="View">
          <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
        </div>
        <button className="primary" onClick={() => setAdding(true)}>New manuscript</button>
      </header>

      <div className="stats">
        <div><b>{ms.filter(p => stageOf(p) !== 'accepted').length}</b><span>in progress</span></div>
        <div><b>{counts('submitted')}</b><span>under review</span></div>
        <div><b>{counts('revision')}</b><span>in revision</span></div>
        <div><b>{dueSoon}</b><span>due within 30 days</span></div>
      </div>

      {view === 'list' ? <div className="chips">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
        {STAGES.map(s => (
          <button key={s.id} className={filter === s.id ? 'on' : ''} onClick={() => setFilter(s.id)}>{s.label} <small>{counts(s.id)}</small></button>
        ))}
        {allTags.length > 0 && (
          <select className="tag-filter" value={tag} onChange={e => setTag(e.target.value)} aria-label="Filter by tag">
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
        )}
        <label className="check"><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> Show accepted</label>
      </div> : allTags.length > 0 && <div className="chips">
        <select className="tag-filter" value={tag} onChange={e => setTag(e.target.value)} aria-label="Filter by tag">
          <option value="">All tags</option>
          {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
        </select>
      </div>}

      {error && <p className="error">{error}</p>}
      {adding && <NewManuscript onClose={() => setAdding(false)} onCreated={() => { setAdding(false); refresh() }} />}

      {view === 'board' && ms.length > 0 && (
        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
          <div className="board">
            {STAGES.map(s => (
              <BoardColumn key={s.id} stage={s.id} label={s.label} hint={s.hint} count={ms.filter(p => stageOf(p) === s.id).length}>
                {ms.filter(p => stageOf(p) === s.id && (!tag || (p.tags ?? []).includes(tag)))
                  .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (deadlineInfo(a.deadline)?.days ?? 1e6) - (deadlineInfo(b.deadline)?.days ?? 1e6))
                  .map(p => <BoardCard key={p.id} id={p.id} dim={dragId === p.id}>{cardFor(p)}</BoardCard>)}
              </BoardColumn>
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 180 }}>{dragged ? <div className="board-overlay">{cardFor(dragged)}</div> : null}</DragOverlay>
        </DndContext>
      )}

      {view === 'list' && groups.map(g => (
        <section key={g.stage.id} className="group">
          <h2 className="group-title">{g.stage.label} <span className="muted small">{g.items.length} · {g.stage.hint}</span></h2>
          <div className="grid">
            {g.items.map(p => (
              <ManuscriptCard key={p.id} p={p} last={latest.get(p.id)} next={nextEvent(p.id)}
                papers={links.filter(l => l.project_id === p.id).length} openTasks={tasks.filter(t => t.project_id === p.id && !t.done).length}
                onStage={s => setStage(p, s)} onPin={() => togglePin(p)} />
            ))}
          </div>
        </section>
      ))}

      {(view === 'list' ? !groups.length : !ms.length) && !adding && (
        <Empty icon="pen" dashed title={ms.length ? 'Nothing here' : 'No manuscripts yet'}
          actions={!ms.length && <button className="primary" onClick={() => setAdding(true)}>New manuscript</button>}>
          {ms.length ? 'Try another stage or tag, or show accepted manuscripts.' : 'Follow each paper from planning through drafting, review and revision to publication. Drag cards between stages as they move.'}
        </Empty>
      )}
    </div>
  )
}

function BoardColumn({ stage, label, hint, count, children }: { stage: Stage; label: string; hint: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  return (
    <section ref={setNodeRef} className={`bcol ${isOver ? 'over' : ''}`} aria-label={`${label}, ${count} manuscripts`}>
      <header><h2>{label} <span className="count-pill">{count}</span></h2><span className="muted small">{hint}</span></header>
      {children}
      {count === 0 && <p className="bcol-empty">Drop a manuscript here</p>}
    </section>
  )
}

function BoardCard({ id, dim, children }: { id: string; dim: boolean; children: React.ReactNode }) {
  const { setNodeRef, attributes, listeners } = useDraggable({ id })
  // the card is draggable by its body; buttons, links and the stage menu keep working
  return <div ref={setNodeRef} className={`bcard ${dim ? 'dim' : ''}`} {...attributes} {...listeners} tabIndex={-1} role="group">{children}</div>
}

function NewManuscript({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [journal, setJournal] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim()) return
    await store.addProject({ name: name.trim(), type: 'manuscript', description: '', area: 'work', stage: 'drafting', journal: journal.trim() })
    onCreated()
  }
  return (
    <form className="card form" onSubmit={submit}>
      <input autoFocus placeholder="Working title" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Target journal (optional)" value={journal} onChange={e => setJournal(e.target.value)} />
      <div className="row"><button className="primary">Create</button><button type="button" onClick={onClose}>Cancel</button></div>
    </form>
  )
}

function ManuscriptCard({ p, last, next, papers, openTasks, onStage, onPin }: {
  openTasks: number; p: Project; last?: ProjectUpdate; next?: { e: ProjectEvent; when: Date | null }; papers: number
  onStage: (s: Stage) => void; onPin: () => void
}) {
  const nav = useNavigate()
  const dl = deadlineInfo(p.deadline)
  return (
    <article className="card project clickable t-manuscript"
      onClick={e => { if (!(e.target as HTMLElement).closest('select, input, button, a, textarea, form')) nav(`/project/${p.id}`) }}>
      <div className="project-head">
        <span className="tag"><i className="dotc" />Manuscript</span>
        <span className="card-tools">
          <button className={`star ${p.pinned ? 'on' : ''}`} onClick={onPin} aria-pressed={!!p.pinned} title={p.pinned ? 'Unpin' : 'Pin to top'}><Icon name="star" size={18} filled={!!p.pinned} /></button>
        </span>
        <select className="status" value={p.stage ?? 'drafting'} onChange={e => onStage(e.target.value as Stage)} aria-label="Stage">
          {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <h2><Link to={`/project/${p.id}`} className="plink">{p.name}</Link></h2>
      {(p.tags?.length ?? 0) > 0 && <div className="card-tags">{p.tags!.map(t => <a key={t} href="#search" onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('tm-search', { detail: '#' + t })) }}>#{t}</a>)}</div>}
      <p className="muted small ms-sub">{p.journal || 'No journal yet'}{p.coauthors ? ` · with ${p.coauthors}` : ''}</p>
      <div className="ms-meta">
        {dl && <span className={`pill dl-${dl.tone}`}>{dl.text}</span>}
        {papers > 0 && <span className="pill">{papers} paper{papers === 1 ? '' : 's'}</span>}
        {openTasks > 0 && <span className="pill"><Icon name="task" size={12} /> {openTasks} task{openTasks === 1 ? '' : 's'}</span>}
        {next?.when && <span className="pill has-pdf">{fmtWhen(next.when)} · {next.e.title}</span>}
      </div>
      {last && <p className="ms-last"><span>{last.kind === 'note' ? 'Note · ' : ''}{last.body.length > 110 ? last.body.slice(0, 110) + '…' : last.body}</span><time>{ago(last.created_at)}</time></p>}
    </article>
  )
}
