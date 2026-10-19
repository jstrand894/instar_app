import { Link } from 'react-router-dom'
import type { TodayData } from '../../lib/useTodayData'

export default function FocusNow({ d }: { d: TodayData }) {
  return (
    <section className="card focus-now" aria-label="Focus now">
      <h2>Focus now</h2>
      <div className="focus-tiles">
        {d.focusItems.map(f => (
          <div className={`focus-tile ${f.pill?.tone ?? ''} ${d.leaving.has(f.key) ? 'leaving' : ''}`} key={f.key}>
            <span className="muted small">{f.kind}{f.when && ` · ${f.when}`}</span>
            <div className="focus-title">
              {f.tick && <input type="checkbox" className="tick" aria-label={`Mark "${f.title}" done`} onChange={f.tick} />}
              <b>{f.title}</b>
            </div>
            <div className="focus-meta">
              {f.pill && <span className={`pill dl-${f.pill.tone}`}>{f.pill.text}</span>}
              {f.project && <Link to={`/project/${f.project.id}`} className="muted small">{f.project.name}</Link>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
