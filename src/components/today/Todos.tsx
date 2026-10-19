import { useState } from 'react'
import TaskRow from '../TaskRow'
import type { TodayData } from '../../lib/useTodayData'

export default function Todos({ d }: { d: TodayData }) {
  const [all, setAll] = useState(false)
  const shown = all ? d.openTasks : d.openTasks.slice(0, 8)
  return (
    <section className="card">
      <div className="card-head"><h2>To-dos {d.openTasks.length > 0 && <span className="count-pill">{d.openTasks.length}</span>}</h2></div>
      {shown.map(t => (
        <TaskRow key={t.id} task={t} project={t.project_id ? d.byId.get(t.project_id) : undefined} leaving={d.leaving.has('t' + t.id)}
          onToggle={d.checkOff} onRename={d.rename} onDue={d.setDue} />
      ))}
      {d.openTasks.length > 8 && <button className="link small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show ${d.openTasks.length - 8} more`}</button>}
      {!d.openTasks.length && <p className="muted">Nothing to do right now. Add a to-do with the box above, or add tasks inside a project.</p>}
    </section>
  )
}
