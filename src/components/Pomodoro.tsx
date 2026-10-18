import { useEffect, useRef, useState } from 'react'
import { getPrefs } from '../lib/prefs'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { fmtMinutes } from '../lib/util'
import type { Project } from '../types'

type Mode = 'focus' | 'short' | 'long'
const minutes = (m: Mode) => getPrefs().pomo[m]
const LABEL: Record<Mode, string> = { focus: 'Focus', short: 'Break', long: 'Long break' }
const KEY = 'tm-pomodoro-v1'

interface State { mode: Mode; endsAt: number | null; remaining: number; sessions: number }
const fresh = (mode: Mode, sessions = 0): State => ({ mode, endsAt: null, remaining: minutes(mode) * 60_000, sessions })

function read(): State {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s) } catch { /* ignore */ }
  return fresh('focus')
}

function chime() {
  try {
    const ctx = new AudioContext()
    ;[660, 880, 660].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.25
      g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      o.start(t); o.stop(t + 0.25)
    })
  } catch { /* ignore */ }
}

/** A circular progress ring that fills as the session runs, with the time inside. */
function Ring({ pct, label, size, running, mode }: { pct: number; label: string; size: number; running: boolean; mode: Mode }) {
  const r = 44, c = 2 * Math.PI * r
  const color = mode === 'focus' ? 'var(--accent)' : 'var(--t-field)'
  return (
    <div className={`ring ${running ? 'run' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--chip)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))} transform="rotate(-90 50 50)" className="ring-arc" />
      </svg>
      <span className="ring-time" style={{ fontSize: size * 0.22 }}>{label}</span>
    </div>
  )
}

export default function Pomodoro() {
  const [s, setS] = useState<State>(read)
  const [, tick] = useState(0)
  const sRef = useRef(s); sRef.current = s

  // which project this focus time counts toward (kept across reloads)
  const [projectId, setProjectIdState] = useState(() => { try { return localStorage.getItem('tm-pomo-project') ?? '' } catch { return '' } })
  const projRef = useRef(projectId); projRef.current = projectId
  const setProjectId = (id: string) => { setProjectIdState(id); try { localStorage.setItem('tm-pomo-project', id) } catch { /* ignore */ } }
  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    const load = () => store.projects().then(ps => setProjects(ps.filter(p => p.status === 'active' && p.stage !== 'accepted'))).catch(() => {})
    load(); window.addEventListener('tm-data', load); return () => window.removeEventListener('tm-data', load)
  }, [])

  /** Saves focused minutes to the chosen project and says so. */
  const logFocus = (mins: number) => {
    if (mins < 1) return
    const pid = projRef.current || null
    store.addTimeEntry(pid, mins, new Date(Date.now() - mins * 60_000).toISOString())
      .then(() => notify.success(`Logged ${fmtMinutes(mins)} of focus${pid ? ` to ${projects.find(p => p.id === pid)?.name ?? 'your project'}` : ''}`))
      .catch(e => notify.error(e))
  }
  /** Time already spent in a focus session that is being cut short (reset or switched away). */
  const partialMinutes = (cur: State) => {
    if (cur.mode !== 'focus') return 0
    const total = minutes('focus') * 60_000
    const leftNow = cur.endsAt ? Math.max(0, cur.endsAt - Date.now()) : cur.remaining
    return Math.floor((total - leftNow) / 60_000)
  }
  const logRef = useRef(logFocus); logRef.current = logFocus
  const restart = (mode: Mode) => { logFocus(partialMinutes(sRef.current)); setS(fresh(mode, sRef.current.sessions)) }

  // pick up changed durations from Account settings when the timer is idle
  useEffect(() => {
    const on = () => setS(cur => (cur.endsAt ? cur : fresh(cur.mode, cur.sessions)))
    window.addEventListener('tm-prefs', on); return () => window.removeEventListener('tm-prefs', on)
  }, [])

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ } }, [s])

  useEffect(() => {
    const id = setInterval(() => {
      const cur = sRef.current
      if (cur.endsAt && Date.now() >= cur.endsAt) {
        chime()
        const done = cur.mode === 'focus'
        if (done && Date.now() - cur.endsAt < 5 * 60_000) logRef.current(minutes('focus')) // skip if the app was closed and this is long stale
        const sessions = cur.sessions + (done ? 1 : 0)
        const next: Mode = done ? (sessions % 4 === 0 ? 'long' : 'short') : 'focus'
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(done ? 'Focus session complete' : 'Break over', { body: `Up next: ${LABEL[next]}` })
        }
        setS(fresh(next, sessions))
      } else tick(n => n + 1)
    }, 500)
    return () => clearInterval(id)
  }, [])

  const left = s.endsAt ? Math.max(0, s.endsAt - Date.now()) : s.remaining
  const mm = String(Math.floor(left / 60_000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')
  const running = s.endsAt !== null
  const pct = 1 - left / (minutes(s.mode) * 60_000)

  function toggle() {
    if (running) setS({ ...s, endsAt: null, remaining: left })
    else {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
      setS({ ...s, endsAt: Date.now() + left })
    }
  }

  useEffect(() => { document.title = running ? `${mm}:${ss} · ${LABEL[s.mode]}` : 'Instar' }, [running, mm, ss, s.mode])

  return (
    <>
    <div className="pomo-mini" title={`${LABEL[s.mode]}${running ? ' (running)' : ''}`}>
      <Ring pct={pct} label={`${mm}:${ss}`} size={46} running={running} mode={s.mode} />
    </div>
    <div className="pomo">
      <div className="pomo-modes">
        {(['focus', 'short', 'long'] as Mode[]).map(m => (
          <button key={m} className={m === s.mode ? 'on' : ''} onClick={() => restart(m)}>{LABEL[m]}</button>
        ))}
      </div>
      <select className="pomo-project" value={projectId} onChange={e => setProjectId(e.target.value)} aria-label="Project this time counts toward">
        <option value="">No project</option>
        {projects.filter(p => p.type === 'manuscript').length > 0 && <optgroup label="Manuscripts">{projects.filter(p => p.type === 'manuscript').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
        {projects.filter(p => p.type !== 'manuscript').length > 0 && <optgroup label="Projects">{projects.filter(p => p.type !== 'manuscript').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
      </select>
      <div className="pomo-ring"><Ring pct={pct} label={`${mm}:${ss}`} size={132} running={running} mode={s.mode} /></div>
      <div className="pomo-actions">
        <button className="primary" onClick={toggle}>{running ? 'Pause' : 'Start'}</button>
        <button onClick={() => restart(s.mode)}>Reset</button>
      </div>
      <div className="muted small">{s.sessions} session{s.sessions === 1 ? '' : 's'} today</div>
    </div>
    </>
  )
}
