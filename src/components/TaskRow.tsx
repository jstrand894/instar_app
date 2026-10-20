import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deadlineInfo } from '../lib/manuscript'
import InlineEdit from './InlineEdit'
import type { Project, ProjectTask } from '../types'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }

/** Reschedule menu: today, tomorrow, next week, any date, or no date. */
function WhenMenu({ due, onPick, children }: { due: string | null; onPick: (d: string | null) => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) { setOpen(false); setDate(false) } }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setDate(false) } }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  const pick = (d: string | null) => { onPick(d); setOpen(false); setDate(false) }
  return (
    <span className="when-menu" ref={box}>
      <button type="button" className="when-btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} title="Change the due date">{children}</button>
      {open && (
        <div className="when-pop" role="menu">
          <button role="menuitem" onClick={() => pick(inDays(0))}>Today</button>
          <button role="menuitem" onClick={() => pick(inDays(1))}>Tomorrow</button>
          <button role="menuitem" onClick={() => pick(inDays(7))}>Next week</button>
          {date
            ? <input type="date" autoFocus defaultValue={due ?? ''} aria-label="Pick a date" onChange={e => e.target.value && pick(e.target.value)} />
            : <button role="menuitem" onClick={() => setDate(true)}>Pick a date…</button>}
          {due && <button role="menuitem" className="danger" onClick={() => pick(null)}>No date</button>}
        </div>
      )}
    </span>
  )
}

/** One to-do, the same everywhere: tick, editable title, due date you can change, project. */
export default function TaskRow({ task, project, leaving, done, as = 'div', late, onToggle, onRename, onDue, onDelete }: {
  task: ProjectTask; project?: Project; leaving?: boolean; done?: boolean; as?: 'div' | 'li'; late?: boolean
  onToggle: (id: string) => void; onRename?: (id: string, title: string) => void; onDue?: (id: string, due: string | null) => void; onDelete?: () => void
}) {
  const Tag = as
  const info = !done ? deadlineInfo(task.due_on) : null
  const checked = !!done || !!leaving
  return (
    <Tag className={`task-row ${as === 'div' ? 'trow' : ''} ${checked ? 'done' : ''} ${leaving ? 'leaving' : ''} ${late ? 'late' : ''}`}>
      <input type="checkbox" className="tick" checked={checked} onChange={() => onToggle(task.id)} aria-label={`Mark "${task.title}" ${done ? 'not done' : 'done'}`} />
      {onRename ? <InlineEdit value={task.title} className="task-title" onSave={v => onRename(task.id, v)} /> : <span className="task-title">{task.title}</span>}
      {project ? <Link to={`/project/${project.id}`} className="muted small task-proj">{project.name}</Link> : null}
      <span className="task-fill" />
      {info && (onDue
        ? <WhenMenu due={task.due_on} onPick={d => onDue(task.id, d)}><span className={`pill dl-${info.tone}`}>{info.text}</span></WhenMenu>
        : <span className={`pill dl-${info.tone}`}>{info.text}</span>)}
      {onDue && !done && <WhenMenu due={task.due_on} onPick={d => onDue(task.id, d)}><span className="when-dots" aria-label="Reschedule">{info ? '⋯' : '+ date'}</span></WhenMenu>}
      {onDelete && <button className="link small danger task-x" aria-label={`Delete "${task.title}"`} onClick={onDelete}>×</button>}
    </Tag>
  )
}
