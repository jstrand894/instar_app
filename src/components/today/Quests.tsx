import Icon from '../Icon'
import { useGame, XP } from '../../lib/game'

export default function Quests() {
  const g = useGame()
  if (!g) return null
  const done = g.quests.filter(q => q.done).length
  const max = Math.max(50, ...g.week.map(w => w.xp))
  const pct = Math.round((g.into / g.span) * 100)
  return (
    <section className="card quests">
      <div className="card-head">
        <h2>Daily goals <span className="count-pill">{done}/{g.quests.length}</span></h2>
        <span className="muted small">{g.today.xp} XP today{g.today.questBonus ? ` (incl. +${XP.quest} bonus)` : ''}</span>
      </div>
      <div className="quests-body">
        <ul className="quest-list">
          {g.quests.map(q => (
            <li key={q.id} className={q.done ? 'done' : ''}>
              <span className="quest-tick" aria-hidden>{q.done && <Icon name="check" size={12} />}</span>
              <span className="quest-label">{q.label}</span>
              <span className="muted small">{q.done ? 'Done' : `${q.have}/${q.need}`}</span>
            </li>
          ))}
          <li className="quest-bonus muted small">Finish all three for +{XP.quest} XP</li>
        </ul>
        <div className="quest-side">
          <div className="quest-level">
            <div><b>Level {g.level}</b> <span className="muted small">{g.xp} XP</span></div>
            <div className="lvl-bar wide"><i style={{ width: `${pct}%` }} /></div>
            <div className="muted small">{g.span - g.into} XP to level {g.level + 1}</div>
          </div>
          <div className="quest-streak">
            <b>{g.streak}</b> <span className="muted small">day streak{g.frozen ? ' · rest day used' : ''}{g.best > g.streak ? ` · best ${g.best}` : ''}</span>
          </div>
          <div className="quest-week" aria-label="XP over the last 7 days">
            {g.week.map((w, i) => (
              <span key={i} title={`${w.d.toLocaleDateString(undefined, { weekday: 'long' })}: ${w.xp} XP`}>
                <i style={{ height: `${Math.max(4, (w.xp / max) * 100)}%` }} className={w.xp ? 'on' : ''} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
