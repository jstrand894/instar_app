import { Link } from 'react-router-dom'
import type { TodayData } from '../../lib/useTodayData'

export default function Deadlines({ d }: { d: TodayData }) {
  return (
    <section className="card">
      <div className="card-head"><h2>Deadlines {d.dueItems.length > 0 && <span className="count-pill">{d.dueItems.length}</span>}</h2></div>
      {d.dueItems.map(x => (
        <div className={`trow ${x.id && d.leaving.has('d' + x.id) ? 'leaving' : ''}`} key={x.key}>
          {x.id
            ? <input type="checkbox" className="tick" aria-label={`Mark "${x.title}" done`} onChange={() => d.finishDeadline(x.id!)} />
            : <span className="tick-gap" />}
          <span className={`pill dl-${x.info.tone}`}>{x.info.text}</span>
          <span>{x.title}</span>
          <Link to={`/project/${x.project!.id}`} className="muted small">{x.project!.name}</Link>
        </div>
      ))}
      {!d.dueItems.length && <p className="muted">Nothing due in the next three weeks. Add one with the box above.</p>}
    </section>
  )
}
