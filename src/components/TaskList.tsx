import { useState } from 'react'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import TaskRow from './TaskRow'
import type { ProjectTask } from '../types'

const byDue = (a: ProjectTask, b: ProjectTask) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999') || a.created_at.localeCompare(b.created_at)

const EXIT_MS = 520

/** A checklist for one project: add, check off, edit, and delete with undo. */
export default function TaskList({ projectId, tasks, onChange }: { projectId: string; tasks: ProjectTask[]; onChange: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [opt, setOpt] = useState<Record<string, boolean>>({}) // instant feedback while the save finishes
  const [leaving, setLeaving] = useState<Set<string>>(new Set()) // just checked: play the check-off animation before the row moves
  const isDone = (t: ProjectTask) => opt[t.id] ?? t.done
  const open = tasks.filter(t => !isDone(t)).sort(byDue)
  const done = tasks.filter(isDone).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await store.addTask(projectId, title.trim(), due || null); setTitle(''); setDue(''); onChange(); notify.added()
  }
  async function toggle(t: ProjectTask) {
    const next = !isDone(t)
    if (next) { setLeaving(s => new Set(s).add(t.id)); await new Promise(r => setTimeout(r, EXIT_MS)); setLeaving(s => { const n = new Set(s); n.delete(t.id); return n }) }
    setOpt(o => ({ ...o, [t.id]: next }))
    try {
      await store.patchTask(t.id, { done: next }); onChange()
      if (next) notify.action(`Completed "${t.title}"`, 'Undo', async () => { await store.patchTask(t.id, { done: false }); onChange() })
    } finally { setOpt(o => { const n = { ...o }; delete n[t.id]; return n }) }
  }

  const row = (t: ProjectTask) => (
    <TaskRow as="li" key={t.id} task={t} done={isDone(t) && !leaving.has(t.id)} leaving={leaving.has(t.id)} onToggle={() => toggle(t)}
      onRename={(id, v) => store.patchTask(id, { title: v }).then(onChange)} onDue={(id, d) => store.patchTask(id, { due_on: d }).then(onChange)}
      onDelete={() => notify.undoable(`Deleted task "${t.title}"`, () => store.deleteTask(t.id), [t.id])} />
  )

  return (
    <section className="card tasks-card">
      <div className="card-head"><h2>Tasks {open.length > 0 && <span className="count-pill">{open.length}</span>}</h2></div>
      <form className="task-add" onSubmit={add}>
        <input placeholder="Add a task…  (press Enter)" value={title} onChange={e => setTitle(e.target.value)} />
        <input type="date" value={due} onChange={e => setDue(e.target.value)} aria-label="Due date (optional)" />
        <button className="primary" disabled={!title.trim()}>Add</button>
      </form>
      <ul className="task-list">
        {open.map(row)}
        {!tasks.length && <li className="muted">No tasks yet. Break the work into small steps and check them off here.</li>}
        {!!tasks.length && !open.length && <li className="muted">All done. Nice work.</li>}
      </ul>
      {done.length > 0 && (
        <>
          <button className="link small" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide' : 'Show'} {done.length} completed</button>
          {showDone && <ul className="task-list">{done.map(row)}</ul>}
        </>
      )}
    </section>
  )
}
