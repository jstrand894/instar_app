import { Link } from 'react-router-dom'
import type { TodayData } from '../../lib/useTodayData'

export default function Reading({ d }: { d: TodayData }) {
  return (
    <section className={`card ${d.reading.length || d.coreLeft ? '' : 'slim'}`}>
      <h2>Reading now</h2>
      {d.reading.map(p => (
        <div className="trow" key={p.id}><Link to={`/read/${p.id}`}>{p.title}</Link><span className="muted small">{[p.authors.split(',')[0], p.year].filter(Boolean).join(' ')}</span></div>
      ))}
      {!d.reading.length && <p className="muted">Nothing marked "Reading". Set a paper's status in the Reading tab.</p>}
      {d.coreLeft > 0 && <Link to="/library" className="link small">{d.coreLeft} Core papers still to read →</Link>}
    </section>
  )
}
