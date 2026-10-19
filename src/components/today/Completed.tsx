import { Link } from 'react-router-dom'
import Icon from '../Icon'
import type { TodayData } from '../../lib/useTodayData'

export default function Completed({ d }: { d: TodayData }) {
  const when = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return (
    <section className={`card ${d.doneToday.length ? '' : 'slim'}`}>
      <div className="card-head"><h2>Completed today {d.doneToday.length > 0 && <span className="count-pill">{d.doneToday.length}</span>}</h2></div>
      {d.doneToday.map(x => (
        <div className="trow done-row" key={x.key}>
          <span className="done-ico" aria-hidden><Icon name="check" size={12} /></span>
          <span className="done-title">{x.title}</span>
          <span className="muted small">{x.kind}{x.project ? <> · <Link to={`/project/${x.project.id}`}>{x.project.name}</Link></> : null}</span>
          <time className="muted small done-time">{when(x.at)}</time>
        </div>
      ))}
      {!d.doneToday.length && <p className="muted">Nothing checked off yet today. Finished tasks and routines show up here.</p>}
    </section>
  )
}
