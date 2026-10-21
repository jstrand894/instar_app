import { useState } from 'react'
import Icon from './Icon'
import { usePrefs } from '../lib/prefs'
import { fmtMinutes } from '../lib/util'
import { rankFor, weekRecap } from '../lib/rewards'
import { notify } from '../lib/notify'
import type { Game } from '../lib/game'

const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** A summary of one week: XP, to-dos, focus, your best day and how it compares with the week before. */
export default function Recap({ g, offset: fixed }: { g: Game; offset?: 0 | 1 }) {
  const { weekStart } = usePrefs()
  const [pick, setPick] = useState<0 | 1>(0)
  const offset = fixed ?? pick
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(today); start.setDate(start.getDate() - ((today.getDay() - weekStart + 7) % 7) - offset * 7)
  const end = new Date(start); end.setDate(end.getDate() + 6)
  const r = weekRecap(g, start)
  const change = r.prevXp ? Math.round(((r.xp - r.prevXp) / r.prevXp) * 100) : null
  const lines = [
    `Week of ${short(start)}: ${r.xp} XP${change != null ? ` (${change >= 0 ? '+' : ''}${change}% on the week before)` : ''}`,
    `${r.tasks} to-dos, ${fmtMinutes(r.minutes)} of focus, ${r.active} active day${r.active === 1 ? '' : 's'}`,
    r.best ? `Best day: ${r.best.date.toLocaleDateString(undefined, { weekday: 'long' })} with ${r.best.xp} XP` : '',
    r.levelAfter > r.levelBefore ? `Reached level ${r.levelAfter}, ${rankFor(r.levelAfter).name}` : `Level ${g.level}, ${rankFor(g.level).name}`,
  ].filter(Boolean)
  return (
    <section className="card recap">
      <div className="card-head">
        <h2>{fixed != null ? (offset === 0 ? 'Your week' : 'Last week') : 'Your week'} <span className="muted small">{short(start)} – {short(end)}</span></h2>
        {fixed == null && (
          <div className="seg" role="group" aria-label="Week">
            <button className={offset === 0 ? 'on' : ''} onClick={() => setPick(0)}>This week</button>
            <button className={offset === 1 ? 'on' : ''} onClick={() => setPick(1)}>Last week</button>
          </div>
        )}
      </div>
      <div className="rv-stats recap-stats">
        <div><b>{r.xp}</b><span>XP{change != null ? ` · ${change >= 0 ? '+' : ''}${change}%` : ''}</span></div>
        <div><b>{r.tasks}</b><span>to-dos</span></div>
        <div><b>{r.minutes ? fmtMinutes(r.minutes) : '0m'}</b><span>focus</span></div>
        <div><b>{r.active}/7</b><span>active days</span></div>
      </div>
      <p className="muted small recap-line">
        {r.best ? <>Best day was <b>{r.best.date.toLocaleDateString(undefined, { weekday: 'long' })}</b> with {r.best.xp} XP. </> : 'No activity this week yet. '}
        {r.levelAfter > r.levelBefore && <><Icon name="bolt" size={13} /> You moved up to level {r.levelAfter}, {rankFor(r.levelAfter).name}.</>}
      </p>
      <button className="link small" onClick={() => { navigator.clipboard?.writeText(lines.join('\n')).then(() => notify.success('Summary copied'), () => notify.info('Could not copy to the clipboard')) }}>Copy summary</button>
    </section>
  )
}
