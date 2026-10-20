import { Link } from 'react-router-dom'
import type { TodayData } from '../../lib/useTodayData'

export default function Attention({ d }: { d: TodayData }) {
  return (
    <section className={`card ${d.stale.length ? 'attn' : 'slim'}`}>
      <h2>Needs attention {d.stale.length > 0 && <span className="count-pill warn">{d.stale.length}</span>}</h2>
      {d.stale.map(({ p, days }) => (
        <div className="trow" key={p.id}><Link to={`/project/${p.id}`}>{p.name}</Link><span className="muted small">no update in {days} days</span></div>
      ))}
      {!d.stale.length && <p className="muted">Every active project has been touched in the last two weeks.</p>}
    </section>
  )
}
