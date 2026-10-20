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
  const fieldBox = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // the transform that squeezes the open box back down onto the one-line field it grew from
  const fromField = () => {
    const f = fieldBox.current?.getBoundingClientRect(), m = modalRef.current?.getBoundingClientRect()
    if (!f || !m || !m.width || !m.height) return null
    return `translate(${f.left + f.width / 2 - (m.left + m.width / 2)}px, ${f.top + f.height / 2 - (m.top + m.height / 2)}px) scale(${f.width / m.width}, ${f.height / m.height})`
  }
  // open: the line grows into the box; the contents fade in once it is mostly there
  useLayoutEffect(() => {
    if (!big) return
    const m = modalRef.current, back = backRef.current, from = fromField()
    if (!m || !back || !from || still()) return
    const ease = 'cubic-bezier(.22,1,.36,1)'
    back.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' })
    m.animate([{ transform: from, borderRadius: '28px' }, { transform: 'none', borderRadius: '16px' }], { duration: 440, easing: ease })
    Array.from(m.children).forEach(c => c.animate([{ opacity: 0 }, { opacity: 0, offset: .35 }, { opacity: 1 }], { duration: 440, easing: 'ease-out' }))
  }, [big]) // eslint-disable-line react-hooks/exhaustive-deps
  // close: shrink back into the line, then remove it
  const closeBig = () => {
    const m = modalRef.current, back = backRef.current, to = fromField()
    if (!m || !back || !to || still()) { setBig(false); return }
    back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in', fill: 'forwards' })
    Array.from(m.children).forEach(c => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }))
    m.animate([{ transform: 'none', borderRadius: '16px' }, { transform: to, borderRadius: '28px' }], { duration: 260, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished.then(() => setBig(false), () => setBig(false))
    setTimeout(() => setBig(false), 500) // if the browser is not drawing frames, still close
  }
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
      setText(''); setDate(''); setAt(''); setManual(null); setDateOpen(false); if (!again) closeBig(); onDone(); notify.added()
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
        <div className="addbar-field" ref={fieldBox}>
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
        <div className="modal-back capture-back" ref={backRef} onMouseDown={e => { if (e.target === e.currentTarget) closeBig() }}
          onKeyDown={e => { if (e.key === 'Escape') closeBig(); if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e) }}>
          <div className="modal addbar-big" ref={modalRef} role="dialog" aria-modal="true" aria-label="Add">
            <div className="modal-head"><h2>Add</h2><button type="button" className="close-x" onClick={closeBig} aria-label="Close">×</button></div>
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
