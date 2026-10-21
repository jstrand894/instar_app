import { useEffect, useState } from 'react'
import Icon from '../Icon'
import { Link } from 'react-router-dom'
import RescueFreeze from '../RescueFreeze'
import { useGame, XP } from '../../lib/game'
import { rankFor } from '../../lib/rewards'

const R = 36, C = 2 * Math.PI * R

export default function Quests() {
  const g = useGame()
  const [ready, setReady] = useState(false) // lets the ring and bars grow in from empty
  useEffect(() => { const t = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(t) }, [])
  if (!g) return null
  const done = g.quests.filter(q => q.done).length
  const all = done === g.quests.length
  const frac = g.span ? g.into / g.span : 0
  const max = Math.max(50, ...g.week.map(w => w.xp))
  return (
    <section className="card quests">
      <div className="card-head">
        <h2>Daily goals <span className="count-pill">{done}/{g.quests.length}</span></h2>
        <span className="muted small">{g.today.xp} XP today{g.today.questBonus ? ` (incl. +${XP.quest} bonus)` : ''}</span>
      </div>
      <div className="quests-body">
        <div className="q-level" title={`${g.xp} XP in total`}>
          <svg viewBox="0 0 84 84" className="q-ring" aria-hidden>
            <circle cx="42" cy="42" r={R} className="q-ring-bg" />
            <circle cx="42" cy="42" r={R} className="q-ring-fg" strokeDasharray={C} strokeDashoffset={ready ? C * (1 - frac) : C} transform="rotate(-90 42 42)" />
          </svg>
          <div className="q-ring-num"><b>{g.level}</b><span>Level</span></div>
          <div className="q-level-text">
            <b>{g.xp.toLocaleString()} XP</b>
            <Link to="/rewards" className="q-rank">{rankFor(g.level).name}</Link>
            <span className="muted small">{(g.span - g.into).toLocaleString()} to level {g.level + 1}</span>
          </div>
        </div>

        <div className="q-goals">
          {g.quests.map(q => (
            <div key={q.id} className={`q-goal ${q.done ? 'done' : ''}`}>
              <span className="q-check" aria-hidden>{q.done ? <Icon name="check" size={12} /> : null}</span>
              <span className="q-text">{q.label}</span>
              <span className="q-count">{q.done ? 'Done' : `${q.have}/${q.need}`}</span>
              <span className="q-bar" aria-hidden><i style={{ width: ready ? `${(q.have / q.need) * 100}%` : '0%' }} /></span>
            </div>
          ))}
          <div className={`q-bonus ${all ? 'got' : ''}`}>{all ? `All three done: +${XP.quest} XP bonus` : `Finish all three for +${XP.quest} XP`}</div>
        </div>

        <div className="q-streak">
          <div className="q-streak-top">
            <b>{g.streak}</b>
            <span className="muted small">day streak{g.frozen ? ' · freeze used' : ''}{g.freezes > 0 ? ` · ${g.freezes} freeze${g.freezes === 1 ? '' : 's'} saved` : ''}{g.best > g.streak ? ` · best ${g.best}` : g.best > 1 ? ' · your best' : ''}</span>
          </div>
          <div className="q-week" aria-label="XP over the last 7 days">
            {g.week.map((w, i) => (
              <span key={i} className={i === g.week.length - 1 ? 'today' : ''} title={`${w.d.toLocaleDateString(undefined, { weekday: 'long' })}: ${w.xp} XP`}>
                <em><i style={{ height: ready ? `${Math.max(6, (w.xp / max) * 100)}%` : '6%' }} className={w.xp ? 'on' : ''} /></em>
                <small>{w.d.toLocaleDateString(undefined, { weekday: 'narrow' })}</small>
              </span>
            ))}
          </div>
        </div>
      </div>
      <RescueFreeze g={g} />
    </section>
  )
}
