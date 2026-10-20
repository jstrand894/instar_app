import { useGame } from '../lib/game'

/** Level, a thin progress bar to the next level, and the current streak, in the sidebar. */
export default function LevelChip() {
  const g = useGame()
  if (!g) return null
  const pct = Math.round((g.into / g.span) * 100)
  return (
    <div className="lvl" title={`${g.xp} XP · ${g.span - g.into} to level ${g.level + 1}${g.best > g.streak ? ` · best streak ${g.best}` : ''}`}>
      <span className="lvl-num">{g.level}</span>
      <span className="lvl-text">
        <span className="lvl-row"><b>Level {g.level}</b>{g.streak > 0 && <em>{g.streak}-day streak</em>}</span>
        <span className="lvl-bar"><i style={{ width: `${pct}%` }} /></span>
      </span>
    </div>
  )
}
