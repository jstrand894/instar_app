import { useEffect, useState } from 'react'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { friendlyError } from '../lib/errors'
import type { Project, Routine } from '../types'

const DAYS = [{ n: 1, s: 'Mon' }, { n: 2, s: 'Tue' }, { n: 3, s: 'Wed' }, { n: 4, s: 'Thu' }, { n: 5, s: 'Fri' }, { n: 6, s: 'Sat' }, { n: 0, s: 'Sun' }]
export const dayList = (days: number[]) => DAYS.filter(d => days.includes(d.n)).map(d => d.s).join(' · ')

/** Starting point for a weekly teaching rhythm; every item can be edited afterwards. */
const TEACHING_WEEK = [
  { title: 'First posts are due tonight', weekdays: [2], notes: 'Discussion first posts close today.' },
  { title: 'Check that everyone posted in each group', weekdays: [3], notes: 'Go through each group and make sure the first posts are in.' },
  { title: "Double-check next week's content before it opens", weekdays: [5], notes: 'The new week opens today, so confirm the modules and links are ready.' },
  { title: 'Grade this week’s discussions', weekdays: [0], notes: 'The week ended Saturday, so grade the discussions now.' },
]

/** A small window for adding, editing and removing weekly routines. */
export default function RoutineManager({ routines, projects, onClose }: { routines: Routine[]; projects: Project[]; onClose: () => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(routines.length ? null : 'new')
  const [title, setTitle] = useState('')
  const [days, setDays] = useState<number[]>([])
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const open = (r: Routine | 'new') => {
    setErr(''); setEditing(r === 'new' ? 'new' : r.id)
    setTitle(r === 'new' ? '' : r.title); setDays(r === 'new' ? [] : r.weekdays); setProjectId(r === 'new' ? '' : r.project_id ?? ''); setNotes(r === 'new' ? '' : r.notes)
  }
  useEffect(() => { if (editing === 'new') { setTitle(''); setDays([]); setProjectId(''); setNotes('') } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !days.length) { setErr('Give it a name and pick at least one day.'); return }
    setBusy(true); setErr('')
    try {
      const body = { title: title.trim(), weekdays: days, project_id: projectId || null, notes: notes.trim() }
      if (editing === 'new') await store.addRoutine(body); else if (editing) await store.patchRoutine(editing, body)
      setEditing(null)
    } catch (er) { setErr(friendlyError(er)) }
    setBusy(false)
  }

  async function addExample() {
    setBusy(true)
    try { for (const r of TEACHING_WEEK) await store.addRoutine({ ...r, project_id: null }); setEditing(null); notify.success('Added a teaching-week example. Edit anything to fit.') }
    catch (er) { setErr(friendlyError(er)) }
    setBusy(false)
  }

  return (
    <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal routine-modal" role="dialog" aria-modal="true" aria-label="Weekly routine">
        <div className="modal-head"><h2>Weekly routine</h2><button className="close-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-body">
          <p className="muted small">Things you do on the same days every week, like grading, check-ins or planning. They appear on Today on the right day and reset each week.</p>

          <ul className="routine-list">
            {routines.map(r => (
              <li key={r.id}>
                <div><b>{r.title}</b>
                  <div className="muted small">{dayList(r.weekdays)}{r.project_id && projects.find(p => p.id === r.project_id) ? ` · ${projects.find(p => p.id === r.project_id)!.name}` : ''}</div></div>
                <span className="row">
                  <button className="link small" onClick={() => open(r)}>Edit</button>
                  <button className="link small danger" onClick={() => notify.undoable(`Removed "${r.title}"`, () => store.deleteRoutine(r.id), [r.id])}>Remove</button>
                </span>
              </li>
            ))}
            {!routines.length && editing === null && <li className="muted">No routines yet.</li>}
          </ul>

          {editing ? (
            <form className="routine-form" onSubmit={save}>
              <input autoFocus placeholder="e.g. Check that everyone posted in each group" value={title} onChange={e => setTitle(e.target.value)} />
              <div className="day-chips" role="group" aria-label="Days of the week">
                {DAYS.map(d => (
                  <button type="button" key={d.n} className={days.includes(d.n) ? 'on' : ''} aria-pressed={days.includes(d.n)}
                    onClick={() => setDays(ds => ds.includes(d.n) ? ds.filter(x => x !== d.n) : [...ds, d.n])}>{d.s}</button>
                ))}
              </div>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} aria-label="Related project (optional)">
                <option value="">Not tied to a project</option>
                {projects.filter(p => p.status !== 'done').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input placeholder="A note to yourself (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
              {err && <p className="error small">{err}</p>}
              <div className="row"><button className="primary" disabled={busy}>{editing === 'new' ? 'Add routine' : 'Save'}</button>
                <button type="button" onClick={() => setEditing(null)}>Cancel</button></div>
            </form>
          ) : (
            <div className="row wrap">
              <button className="primary" onClick={() => open('new')}>Add a routine</button>
              {!routines.length && <button onClick={addExample} disabled={busy}>Try a teaching-week example</button>}
            </div>
          )}
          {editing === 'new' && !routines.length && <button className="link small" onClick={addExample} disabled={busy}>Or start from a teaching-week example (Tue, Wed, Fri, Sun)</button>}
        </div>
      </div>
    </div>
  )
}
