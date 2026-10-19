import { Link } from 'react-router-dom'
import type { TodayData } from '../../lib/useTodayData'

export default function FocusTime({ d }: { d: TodayData }) {
  const { fmtMinutes } = d
  return (
    <section className={`card ${d.weekMinutes ? '' : 'slim'}`}>
      <h2>Focus time</h2>
      {d.weekMinutes > 0 ? (
        <>
          <p className="focus-total"><b>{fmtMinutes(d.weekMinutes)}</b> <span className="muted">this week · {d.weekSessions} session{d.weekSessions === 1 ? '' : 's'}</span></p>
          <div className="focus-days" role="img" aria-label={d.perDay.map(x => `${x.d.toLocaleDateString(undefined, { weekday: 'long' })} ${fmtMinutes(x.m)}`).join(', ')}>
            {d.perDay.map(x => (
              <div key={+x.d} className={`fd ${+x.d === +d.today ? 'today' : ''}`} title={`${x.d.toLocaleDateString(undefined, { weekday: 'long' })}: ${fmtMinutes(x.m)}`}>
                <i style={{ height: `${Math.max(x.m ? 6 : 0, (x.m / d.dayMax) * 100)}%` }} /><span>{x.d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
          {d.perProject.map(([id, m]) => (
            <div className="trow" key={id || 'none'}>
              <span className="muted small fp-time">{fmtMinutes(m)}</span>
              {id && d.byId.get(id) ? <Link to={`/project/${id}`} className="small">{d.byId.get(id)!.name}</Link> : <span className="muted small">No project</span>}
            </div>
          ))}
        </>
      ) : <p className="muted">No focus time yet this week. Start the timer in the sidebar (on a Mac), pick a project, and your focused time adds up here.</p>}
    </section>
  )
}
