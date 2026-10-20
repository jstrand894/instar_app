import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { friendlyError } from '../lib/errors'
import type { Project } from '../types'

type Tab = 'update' | 'note' | 'task' | 'deadline' | 'paper'
const TABS: { id: Tab; label: string }[] = [
  { id: 'update', label: 'Update' }, { id: 'note', label: 'Note' }, { id: 'task', label: 'Task' },
  { id: 'deadline', label: 'Deadline' }, { id: 'paper', label: 'Paper' },
]
const LAST = 'tm-last-project'
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The floating + button and the sheet it opens: add an update, note, task, deadline or paper from anywhere. */
export default function QuickCapture() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('update')
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const field = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const loc = useLocation()
  const onProject = loc.pathname.startsWith('/project/') ? loc.pathname.split('/')[2] : ''
  const reading = loc.pathname.startsWith('/read/')

  const show = (t: Tab = 'update', pid?: string) => {
    setTab(t); setText(''); setErr('')
    const d = new Date(); d.setDate(d.getDate() + 7); setDate(t === 'deadline' ? iso(d) : '')
    setProjectId(pid || onProject || (() => { try { return localStorage.getItem(LAST) ?? '' } catch { return '' } })())
    setOpen(true)
  }

  useEffect(() => {
    const onCapture = (e: Event) => { const d = (e as CustomEvent<{ tab?: Tab; projectId?: string }>).detail; show(d?.tab ?? 'update', d?.projectId) }
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n' && !document.querySelector('.modal-back')) { e.preventDefault(); show() }
    }
    window.addEventListener('tm-capture', onCapture); document.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('tm-capture', onCapture); document.removeEventListener('keydown', onKey) }
  })

  useEffect(() => {
    if (!open) return
    store.projects().then(ps => setProjects(ps.filter(p => p.status !== 'done' && p.stage !== 'accepted'))).catch(() => {})
    setTimeout(() => field.current?.focus(), 30)
  }, [open, tab])

  const groups = useMemo(() => ({
    ms: projects.filter(p => p.type === 'manuscript'),
    work: projects.filter(p => p.type !== 'manuscript' && (p.area ?? 'work') === 'work'),
    home: projects.filter(p => p.type !== 'manuscript' && p.area === 'home'),
  }), [projects])

  const needsProject = tab !== 'paper' && tab !== 'task' // a task can be a general to-do, with no project
  const ready = !!text.trim() && (!needsProject || !!projectId) && (tab !== 'deadline' || !!date)
  const close = () => setOpen(false)

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!ready || busy) return
    setBusy(true); setErr('')
    try {
      const pr = projects.find(p => p.id === projectId)
      let undo: () => Promise<unknown>, what: string
      if (tab === 'update' || tab === 'note') { const r = await store.addUpdate(projectId, text.trim(), tab); undo = () => store.deleteUpdate(r.id); what = tab === 'note' ? 'Note' : 'Update' }
      else if (tab === 'task') { const r = await store.addTask(projectId || null, text.trim(), date || null); undo = () => store.deleteTask(r.id); what = 'Task' }
      else if (tab === 'deadline') { const r = await store.addDeadline(projectId, text.trim(), date); undo = () => store.deleteDeadline(r.id); what = 'Deadline' }
      else {
        const { lookupDoi } = await import('../lib/crossref')
        const m = await lookupDoi(text)
        const existing = (await store.papers()).find(p => p.doi && p.doi.toLowerCase() === m.doi.toLowerCase())
        if (existing) { notify.info(`Already in your library: "${existing.title}"`); setBusy(false); close(); return }
        const r = await store.addPaper(null, { title: m.title || m.doi, authors: m.authors, year: m.year, source: m.source, doi: m.doi })
        undo = () => store.deletePaper(r.id); what = 'Paper'
      }
      if (projectId && tab !== 'paper') { try { localStorage.setItem(LAST, projectId) } catch { /* ignore */ } }
      close(); notify.added()
      notify.action(`${what} added${pr ? ` to ${pr.name}` : ''}`, 'Undo', () => { undo().catch(er => notify.error(er)) })
    } catch (er) { setErr(friendlyError(er)) }
    setBusy(false)
  }

  const opt = (list: Project[]) => list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)

  return (
    <>
      {!reading && !open && (
        <button className="fab" onClick={() => show()} aria-label="Quick add" title="Quick add  (N)">
          <svg width="22" height="22" viewBox="0 0 16 16" aria-hidden><path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" /></svg>
        </button>
      )}
      {open && (
        <div className="modal-back capture-back" onMouseDown={e => { if (e.target === e.currentTarget) close() }}
          onKeyDown={e => { if (e.key === 'Escape') close(); if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save() }}>
          <form className="modal capture" role="dialog" aria-modal="true" aria-label="Quick add" onSubmit={save}>
            <div className="modal-head"><h2>Quick add</h2><button type="button" className="close-x" onClick={close} aria-label="Close">×</button></div>
            <div className="modal-body">
              <div className="seg" role="tablist">
                {TABS.map(t => <button type="button" key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => { setTab(t.id); setErr(''); if (t.id === 'deadline' && !date) { const d = new Date(); d.setDate(d.getDate() + 7); setDate(iso(d)) } }}>{t.label}</button>)}
              </div>
              {tab !== 'paper' && (
                <select value={projectId} onChange={e => setProjectId(e.target.value)} aria-label="Project">
                  <option value="">{tab === 'task' ? 'No project (general to-do)' : 'Which project or manuscript?'}</option>
                  {groups.ms.length > 0 && <optgroup label="Manuscripts">{opt(groups.ms)}</optgroup>}
                  {groups.work.length > 0 && <optgroup label="Work">{opt(groups.work)}</optgroup>}
                  {groups.home.length > 0 && <optgroup label="Home">{opt(groups.home)}</optgroup>}
                </select>
              )}
              {tab === 'update' || tab === 'note' ? (
                <textarea ref={field as React.RefObject<HTMLTextAreaElement>} rows={tab === 'note' ? 5 : 2} value={text} onChange={e => setText(e.target.value)}
                  placeholder={tab === 'note' ? 'Plans, reviewer comments, methods, links…' : 'What did you do or decide?'} />
              ) : (
                <input ref={field as React.RefObject<HTMLInputElement>} value={text} onChange={e => setText(e.target.value)}
                  placeholder={tab === 'task' ? 'What needs doing?' : tab === 'deadline' ? "What's due?" : 'Paste a DOI, e.g. 10.2307/3894934'} />
              )}
              {(tab === 'task' || tab === 'deadline') && (
                <label className="cap-date">{tab === 'task' ? 'Due (optional)' : 'Due date'}<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
              )}
              {err && <p className="error small">{err}</p>}
              <div className="row between">
                <span className="muted small cap-hint"><kbd>⌘</kbd><kbd>↵</kbd> to save</span>
                <button className="primary" disabled={!ready || busy}>{busy ? 'Saving…' : 'Add'}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
