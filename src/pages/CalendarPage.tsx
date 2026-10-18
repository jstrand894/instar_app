import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../lib/store'
import { checkFeedUrl, expandIcs, fetchFeeds, normalizeFeedUrl, type Feed } from '../lib/calendar'
import { occurrencesBetween } from '../lib/util'
import type { Calendar, Project, ProjectEvent } from '../types'

const COLORS = ['#1982c4', '#6a4c93', '#d9822b', '#3a8f4f', '#c2185b', '#546e7a']
const PROJECT_COLOR = '#2f5d50'

interface Item {
  id: string; title: string; start: Date; end: Date; allDay: boolean
  color: string; source: string; location?: string; projectId?: string
}

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n) // calendar days, safe across DST
const timeLabel = (i: Item) => i.allDay ? 'All day' : i.start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const host = (url: string) => { try { return new URL(url.replace(/^webcal:/i, 'https:')).hostname } catch { return '' } }

export default function CalendarPage() {
  const [cals, setCals] = useState<Calendar[]>([])
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [pevents, setPevents] = useState<ProjectEvent[]>([])
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [view, setView] = useState<'month' | 'agenda'>(() => (matchMedia('(max-width: 760px)').matches ? 'agenda' : 'month'))
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState(() => key(new Date()))
  const [manage, setManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (force = false) => {
    setLoading(true); setError('')
    try {
      const [cs, ps, ev] = await Promise.all([store.calendars(), store.projects(), store.events().catch(() => [] as ProjectEvent[])])
      setCals(cs); setProjects(ps); setPevents(ev)
      setFeeds(cs.length ? await fetchFeeds(cs, force) : [])
    } catch (e) { setError((e as Error).message) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // visible window = the 6-week grid for the month
  const gridStart = useMemo(() => { const d = new Date(month); d.setDate(1 - d.getDay()); return startOfDay(d) }, [month])
  const gridEnd = useMemo(() => addDays(gridStart, 42), [gridStart])

  const { items, parseErrors } = useMemo(() => {
    const out: Item[] = []; const errs: Record<string, string> = {}
    for (const c of cals) {
      const f = feeds.find(x => x.id === c.id)
      if (!f) continue
      if (f.error) { errs[c.id] = f.error; continue }
      try {
        for (const e of expandIcs(c.id, f.ics!, gridStart, gridEnd)) out.push({ id: e.id, title: e.title, start: e.start, end: e.end, allDay: e.allDay, color: c.color, source: c.id, location: e.location })
      } catch (e) { errs[c.id] = `Could not read this calendar (${(e as Error).message})` }
    }
    for (const e of pevents) {
      const p = projects.find(x => x.id === e.project_id); if (!p) continue
      for (const d of occurrencesBetween(e, gridStart, gridEnd))
        out.push({ id: `p:${e.id}:${d.getTime()}`, title: `${p.name}: ${e.title}`, start: d, end: new Date(d.getTime() + 36e5), allDay: false, color: PROJECT_COLOR, source: 'projects', projectId: p.id })
    }
    return { items: out.filter(i => !hidden.has(i.source)).sort((a, b) => a.start.getTime() - b.start.getTime()), parseErrors: errs }
  }, [cals, feeds, pevents, projects, hidden, gridStart, gridEnd])

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const i of items) {
      const last = i.allDay ? new Date(i.end.getTime() - 1) : new Date(Math.max(i.start.getTime(), i.end.getTime() - 1))
      for (let d = startOfDay(i.start), n = 0; d <= last && n < 40; d = addDays(d, 1), n++) {
        const k = key(d); (m.get(k) ?? m.set(k, []).get(k)!).push(i)
      }
    }
    return m
  }, [items])

  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const todayKey = key(new Date())
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const shift = (n: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1))
  const toggle = (id: string) => setHidden(h => { const n = new Set(h); n.has(id) ? n.delete(id) : n.add(id); return n })

  const agendaDays = days.filter(d => d.getMonth() === month.getMonth() && byDay.get(key(d))?.length)
  const sel = byDay.get(selected) ?? []

  const Row = ({ i }: { i: Item }) => {
    const inner = (<>
      <i className="cdot" style={{ background: i.color }} />
      <span className="ctime">{timeLabel(i)}</span>
      <span className="ctitle">{i.title}{i.location && <small className="muted"> · {i.location}</small>}</span>
    </>)
    return i.projectId ? <Link className="crow" to={`/project/${i.projectId}`}>{inner}</Link> : <div className="crow">{inner}</div>
  }

  return (
    <div className="page cal">
      <header className="page-head">
        <h1>Calendar</h1>
        <div className="row">
          <button onClick={() => load(true)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
          <button className={manage ? 'on' : ''} onClick={() => setManage(!manage)}>Calendars</button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {manage && <ManageCalendars cals={cals} errors={parseErrors} onChange={() => load(true)} />}

      <div className="cal-bar">
        <div className="row">
          <button onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(key(d)) }}>Today</button>
          <button onClick={() => shift(1)} aria-label="Next month">›</button>
          <h2 className="cal-title">{monthLabel}</h2>
        </div>
        <div className="seg">
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button>
          <button className={view === 'agenda' ? 'on' : ''} onClick={() => setView('agenda')}>Agenda</button>
        </div>
      </div>

      <div className="chips">
        {cals.map(c => (
          <button key={c.id} className={hidden.has(c.id) ? '' : 'on-soft'} onClick={() => toggle(c.id)} style={{ ['--c' as string]: c.color }}>
            <i className="cdot" style={{ background: c.color }} />{c.name}
          </button>
        ))}
        <button className={hidden.has('projects') ? '' : 'on-soft'} onClick={() => toggle('projects')} style={{ ['--c' as string]: PROJECT_COLOR }}>
          <i className="cdot" style={{ background: PROJECT_COLOR }} />Project schedule
        </button>
      </div>

      {!cals.length && !loading && (
        <p className="muted small">No calendars linked yet. Use <b>Calendars</b> above to add your Google or Outlook feed. Project schedule events already appear here.</p>
      )}

      {view === 'month' ? (
        <>
          <div className="mgrid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div className="mhead" key={d}>{d}</div>)}
            {days.map(d => {
              const k = key(d); const list = byDay.get(k) ?? []
              return (
                <button key={k} className={`mcell ${d.getMonth() !== month.getMonth() ? 'out' : ''} ${k === todayKey ? 'today' : ''} ${k === selected ? 'sel' : ''}`} onClick={() => setSelected(k)}>
                  <span className="dnum">{d.getDate()}</span>
                  {list.slice(0, 3).map(i => <span className="chip-ev" key={i.id} style={{ borderLeftColor: i.color }}>{i.title}</span>)}
                  {list.length > 3 && <span className="more">+{list.length - 3} more</span>}
                  {list.length > 0 && <span className="dots">{[...new Set(list.map(i => i.color))].slice(0, 4).map(c => <i key={c} style={{ background: c }} />)}</span>}
                </button>
              )
            })}
          </div>
          <section className="card day-list">
            <h2>{new Date(selected + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
            {sel.length ? sel.map(i => <Row key={i.id + selected} i={i} />) : <p className="muted">Nothing on this day.</p>}
          </section>
        </>
      ) : (
        <div className="agenda">
          {agendaDays.map(d => (
            <section key={key(d)} className="card">
              <h2 className={key(d) === todayKey ? 'today-h' : ''}>{d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2>
              {(byDay.get(key(d)) ?? []).map(i => <Row key={i.id + key(d)} i={i} />)}
            </section>
          ))}
          {!agendaDays.length && <p className="muted">No events in {monthLabel}.</p>}
        </div>
      )}
    </div>
  )
}

function ManageCalendars({ cals, errors, onChange }: { cals: Calendar[]; errors: Record<string, string>; onChange: () => void }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState(COLORS[cals.length % COLORS.length])
  const [msg, setMsg] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const problem = checkFeedUrl(url)
    if (problem) { setMsg(problem); return }
    try { await store.addCalendar(name.trim(), normalizeFeedUrl(url), color); setName(''); setUrl(''); setMsg(''); onChange() }
    catch (er) { setMsg((er as Error).message) }
  }

  return (
    <section className="card manage">
      <h2>Linked calendars</h2>
      <ul className="callist">
        {cals.map(c => (
          <li key={c.id}>
            <i className="cdot" style={{ background: c.color }} />
            <div><b>{c.name}</b> <span className="muted small">{host(c.url)}</span>
              {errors[c.id] && <div className="error small">{errors[c.id]}
                {/404/.test(errors[c.id]) && ' Tip: open the link in a browser tab. A working feed downloads a .ics file; a "not found" page means the link is wrong, was reset, or is the Public address instead of the Secret one.'}</div>}</div>
            <button className="link small danger" onClick={async () => { if (confirm(`Remove "${c.name}" from the app? Your actual calendar is not changed.`)) { await store.deleteCalendar(c.id); onChange() } }}>Remove</button>
          </li>
        ))}
        {!cals.length && <li className="muted">None yet.</li>}
      </ul>
      <form className="calform" onSubmit={add}>
        <input placeholder="Name, e.g. Personal or University" value={name} onChange={e => setName(e.target.value)} required />
        <input placeholder="Paste the calendar feed link (.ics)" value={url} onChange={e => setUrl(e.target.value)} required autoComplete="off" spellCheck={false} />
        <div className="row">
          {COLORS.map(c => <button type="button" key={c} className={`dot ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Color ${c}`} />)}
          <span className="spacer" />
          <button className="primary">Add calendar</button>
        </div>
        {msg && <p className="error small">{msg}</p>}
      </form>
      <p className="muted small">
        <b>Google:</b> Calendar settings → your calendar → Integrate calendar → <i>Secret address in iCal format</i>.
        {' '}<b>Outlook:</b> Settings → Calendar → Shared calendars → Publish a calendar → copy the <i>ICS</i> link.
        These links work like passwords. They are stored only in your private account and the app never changes your calendars.
      </p>
    </section>
  )
}
