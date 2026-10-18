import { useEffect, useMemo, useRef, useState } from 'react'
import { STAGES } from '../lib/manuscript'
import type { Paper, Project, ProjectTask, ProjectUpdate } from '../types'

const WEEKS = 10
const SERIES = [
  { id: 'reading', label: 'Papers read', color: 'var(--accent)' },
  { id: 'projects', label: 'Project activity', color: 'var(--t-data)' },
  { id: 'manuscripts', label: 'Manuscript activity', color: 'var(--t-manuscript)' },
] as const
type SeriesId = typeof SERIES[number]['id']

const weekStart = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const addWeeks = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n * 7)

/** Weekly activity for the last 10 weeks, plus progress meters for reading, projects and manuscripts. */
export default function ProgressChart({ updates, projects, papers, tasks }: {
  updates: ProjectUpdate[]; projects: Project[]; papers: Paper[]; tasks: ProjectTask[]
}) {
  const [shown, setShown] = useState<Set<SeriesId>>(new Set(['reading', 'projects', 'manuscripts']))
  // draw at the real width so text stays readable on phones and bars don't stretch on big screens
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const el = wrap.current; if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)))
    ro.observe(el); setWidth(Math.round(el.clientWidth)); return () => ro.disconnect()
  }, [])

  const { weeks, max, hasData } = useMemo(() => {
    const thisWeek = weekStart(new Date())
    const starts = Array.from({ length: WEEKS }, (_, i) => addWeeks(thisWeek, i - (WEEKS - 1)))
    const index = (iso: string | null | undefined) => {
      if (!iso) return -1
      const t = new Date(iso).getTime()
      return starts.findIndex((s, i) => t >= s.getTime() && t < (i + 1 < starts.length ? starts[i + 1].getTime() : addWeeks(s, 1).getTime()))
    }
    const byId = new Map(projects.map(p => [p.id, p]))
    const weeks = starts.map(s => ({ start: s, reading: 0, projects: 0, manuscripts: 0 }))
    for (const p of papers) { const i = p.status === 'read' ? index(p.read_at) : -1; if (i >= 0) weeks[i].reading++ }
    for (const u of updates) {
      const i = index(u.created_at); if (i < 0) continue
      const pr = byId.get(u.project_id); if (!pr) continue
      weeks[i][pr.type === 'manuscript' ? 'manuscripts' : 'projects']++
    }
    for (const t of tasks) {
      const i = t.done ? index(t.done_at) : -1; if (i < 0) continue
      const pr = byId.get(t.project_id); if (!pr) continue
      weeks[i][pr.type === 'manuscript' ? 'manuscripts' : 'projects']++
    }
    const max = Math.max(1, ...weeks.flatMap(w => SERIES.map(s => w[s.id])))
    const hasData = weeks.some(w => w.reading + w.projects + w.manuscripts > 0)
    return { weeks, max, hasData }
  }, [updates, projects, papers, tasks])

  const core = papers.filter(p => p.priority === 'Core')
  const coreRead = core.filter(p => p.status === 'read').length
  const week = weeks[weeks.length - 1]
  const ms = projects.filter(p => p.type === 'manuscript')
  const stageCounts = STAGES.map(s => ({ ...s, n: ms.filter(p => (p.stage ?? 'drafting') === s.id).length })).filter(s => s.n > 0)
  const activeProjects = projects.filter(p => p.type !== 'manuscript' && p.status === 'active')
  const openTasks = tasks.filter(t => !t.done).length
  const doneThisWeek = tasks.filter(t => t.done && t.done_at && new Date(t.done_at) >= weeks[weeks.length - 1].start).length

  // chart geometry
  const W = Math.max(260, width), H = 200, L = 28, R = 4, T = 8, B = 26
  const iw = W - L - R, ih = H - T - B
  const active = SERIES.filter(s => shown.has(s.id))
  const groupW = iw / WEEKS
  const barW = Math.max(3, Math.min(16, (groupW - 8) / Math.max(1, active.length)))
  const tick = max <= 4 ? 1 : Math.ceil(max / 4)
  const ticks = Array.from({ length: Math.floor(max / tick) + 1 }, (_, i) => i * tick)
  const y = (v: number) => T + ih - (v / (ticks[ticks.length - 1] || 1)) * ih
  const top = ticks[ticks.length - 1] || 1

  const toggle = (id: SeriesId) => setShown(s => { const n = new Set(s); if (n.has(id)) { if (n.size > 1) n.delete(id) } else n.add(id); return n })
  const label = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <section className="card progress">
      <div className="card-head">
        <h2>Your progress</h2>
        <div className="legend" role="group" aria-label="Choose what to show">
          {SERIES.map(s => (
            <button key={s.id} className={shown.has(s.id) ? 'on-soft' : ''} onClick={() => toggle(s.id)} style={{ ['--c' as string]: s.color }} aria-pressed={shown.has(s.id)}>
              <i style={{ background: s.color }} />{s.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrap} className="chart-wrap">
      {hasData ? (
        <svg className="chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Weekly activity for the last ${WEEKS} weeks. This week: ${week.reading} papers read, ${week.projects} project actions, ${week.manuscripts} manuscript actions.`}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid-line" />
              <text x={L - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
            </g>
          ))}
          {weeks.map((w, i) => {
            const gx = L + i * groupW + (groupW - barW * active.length) / 2
            const isNow = i === WEEKS - 1
            return (
              <g key={i}>
                <title>{`Week of ${label(w.start)}: ${w.reading} read, ${w.projects} project, ${w.manuscripts} manuscript`}</title>
                {active.map((s, k) => {
                  const v = w[s.id]; const h = (v / top) * ih
                  return <rect key={s.id} x={gx + k * barW} y={T + ih - h} width={barW - 2} height={Math.max(h, v ? 2 : 0)} rx="3" fill={s.color} opacity={isNow ? 1 : 0.8} />
                })}
                {((W < 420 ? i % 3 === (WEEKS - 1) % 3 : i % 2 === (WEEKS - 1) % 2) || isNow) && (
                  <text x={L + i * groupW + groupW / 2} y={H - 8} textAnchor="middle" className={`axis ${isNow ? 'now' : ''}`}>{isNow ? 'This week' : label(w.start)}</text>
                )}
              </g>
            )
          })}
        </svg>
      ) : (
        <p className="muted chart-empty">Your progress will show up here as you log updates, finish tasks and read papers.</p>
      )}
      </div>

      <div className="meters">
        <div className="meter-block">
          <span className="meter-label">Reading</span>
          <b>{week.reading}<small> read this week</small></b>
          {core.length > 0 ? (
            <>
              <div className="meter"><i style={{ width: `${(coreRead / core.length) * 100}%`, background: 'var(--accent)' }} /></div>
              <small className="muted">{coreRead} of {core.length} Core papers read</small>
            </>
          ) : <small className="muted">{papers.filter(p => p.status === 'read').length} of {papers.length} papers read</small>}
        </div>
        <div className="meter-block">
          <span className="meter-label">Projects</span>
          <b>{doneThisWeek}<small> tasks done this week</small></b>
          <div className="meter"><i style={{ width: `${tasks.length ? ((tasks.length - openTasks) / tasks.length) * 100 : 0}%`, background: 'var(--t-data)' }} /></div>
          <small className="muted">{activeProjects.length} active project{activeProjects.length === 1 ? '' : 's'}, {openTasks} open task{openTasks === 1 ? '' : 's'}</small>
        </div>
        <div className="meter-block">
          <span className="meter-label">Manuscripts</span>
          <b>{ms.filter(p => (p.stage ?? 'drafting') !== 'accepted').length}<small> in progress</small></b>
          {ms.length > 0 ? (
            <>
              <div className="stagebar" role="img" aria-label={stageCounts.map(s => `${s.n} ${s.label}`).join(', ')}>
                {stageCounts.map((s, i) => <i key={s.id} style={{ flex: s.n, opacity: 0.45 + 0.55 * (i + 1) / stageCounts.length, background: 'var(--t-manuscript)' }} title={`${s.label}: ${s.n}`} />)}
              </div>
              <small className="muted">{stageCounts.map(s => `${s.n} ${s.label.toLowerCase()}`).join(' · ')}</small>
            </>
          ) : <small className="muted">No manuscripts yet</small>}
        </div>
      </div>
    </section>
  )
}
