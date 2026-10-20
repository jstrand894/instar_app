import { Link } from 'react-router-dom'
import { ago, commitHeadline } from '../../lib/util'
import Icon from '../Icon'
import { FoldBody, FoldHead, useFold } from './Fold'
import type { TodayData } from '../../lib/useTodayData'

export default function Activity({ d }: { d: TodayData }) {
  const [open, toggle] = useFold('activity', false)
  return (
    <section className={`card wide ${open && d.recent.length ? '' : 'slim'}`}>
      <FoldHead title={<>Recent activity {d.recent.length > 0 && <span className="count-pill">{d.recent.length}</span>}</>} open={open} onToggle={toggle} />
      <FoldBody open={open}>
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
      </FoldBody>
    </section>
  )
}
