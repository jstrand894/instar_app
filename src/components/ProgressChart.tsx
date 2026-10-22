import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { STAGES } from '../lib/manuscript'
import { usePrefs } from '../lib/prefs'
import { fmtMinutes } from '../lib/util'
import type { Paper, Project, ProjectTask, ProjectUpdate, TimeEntry } from '../types'

const WEEKS = 10
const METRICS = [
  { id: 'tasks', label: 'Tasks done', unit: 'tasks', fmt: (n: number) => String(n) },
  { id: 'papers', label: 'Papers read', unit: 'papers', fmt: (n: number) => String(n) },
  { id: 'updates', label: 'Updates logged', unit: 'updates', fmt: (n: number) => String(n) },
  { id: 'commits', label: 'Commits', unit: 'commits', fmt: (n: number) => String(n) },
  { id: 'focus', label: 'Focus time', unit: 'focus time', fmt: (n: number) => fmtMinutes(n) },
] as const
type MetricId = typeof METRICS[number]['id']

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** How the last ten weeks went (tiles you can click to chart), what got your attention this week, and where reading and manuscripts stand. */
export default function ProgressChart({ updates, projects, papers, tasks, time }: {
  updates: ProjectUpdate[]; projects: Project[]; papers: Paper[]; tasks: ProjectTask[]; time: TimeEntry[]
}) {
  const { weekStart } = usePrefs()
  const [metric, setMetric] = useState<MetricId>('tasks')
  const [ready, setReady] = useState(false) // lets the bars grow in from the baseline
  useEffect(() => { const r = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(r) }, [])

  const data = useMemo(() => {
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisWeek = addDays(today, -((today.getDay() - weekStart + 7) % 7))
    const starts = Array.from({ length: WEEKS }, (_, i) => addDays(thisWeek, (i - (WEEKS - 1)) * 7))
    const end = addDays(thisWeek, 7)
    const index = (iso: string | null | undefined) => {
      if (!iso) return -1
      const t = new Date(iso).getTime()
      return t >= end.getTime() ? -1 : starts.findLastIndex(s => t >= s.getTime())
    }
    const series: Record<MetricId, number[]> = { tasks: Array(WEEKS).fill(0), papers: Array(WEEKS).fill(0), updates: Array(WEEKS).fill(0), commits: Array(WEEKS).fill(0), focus: Array(WEEKS).fill(0) }
    for (const t of tasks) { const i = t.done ? index(t.done_at) : -1; if (i >= 0) series.tasks[i]++ }
    for (const p of papers) { const i = p.status === 'read' ? index(p.read_at) : -1; if (i >= 0) series.papers[i]++ }
    for (const u of updates) { const i = index(u.created_at); if (i >= 0) series[u.kind === 'commit' ? 'commits' : 'updates'][i]++ }
    for (const e of time) { const i = index(e.started_at); if (i >= 0) series.focus[i] += e.minutes }

    // what got attention this week: updates logged plus tasks finished, per project
    const byId = new Map(projects.map(p => [p.id, p]))
    const per = new Map<string, number>()
    const bump = (id: string | null) => { if (id && byId.has(id)) per.set(id, (per.get(id) ?? 0) + 1) }
    for (const u of updates) if (u.kind !== 'commit' && index(u.created_at) === WEEKS - 1) bump(u.project_id)
    for (const t of tasks) if (t.done && index(t.done_at) === WEEKS - 1) bump(t.project_id)
    const busiest = [...per].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ({ p: byId.get(id)!, n }))
    return { starts, series, busiest }
  }, [updates, projects, papers, tasks, time, weekStart])

  const m = METRICS.find(x => x.id === metric)!
  const vals = data.series[metric]
  const max = Math.max(1, ...vals)
  const past = vals.slice(0, -1)
  const avg = past.length ? past.reduce((a, b) => a + b, 0) / past.length : 0
  const label = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const any = METRICS.some(x => data.series[x.id].some(v => v > 0))

  const core = papers.filter(p => p.priority === 'Core')
  const coreRead = core.filter(p => p.status === 'read').length
  const ms = projects.filter(p => p.type === 'manuscript')
  const stages = STAGES.map(s => ({ ...s, n: ms.filter(p => (p.stage ?? 'drafting') === s.id).length }))
  const inProgress = ms.filter(p => (p.stage ?? 'drafting') !== 'accepted').length
  const bMax = Math.max(1, ...data.busiest.map(b => b.n))

  return (
    <section className="card progress">
      <div className="card-head"><h2>Your progress</h2><span className="muted small">Last {WEEKS} weeks</span></div>

      <div className="pg-tiles" role="tablist" aria-label="Choose what to chart">
        {METRICS.map(x => {
          const s = data.series[x.id], now = s[WEEKS - 1], prev = s[WEEKS - 2], d = now - prev, tMax = Math.max(1, ...s)
          return (
            <button key={x.id} role="tab" aria-selected={metric === x.id} className={`pg-tile ${metric === x.id ? 'on' : ''}`} onClick={() => setMetric(x.id)}>
              <span className="pg-label">{x.label}</span>
              <span className="pg-num"><b>{x.fmt(now)}</b><small>this week</small></span>
              <span className={`pg-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`}>
                {d === 0 ? (prev ? 'Same as last week' : 'Nothing yet') : `${d > 0 ? '▲' : '▼'} ${x.id === 'focus' ? fmtMinutes(Math.abs(d)) : Math.abs(d)} vs last week`}
              </span>
              <span className="pg-spark" aria-hidden>{s.map((v, i) => <i key={i} className={i === WEEKS - 1 ? 'now' : ''} style={{ height: ready ? `${Math.max(v ? 12 : 4, (v / tMax) * 100)}%` : '4%' }} />)}</span>
            </button>
          )
        })}
      </div>

      {any ? (
        <div className="pg-chart" aria-label={`${m.label} per week for the last ${WEEKS} weeks`}>
          <div className="pg-chart-head">
            <b>{m.label} per week</b>
            <span className="muted small">{avg > 0 ? `Dashed line: your usual ${m.id === 'focus' ? fmtMinutes(Math.round(avg)) : avg >= 10 ? Math.round(avg) : Math.round(avg * 10) / 10} a week` : 'Building your baseline'}</span>
          </div>
          <div className="pg-bars">
            {avg > 0 && <span className="pg-avgzone" aria-hidden><i className="pg-avg" style={{ bottom: `${Math.min(100, (avg / max) * 100)}%` }} /></span>}
            {vals.map((v, i) => (
              <div key={i} className={`pg-col ${i === WEEKS - 1 ? 'now' : ''}`} title={`Week of ${label(data.starts[i])}: ${m.fmt(v)} ${m.unit}`}>
                <span className="pg-val">{v ? m.fmt(v) : ''}</span>
                <span className="pg-bar"><i style={{ height: ready ? `${Math.max(v ? 3 : 0, (v / max) * 100)}%` : '0%' }} /></span>
                <small>{i === WEEKS - 1 ? 'This week' : label(data.starts[i])}</small>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="muted chart-empty">Your progress will show up here as you finish tasks, log updates, read papers and focus.</p>
      )}

      <div className="pg-panels">
        <div className="pg-panel">
          <span className="meter-label">Most active this week</span>
          {data.busiest.length ? (
            <ul className="pg-busy">
              {data.busiest.map(b => (
                <li key={b.p.id}>
                  <Link to={`/project/${b.p.id}`} className="pg-busy-name">{b.p.name}</Link>
                  <span className="pg-busy-bar"><i className={`t-${b.p.type}`} style={{ width: ready ? `${(b.n / bMax) * 100}%` : '0%' }} /></span>
                  <small className="muted">{b.n}</small>
                </li>
              ))}
            </ul>
          ) : <p className="muted small">Nothing logged on a project yet this week. Finish a task or add an update and it shows here.</p>}
        </div>

        <div className="pg-panel">
          <span className="meter-label">Manuscripts</span>
          {ms.length ? (
            <>
              <div className="pg-pipe">
                {stages.map(s => (
                  <div key={s.id} className={`pg-stage ${s.n ? 'has' : ''}`} title={`${s.label}: ${s.n}`}>
                    <b>{s.n}</b><small>{s.id === 'submitted' ? 'Review' : s.id === 'internal' ? 'Internal' : s.id === 'accepted' ? 'Done' : s.label}</small>
                  </div>
                ))}
              </div>
              <small className="muted">{inProgress} in progress</small>
            </>
          ) : <p className="muted small">No manuscripts yet.</p>}
        </div>

        <div className="pg-panel">
          <span className="meter-label">Reading</span>
          {core.length ? (
            <>
              <div className="pg-core"><b>{coreRead}</b><span className="muted"> of {core.length} Core papers read</span></div>
              <div className="meter"><i style={{ width: ready ? `${(coreRead / core.length) * 100}%` : '0%', transition: 'width .8s cubic-bezier(.3,1,.4,1)' }} /></div>
            </>
          ) : (
            <div className="pg-core"><b>{papers.filter(p => p.status === 'read').length}</b><span className="muted"> of {papers.length} papers read</span></div>
          )}
          {core.length > 0 && coreRead < core.length && <small className="muted">{core.length - coreRead} to go</small>}
        </div>
      </div>
    </section>
  )
}
