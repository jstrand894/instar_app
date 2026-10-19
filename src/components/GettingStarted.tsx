import Icon from './Icon'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Paper, Project, ProjectUpdate } from '../types'

const KEY = 'tm-setup-dismissed'

/** A short checklist for a fresh account; goes away once everything is done (or when dismissed). */
export default function GettingStarted({ projects, updates, papers }: { projects: Project[]; updates: ProjectUpdate[]; papers: Paper[] }) {
  const nav = useNavigate()
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })
  const steps = [
    { done: projects.some(p => p.type !== 'manuscript'), label: 'Create a project', hint: 'A dataset, field season, code repo or app', go: () => nav('/projects?new=1') },
    { done: projects.some(p => p.type === 'manuscript'), label: 'Add a manuscript', hint: 'Track it from drafting to publication', go: () => nav('/manuscripts?new=1') },
    { done: updates.length > 0, label: 'Log your first update', hint: 'One line is plenty', go: () => window.dispatchEvent(new CustomEvent('tm-capture', { detail: { tab: 'update' } })) },
    { done: papers.length > 0, label: 'Bring in your reading', hint: 'Import a list, paste a DOI or upload a PDF', go: () => nav('/library') },
  ]
  const doneCount = steps.filter(s => s.done).length
  if (hidden || doneCount === steps.length) return null
  return (
    <section className="card started">
      <div className="card-head">
        <h2>Let's get you set up <span className="count-pill">{doneCount} of {steps.length}</span></h2>
        <button className="link small" onClick={() => { setHidden(true); try { localStorage.setItem(KEY, '1') } catch { /* ignore */ } }}>Dismiss</button>
      </div>
      <ul className="started-list">
        {steps.map(s => (
          <li key={s.label} className={s.done ? 'done' : ''}>
            <span className="started-tick" aria-hidden>{s.done && <Icon name="check" size={14} />}</span>
            <div><b>{s.label}</b><div className="muted small">{s.hint}</div></div>
            {!s.done && <button onClick={s.go}>Start</button>}
          </li>
        ))}
      </ul>
    </section>
  )
}
