import { useState } from 'react'
import TaskRow from '../TaskRow'
import { store } from '../../lib/store'
import { notify } from '../../lib/notify'
import type { TodayData } from '../../lib/useTodayData'
import type { ProjectTask } from '../../types'

type By = 'flat' | 'due' | 'project'
const BY: { id: By; label: string }[] = [{ id: 'due', label: 'Due' }, { id: 'project', label: 'Project' }, { id: 'flat', label: 'All' }]
const LIMIT = 8
const KEY = 'tm-todos-by'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function dueGroup(t: ProjectTask, today: string, week: string): string {
  if (!t.due_on) return 'No date'
  if (t.due_on < today) return 'Overdue'
  if (t.due_on === today) return 'Today'
  return t.due_on <= week ? 'This week' : 'Later'
}
const DUE_ORDER = ['Overdue', 'Today', 'This week', 'Later', 'No date']

export default function Todos({ d }: { d: TodayData }) {
  const [all, setAll] = useState(false)
  const [by, setByState] = useState<By>(() => { try { const v = localStorage.getItem(KEY); return v === 'flat' || v === 'project' ? v : 'due' } catch { return 'due' } })
  const setBy = (b: By) => { setByState(b); try { localStorage.setItem(KEY, b) } catch { /* ignore */ } }

  const today = iso(d.now), weekEnd = iso(new Date(d.now.getFullYear(), d.now.getMonth(), d.now.getDate() + 7))
  const name = (t: ProjectTask) => (t.project_id ? d.byId.get(t.project_id)?.name : null) ?? 'No project'
  const label = (t: ProjectTask) => by === 'due' ? dueGroup(t, today, weekEnd) : by === 'project' ? name(t) : ''
  const sorted = [...d.openTasks]
  if (by === 'due') sorted.sort((a, b) => DUE_ORDER.indexOf(label(a)) - DUE_ORDER.indexOf(label(b)) || (a.due_on ?? '').localeCompare(b.due_on ?? ''))
  if (by === 'project') sorted.sort((a, b) => (name(a) === 'No project' ? 1 : 0) - (name(b) === 'No project' ? 1 : 0) || name(a).localeCompare(name(b)))

  const groups = new Set(sorted.map(label)).size
  const shown = all ? sorted : sorted.slice(0, LIMIT)
  const row = (t: ProjectTask, i: number) => (
    <div key={t.id} className={i >= LIMIT ? 'todo-more' : undefined} style={i >= LIMIT ? { animationDelay: `${Math.min(i - LIMIT, 8) * 30}ms` } : undefined}>
      <TaskRow task={t} project={by !== 'project' && t.project_id ? d.byId.get(t.project_id) : undefined} leaving={d.leaving.has('t' + t.id)}
        onToggle={d.checkOff} onRename={d.rename} onDue={d.setDue}
        onDelete={() => notify.undoable(`Deleted task "${t.title}"`, () => store.deleteTask(t.id), [t.id])} />
    </div>
  )
  const out: React.ReactNode[] = []
  let prev = ''
  shown.forEach((t, i) => {
    const g = label(t)
    if (by !== 'flat' && groups > 1 && g !== prev) { out.push(<h3 key={`h-${g}`} className={`todo-group ${g === 'Overdue' ? 'late' : ''}`}>{g}<span>{sorted.filter(x => label(x) === g).length}</span></h3>); prev = g }
    out.push(row(t, i))
  })

  return (
    <section className="card">
      <div className="card-head">
        <h2>To-dos {d.openTasks.length > 0 && <span className="count-pill">{d.openTasks.length}</span>}</h2>
        {d.openTasks.length > 1 && (
          <div className="seg todo-by" role="group" aria-label="Group to-dos by">
            {BY.map(b => <button key={b.id} type="button" className={by === b.id ? 'on' : ''} onClick={() => setBy(b.id)}>{b.label}</button>)}
          </div>
        )}
      </div>
      {out}
      {d.openTasks.length > LIMIT && <button className="link small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show ${d.openTasks.length - LIMIT} more`}</button>}
      {!d.openTasks.length && <p className="muted">Nothing to do right now. Add a to-do with the box above, or add tasks inside a project.</p>}
    </section>
  )
}
