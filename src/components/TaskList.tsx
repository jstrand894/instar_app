import { useState } from 'react'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { deadlineInfo } from '../lib/manuscript'
import InlineEdit from './InlineEdit'
import type { ProjectTask } from '../types'

const byDue = (a: ProjectTask, b: ProjectTask) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999') || a.created_at.localeCompare(b.created_at)

/** A checklist for one project: add, check off, edit, and delete with undo. */
export default function TaskList({ projectId, tasks, onChange }: { projectId: string; tasks: ProjectTask[]; onChange: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [opt, setOpt] = useState<Record<string, boolean>>({}) // instant feedback while the save finishes
  const isDone = (t: ProjectTask) => opt[t.id] ?? t.done
  const open = tasks.filter(t => !isDone(t)).sort(byDue)
  const done = tasks.filter(isDone).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await store.addTask(projectId, title.trim(), due || null); setTitle(''); setDue(''); onChange()
  }
  async function toggle(t: ProjectTask) {
    const next = !isDone(t); setOpt(o => ({ ...o, [t.id]: next }))
    try { await store.patchTask(t.id, { done: next }); onChange() } finally { setOpt(o => { const n = { ...o }; delete n[t.id]; return n }) }
  }

  const row = (t: ProjectTask) => {
    const d = isDone(t); const info = !d ? deadlineInfo(t.due_on) : null
    return (
      <li key={t.id} className={`task ${d ? 'done' : ''}`}>
        <input type="checkbox" className="tick" checked={d} onChange={() => toggle(t)} aria-label={`Mark "${t.title}" ${d ? 'not done' : 'done'}`} />
        <InlineEdit value={t.title} className="task-title" onSave={v => store.patchTask(t.id, { title: v }).then(onChange)} />
        {info && <span className={`pill dl-${info.tone}`}>{info.text}</span>}
        <button className="link small danger task-x" aria-label={`Delete "${t.title}"`}
          onClick={() => notify.undoable(`Deleted task "${t.title}"`, () => store.deleteTask(t.id), [t.id])}>×</button>
      </li>
    )
  }

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
