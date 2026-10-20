import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { friendlyError } from '../lib/errors'
import { fromLocalInput, isoDay, toLocalInput } from '../lib/util'
import { parseQuick } from '../lib/quickParse'
import type { Project } from '../types'

type Kind = 'update' | 'note'
type Mode = 'todo' | 'deadline' | 'update'
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'todo', label: 'To-do', hint: 'Add a to-do… e.g. "email reviewer fri"' },
  { id: 'deadline', label: 'Deadline', hint: 'What is due? e.g. "Revision 3/14"' },
  { id: 'update', label: 'Log update', hint: 'What did you do or decide?' },
]
// typing "todo:", "due:" or "log:" at the start switches the mode for you
const PREFIX: [RegExp, Mode][] = [[/^(todo|task|to-do|t):\s*/i, 'todo'], [/^(due|deadline|d):\s*/i, 'deadline'], [/^(log|update|u):\s*/i, 'update']]

/** One box for the three things you add most: a to-do, a deadline, or a log entry. */
export default function AddBar({ projects, onDone, onError }: { projects: Project[]; onDone: () => void; onError: (m: string) => void }) {
  const [picked, setMode] = useState<Mode>('todo')
  const [text, setText] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  // the project you used last, if it still exists, until you pick another
  const remembered = (() => { try { return localStorage.getItem('tm-addbar-project') ?? '' } catch { return '' } })()
  const [manual, setManual] = useState<string | null>(null) // a project you picked yourself beats one read from the text
  const setTarget = (v: string) => { setManual(v); setChosen(v); try { localStorage.setItem('tm-addbar-project', v) } catch { /* ignore */ } }
  const [date, setDate] = useState('')
  const [saved, setSaved] = useState('')
  const [dateOpen, setDateOpen] = useState(false)
  const [big, setBig] = useState(false)
  const [kind, setKind] = useState<Kind>('update')
  const [again, setAgain] = useState(false)
  const [at, setAt] = useState('')
  const open = projects.filter(p => p.status !== 'done' && p.stage !== 'accepted')
  const smart = parseQuick(text, open, picked)
  const mode: Mode = smart.mode ?? picked
  const fromText = manual === null ? smart.projectId : null
  const target = manual ?? fromText ?? chosen ?? (projects.some(p => p.id === remembered) ? remembered : '')
  const bigField = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { if (big) setTimeout(() => bigField.current?.focus(), 30) }, [big])
  const modesRef = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLSpanElement>(null)
  // slide the white bubble under whichever mode is selected
  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const box = modesRef.current, b = bubble.current, on = box?.querySelector<HTMLElement>('button[aria-selected="true"]')
      if (!box || !b || !on) return
      b.style.transition = animate ? '' : 'none'
      b.style.width = `${on.offsetWidth}px`; b.style.transform = `translateX(${on.offsetLeft}px)`
    }
    place(bubble.current?.dataset.ready === '1')
    if (bubble.current) bubble.current.dataset.ready = '1'
    const re = () => place(false)
    window.addEventListener('resize', re)
    return () => window.removeEventListener('resize', re)
  }, [mode])

  function change(v: string) {
    const hit = PREFIX.find(([re]) => re.test(v))
    if (hit) { setMode(hit[1]); v = v.replace(hit[0], '') }
    setText(v)
  }

  const parsed = { title: smart.title, date: smart.date }
  const when = date || parsed.date || (mode === 'todo' ? isoDay(new Date()) : '')
  const needsProject = mode !== 'todo'
  const ready = !!parsed.title && (!needsProject || !!target) && (mode !== 'deadline' || !!when)
  const group = (label: string, list: Project[]) => list.length > 0 && <optgroup label={label}>{list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    try {
      if (mode === 'todo') await store.addTask(target || null, parsed.title, when || null)
      else if (mode === 'deadline') await store.addDeadline(target, parsed.title, when)
      else await store.addUpdate(target, parsed.title, big ? kind : 'update', big ? fromLocalInput(at) : undefined)
      setSaved(mode === 'todo' ? '' : mode === 'deadline' ? 'Deadline added' : `Logged to ${projects.find(p => p.id === target)?.name}`)
      setText(''); setDate(''); setAt(''); setManual(null); setDateOpen(false); if (!again) setBig(false); onDone(); notify.added()
      setTimeout(() => setSaved(''), 3000)
    } catch (er) { onError(friendlyError(er)) }
  }

  return (
    <form className="card addbar" onSubmit={submit}>
      <div className="addbar-row">
      <div className="addbar-modes" role="tablist" aria-label="What to add" ref={modesRef}>
          <span className="addbar-bubble" ref={bubble} aria-hidden />
          {MODES.map(m => <button type="button" role="tab" aria-selected={mode === m.id} key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.label}</button>)}
        </div>
        <div className="addbar-field">
          <input placeholder={MODES.find(m => m.id === mode)!.hint} value={text} onChange={e => change(e.target.value)} aria-label="Text" />
          <button type="button" className="addbar-pop" onClick={() => setBig(true)} aria-label="Pop out into a larger box" title="Pop out into a larger box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
          </button>
        </div>
        <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Project">
          <option value="">{needsProject ? 'For which project…' : 'No project'}</option>
          {group('Manuscripts', open.filter(p => p.type === 'manuscript'))}
          {group('Work', open.filter(p => p.type !== 'manuscript' && (p.area ?? 'work') === 'work'))}
          {group('Home', open.filter(p => p.type !== 'manuscript' && p.area === 'home'))}
        </select>
        {mode !== 'update' && (dateOpen || when || mode === 'deadline'
          ? <input type="date" value={when} autoFocus={dateOpen && !when} onChange={e => setDate(e.target.value)} aria-label="Date" />
          : <button type="button" className="addbar-date" onClick={() => setDateOpen(true)}>+ date</button>)}
        <button className="primary" disabled={!ready}>Add</button>
      </div>
      {(smart.mode || fromText || smart.date) && parsed.title && (
        <p className="addbar-hint small muted" role="status">
          Understood: <b>{MODES.find(m => m.id === mode)!.label}</b>
          {fromText && <> for <b>{smart.projectName}</b></>}
          {smart.date && <> {mode === 'deadline' ? 'due' : 'on'} <b>{new Date(smart.date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</b></>}
          {' · '}“{parsed.title}”
        </p>
      )}
      {saved && <span className="ok small" role="status">{saved}</span>}
      {big && createPortal(
        <div className="modal-back capture-back" onMouseDown={e => { if (e.target === e.currentTarget) setBig(false) }}
          onKeyDown={e => { if (e.key === 'Escape') setBig(false); if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e) }}>
          <div className="modal addbar-big" role="dialog" aria-modal="true" aria-label="Add">
            <div className="modal-head"><h2>Add</h2><button type="button" className="close-x" onClick={() => setBig(false)} aria-label="Close">×</button></div>
            <div className="modal-body">
              <div className="seg" role="tablist">
                {MODES.map(m => <button type="button" role="tab" aria-selected={mode === m.id} key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.label}</button>)}
              </div>
              <textarea ref={bigField} rows={10} value={text} onChange={e => change(e.target.value)} aria-label="Text"
                placeholder={mode === 'update' ? (kind === 'note' ? 'Plans, reviewer comments, methods, links…' : 'What did you do or decide?') : MODES.find(m => m.id === mode)!.hint} />
              <div className="addbar-big-opts">
                <label>Project
                  <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Project">
                    <option value="">{needsProject ? 'For which project…' : 'No project'}</option>
                    {group('Manuscripts', open.filter(p => p.type === 'manuscript'))}
                    {group('Work', open.filter(p => p.type !== 'manuscript' && (p.area ?? 'work') === 'work'))}
                    {group('Home', open.filter(p => p.type !== 'manuscript' && p.area === 'home'))}
                  </select>
                </label>
                {mode !== 'update' && <label>{mode === 'deadline' ? 'Due date' : 'Due (optional)'}<input type="date" value={when} onChange={e => setDate(e.target.value)} /></label>}
                {mode === 'update' && <label>When (blank = now)<input type="datetime-local" value={at} max={toLocalInput(new Date().toISOString())} onChange={e => setAt(e.target.value)} /></label>}
                {mode === 'update' && (
                  <label>Type
                    <select value={kind} onChange={e => setKind(e.target.value as Kind)} aria-label="Type">
                      <option value="update">Update (a quick line in the log)</option><option value="note">Note (longer writing)</option>
                    </select>
                  </label>
                )}
              </div>
              <div className="row between">
                <label className="check addbar-again"><input type="checkbox" checked={again} onChange={e => setAgain(e.target.checked)} />Keep open to add another</label>
                <span className="row">
                  <span className="muted small cap-hint"><kbd>⌘</kbd><kbd>↵</kbd></span>
                  <button type="button" className="primary" disabled={!ready} onClick={submit}>Add</button>
                </span>
              </div>
            </div>
          </div>
        </div>, document.body)}
    </form>
  )
}
