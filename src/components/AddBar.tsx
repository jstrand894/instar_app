import { useLayoutEffect, useRef, useState } from 'react'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { friendlyError } from '../lib/errors'
import { splitWhen } from '../lib/util'
import type { Project } from '../types'

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
  const [mode, setMode] = useState<Mode>('todo')
  const [text, setText] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  // the project you used last, if it still exists, until you pick another
  const remembered = (() => { try { return localStorage.getItem('tm-addbar-project') ?? '' } catch { return '' } })()
  const target = chosen ?? (projects.some(p => p.id === remembered) ? remembered : '')
  const setTarget = (v: string) => { setChosen(v); try { localStorage.setItem('tm-addbar-project', v) } catch { /* ignore */ } }
  const [date, setDate] = useState('')
  const [saved, setSaved] = useState('')
  const [dateOpen, setDateOpen] = useState(false)
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

  const parsed = mode === 'update' ? { title: text.trim(), date: null } : splitWhen(text)
  const when = date || parsed.date || ''
  const needsProject = mode !== 'todo'
  const ready = !!parsed.title && (!needsProject || !!target) && (mode !== 'deadline' || !!when)
  const group = (label: string, list: Project[]) => list.length > 0 && <optgroup label={label}>{list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
  const open = projects.filter(p => p.status !== 'done' && p.stage !== 'accepted')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    try {
      if (mode === 'todo') await store.addTask(target || null, parsed.title, when || null)
      else if (mode === 'deadline') await store.addDeadline(target, parsed.title, when)
      else await store.addUpdate(target, parsed.title)
      setSaved(mode === 'todo' ? '' : mode === 'deadline' ? 'Deadline added' : `Logged to ${projects.find(p => p.id === target)?.name}`)
      setText(''); setDate(''); setDateOpen(false); onDone(); notify.added()
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
        <input placeholder={MODES.find(m => m.id === mode)!.hint} value={text} onChange={e => change(e.target.value)} aria-label="Text" />
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
      {saved && <span className="ok small" role="status">{saved}</span>}
    </form>
  )
}
