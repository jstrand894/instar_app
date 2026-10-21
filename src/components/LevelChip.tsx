import { useNavigate } from 'react-router-dom'
import { useGame } from '../lib/game'
import { rankFor } from '../lib/rewards'

/** Level, a thin progress bar to the next level, and the current streak, in the sidebar. */
export default function LevelChip() {
  const g = useGame()
  const nav = useNavigate()
  if (!g) return null
  const pct = Math.round((g.into / g.span) * 100)
  return (
    <div className="lvl" role="link" tabIndex={0} onClick={() => nav('/rewards')} onKeyDown={e => { if (e.key === 'Enter') nav('/rewards') }} title={`${rankFor(g.level).name} · ${g.xp} XP · ${g.span - g.into} to level ${g.level + 1}${g.best > g.streak ? ` · best streak ${g.best}` : ''}`}>
      <span className="lvl-num">{g.level}</span>
      <span className="lvl-text">
        <span className="lvl-row"><b>{rankFor(g.level).name}</b>{g.streak > 0 && <em>{g.streak}-day streak</em>}</span>
        <span className="lvl-bar"><i style={{ width: `${pct}%` }} /></span>
      </span>
    </div>
  )
}
