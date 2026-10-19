import { Link } from 'react-router-dom'
import { ago, commitHeadline } from '../../lib/util'
import Icon from '../Icon'
import type { TodayData } from '../../lib/useTodayData'

export default function Activity({ d }: { d: TodayData }) {
  return (
    <section className={`card wide ${d.recent.length ? '' : 'slim'}`}>
      <h2>Recent activity</h2>
      {d.recent.map(u => {
        const pr = d.byId.get(u.project_id)
        const first = u.kind === 'commit' ? commitHeadline(u.body) : u.body
        return (
          <div className="trow act" key={u.id}>
            <time className="muted small">{ago(u.created_at)}</time>
            {pr ? <Link to={`/project/${pr.id}`} className="small"><b>{pr.name}</b></Link> : <span />}
            <span>{u.kind === 'note' ? 'Note · ' : ''}{u.kind === 'commit' && <Icon name="git" size={13} className="commit-ico" />}{first.length > 120 ? first.slice(0, 120) + '…' : first}</span>
          </div>
        )
      })}
      {!d.recent.length && <p className="muted">No activity yet.</p>}
    </section>
  )
}
