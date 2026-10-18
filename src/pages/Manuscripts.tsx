import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { store } from '../lib/store'
import { ago, fmtWhen, nextOccurrence } from '../lib/util'
import { STAGES, deadlineInfo, stageLabel } from '../lib/manuscript'
import type { PaperLink, Project, ProjectEvent, ProjectUpdate, Stage } from '../types'

const stageOf = (p: Project): Stage => p.stage ?? 'drafting'

export default function Manuscripts() {
  const [all, setAll] = useState<Project[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [events, setEvents] = useState<ProjectEvent[]>([])
  const [links, setLinks] = useState<PaperLink[]>([])
  const [filter, setFilter] = useState<Stage | 'all'>('all')
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [p, u, ev, l] = await Promise.all([
        store.projects(), store.updates(),
        store.events().catch(() => [] as ProjectEvent[]), store.projectPapers().catch(() => [] as PaperLink[]),
      ])
      setAll(p); setUpdates(u); setEvents(ev); setLinks(l)
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

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

  const shown = ms.filter(p => (filter === 'all' || stageOf(p) === filter) && (showDone || filter === 'accepted' || stageOf(p) !== 'accepted'))
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
    } catch (e) { setError((e as Error).message); refresh() }
  }
  async function togglePin(p: Project) {
    setAll(ps => ps.map(x => x.id === p.id ? { ...x, pinned: !p.pinned } : x))
    try { await store.patchProject(p.id, { pinned: !p.pinned }) } catch (e) { setError((e as Error).message); refresh() }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Manuscripts</h1>
        <button className="primary" onClick={() => setAdding(true)}>New manuscript</button>
      </header>

      <div className="stats">
        <div><b>{ms.filter(p => stageOf(p) !== 'accepted').length}</b><span>in progress</span></div>
        <div><b>{counts('submitted')}</b><span>under review</span></div>
        <div><b>{counts('revision')}</b><span>in revision</span></div>
        <div><b>{dueSoon}</b><span>due within 30 days</span></div>
      </div>

      <div className="chips">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
        {STAGES.map(s => (
          <button key={s.id} className={filter === s.id ? 'on' : ''} onClick={() => setFilter(s.id)}>{s.label} <small>{counts(s.id)}</small></button>
        ))}
        <label className="check"><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> Show accepted</label>
      </div>

      {error && <p className="error">{error}</p>}
      {adding && <NewManuscript onClose={() => setAdding(false)} onCreated={() => { setAdding(false); refresh() }} />}

      {groups.map(g => (
        <section key={g.stage.id} className="group">
          <h2 className="group-title">{g.stage.label} <span className="muted small">{g.items.length} · {g.stage.hint}</span></h2>
          <div className="grid">
            {g.items.map(p => (
              <ManuscriptCard key={p.id} p={p} last={latest.get(p.id)} next={nextEvent(p.id)}
                papers={links.filter(l => l.project_id === p.id).length}
                onStage={s => setStage(p, s)} onPin={() => togglePin(p)} />
            ))}
          </div>
        </section>
      ))}

      {!groups.length && !adding && (
        <div className="empty-box dashed">
          <h2>{ms.length ? 'Nothing here' : 'No manuscripts yet'}</h2>
          <p className="muted">{ms.length ? 'Try another stage, or show accepted manuscripts.' : 'Track each paper from first draft through review and revision to publication.'}</p>
          {!ms.length && <button className="primary" onClick={() => setAdding(true)}>New manuscript</button>}
        </div>
      )}
    </div>
  )
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

function ManuscriptCard({ p, last, next, papers, onStage, onPin }: {
  p: Project; last?: ProjectUpdate; next?: { e: ProjectEvent; when: Date | null }; papers: number
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
          <button className={`star ${p.pinned ? 'on' : ''}`} onClick={onPin} aria-pressed={!!p.pinned} title={p.pinned ? 'Unpin' : 'Pin to top'}>{p.pinned ? '★' : '☆'}</button>
        </span>
        <select className="status" value={p.stage ?? 'drafting'} onChange={e => onStage(e.target.value as Stage)} aria-label="Stage">
          {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <h2><Link to={`/project/${p.id}`} className="plink">{p.name}</Link></h2>
      <p className="muted small ms-sub">{p.journal || 'No journal yet'}{p.coauthors ? ` · with ${p.coauthors}` : ''}</p>
      <div className="ms-meta">
        {dl && <span className={`pill dl-${dl.tone}`}>{dl.text}</span>}
        {papers > 0 && <span className="pill">{papers} paper{papers === 1 ? '' : 's'}</span>}
        {next?.when && <span className="pill has-pdf">{fmtWhen(next.when)} · {next.e.title}</span>}
      </div>
      {last && <p className="ms-last"><span>{last.kind === 'note' ? 'Note · ' : ''}{last.body.length > 110 ? last.body.slice(0, 110) + '…' : last.body}</span><time>{ago(last.created_at)}</time></p>}
    </article>
  )
}
