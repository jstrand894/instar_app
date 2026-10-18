import { useEffect, useRef, useState } from 'react'
import { getPrefs } from '../lib/prefs'

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

export default function Pomodoro() {
  const [s, setS] = useState<State>(read)
  const [, tick] = useState(0)
  const sRef = useRef(s); sRef.current = s

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
    <div className="pomo">
      <div className="pomo-modes">
        {(['focus', 'short', 'long'] as Mode[]).map(m => (
          <button key={m} className={m === s.mode ? 'on' : ''} onClick={() => setS(fresh(m, s.sessions))}>{LABEL[m]}</button>
        ))}
      </div>
      <div className="pomo-time">{mm}:{ss}</div>
      <div className="pomo-bar"><i style={{ width: `${pct * 100}%` }} /></div>
      <div className="pomo-actions">
        <button className="primary" onClick={toggle}>{running ? 'Pause' : 'Start'}</button>
        <button onClick={() => setS(fresh(s.mode, s.sessions))}>Reset</button>
      </div>
      <div className="muted small">{s.sessions} session{s.sessions === 1 ? '' : 's'} today</div>
    </div>
  )
}
