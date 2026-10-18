import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { store } from '../lib/store'
import { getPrefs, setPrefs } from '../lib/prefs'
import type { Deadline, Highlight, Paper, Project, ProjectTask, ProjectUpdate } from '../types'

type Kind = 'Actions' | 'Projects' | 'Manuscripts' | 'Papers' | 'Tasks' | 'Notes and updates' | 'Deadlines' | 'Highlights'
interface Item { id: string; kind: Kind; title: string; sub: string; hay: string; run: () => void; weight: number }

const ORDER: Kind[] = ['Actions', 'Projects', 'Manuscripts', 'Papers', 'Tasks', 'Deadlines', 'Notes and updates', 'Highlights']
const ICON: Record<Kind, string> = { Actions: '⚡', Projects: '▣', Manuscripts: '✎', Papers: '☰', Tasks: '☑', 'Notes and updates': '✎', Deadlines: '⏰', Highlights: '❝' }
const snip = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + '…' : s).replace(/\s+/g, ' ')

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [data, setData] = useState<{ projects: Project[]; updates: ProjectUpdate[]; papers: Paper[]; tasks: ProjectTask[]; deadlines: Deadline[]; highlights: Highlight[] } | null>(null)
  const nav = useNavigate()
  const loc = useLocation()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<Element | null>(null)

  const close = useCallback(() => { setOpen(false); setQ(''); setSel(0); (returnFocus.current as HTMLElement | null)?.focus?.() }, [])
  const show = useCallback((query = '') => { returnFocus.current = document.activeElement; setQ(query); setSel(0); setOpen(true) }, [])

  // open with ⌘K / Ctrl+K, or "/" when you are not typing somewhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open ? close() : show(); return }
      const el = e.target as HTMLElement
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === '/' && !open) { e.preventDefault(); show() }
    }
    const onOpen = (e: Event) => show((e as CustomEvent<string>).detail ?? '')
    document.addEventListener('keydown', onKey); window.addEventListener('tm-search', onOpen)
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('tm-search', onOpen) }
  }, [open, close, show])

  // fresh data each time it opens
  useEffect(() => {
    if (!open) return
    let dead = false
    Promise.all([
      store.projects(), store.updates(), store.papers(),
      store.tasks().catch(() => [] as ProjectTask[]), store.deadlines().catch(() => [] as Deadline[]), store.allHighlights().catch(() => [] as Highlight[]),
    ]).then(([projects, updates, papers, tasks, deadlines, highlights]) => { if (!dead) setData({ projects, updates, papers, tasks, deadlines, highlights }) }).catch(() => {})
    setTimeout(() => input.current?.focus(), 10)
    return () => { dead = true }
  }, [open])

  const go = useCallback((path: string) => () => { nav(path); close() }, [nav, close])

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    const pid = loc.pathname.startsWith('/project/') ? loc.pathname.split('/')[2] : undefined
    const act = (id: string, title: string, sub: string, run: () => void) => out.push({ id: 'a:' + id, kind: 'Actions', title, sub, hay: `${title} ${sub}`.toLowerCase(), run, weight: 0 })
    const capture = (tab: string) => () => { close(); setTimeout(() => window.dispatchEvent(new CustomEvent('tm-capture', { detail: { tab, projectId: pid } })), 30) }
    act('today', 'Go to Today', 'Your day at a glance', go('/')); act('projects', 'Go to Projects', '', go('/projects'))
    act('ms', 'Go to Manuscripts', '', go('/manuscripts')); act('reading', 'Go to Reading', 'Papers and reading stats', go('/library'))
    act('upd', 'New update', 'Log what you did', capture('update')); act('note', 'New note', 'Write a longer note', capture('note'))
    act('task', 'New task', 'Add a to-do to a project', capture('task')); act('dl', 'New deadline', 'Something due on a date', capture('deadline'))
    act('doi', 'Add paper by DOI', 'Look it up and add it', capture('paper'))
    act('theme', 'Toggle dark mode', 'Switch between light and dark', () => { const p = getPrefs(); setPrefs({ theme: p.theme === 'dark' ? 'light' : 'dark' }); close() })
    act('acct', 'Open Account', 'Appearance, name, timer, sign out', () => { close(); setTimeout(() => window.dispatchEvent(new Event('tm-open-account')), 30) })
    act('tour', 'Replay the welcome tour', '', () => { close(); setTimeout(() => window.dispatchEvent(new Event('tm-tour')), 30) })
    if (!data) return out
    const byProject = new Map(data.projects.map(p => [p.id, p]))
    const byPaper = new Map(data.papers.map(p => [p.id, p]))
    for (const p of data.projects) out.push({ id: 'p:' + p.id, kind: p.type === 'manuscript' ? 'Manuscripts' : 'Projects', title: p.name,
      sub: [p.type === 'manuscript' ? 'Manuscript' : p.type, p.status, p.journal].filter(Boolean).join(' · '),
      hay: `${p.name} ${p.description} ${p.journal ?? ''} ${p.coauthors ?? ''} ${(p.tags ?? []).map(t => '#' + t).join(' ')}`.toLowerCase(), run: go('/project/' + p.id), weight: 3 })
    for (const p of data.papers) out.push({ id: 'r:' + p.id, kind: 'Papers', title: p.title, sub: [p.authors, p.year].filter(Boolean).join(' · '),
      hay: `${p.title} ${p.authors} ${p.year} ${p.source} ${p.why} ${p.category} ${p.doi} ${p.notes} ${(p.tags ?? []).map(t => '#' + t).join(' ')}`.toLowerCase(), run: go('/read/' + p.id), weight: 2 })
    for (const t of data.tasks) { const pr = byProject.get(t.project_id); if (pr) out.push({ id: 't:' + t.id, kind: 'Tasks', title: t.title, sub: `${pr.name}${t.done ? ' · done' : t.due_on ? ' · due ' + t.due_on : ''}`, hay: `${t.title} ${pr.name}`.toLowerCase(), run: go('/project/' + pr.id), weight: 2 }) }
    for (const d of data.deadlines) { const pr = byProject.get(d.project_id); if (pr) out.push({ id: 'd:' + d.id, kind: 'Deadlines', title: d.title, sub: `${pr.name} · due ${d.due_on}`, hay: `${d.title} ${pr.name}`.toLowerCase(), run: go('/project/' + pr.id), weight: 2 }) }
    for (const u of data.updates) { const pr = byProject.get(u.project_id); if (pr) out.push({ id: 'u:' + u.id, kind: 'Notes and updates', title: snip(u.body), sub: `${pr.name} · ${new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, hay: `${u.body} ${pr.name}`.toLowerCase(), run: go('/project/' + pr.id), weight: 1 }) }
    for (const h of data.highlights) { const pa = byPaper.get(h.paper_id); if (pa) out.push({ id: 'h:' + h.id, kind: 'Highlights', title: '“' + snip(h.text) + '”', sub: `${pa.title} · page ${h.page}${h.note ? ' · ' + snip(h.note, 40) : ''}`, hay: `${h.text} ${h.note} ${pa.title}`.toLowerCase(), run: go('/read/' + pa.id), weight: 1 }) }
    return out
  }, [data, loc.pathname, go, close])

  const results = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
    let found: Item[]
    if (!tokens.length) {
      found = items.filter(i => i.kind === 'Actions').slice(0, 9)
      const recentProjects = items.filter(i => i.kind === 'Projects' || i.kind === 'Manuscripts').slice(0, 5)
      found = [...found, ...recentProjects]
    } else {
      found = items.map(i => {
        let score = 0
        for (const t of tokens) {
          if (!i.hay.includes(t)) return null
          const title = i.title.toLowerCase()
          score += title.startsWith(t) ? 6 : title.includes(t) ? 4 : 1
        }
        return { i, score: score + i.weight }
      }).filter((x): x is { i: Item; score: number } => !!x).sort((a, b) => b.score - a.score).map(x => x.i).slice(0, 40)
    }
    const grouped = ORDER.flatMap(k => found.filter(i => i.kind === k))
    return grouped
  }, [items, q])

  useEffect(() => { setSel(0) }, [q])
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [sel, results])

  if (!open) return null

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); results[sel]?.run() }
  }
  const mark = (text: string) => {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean)[0]
    const i = t ? text.toLowerCase().indexOf(t) : -1
    return i < 0 ? text : <>{text.slice(0, i)}<mark>{text.slice(i, i + t.length)}</mark>{text.slice(i + t.length)}</>
  }

  let lastKind: Kind | null = null
  return (
    <div className="modal-back palette-back" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKey}>
        <div className="palette-input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects, papers, notes, tasks…  or type a command" aria-label="Search" autoComplete="off" spellCheck={false} />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={list} role="listbox">
          {results.map((r, idx) => {
            const head = r.kind !== lastKind ? r.kind : null; lastKind = r.kind
            return (
              <div key={r.id}>
                {head && <div className="palette-head">{head}</div>}
                <div role="option" aria-selected={idx === sel} className={`palette-row ${idx === sel ? 'sel' : ''}`} onMouseMove={() => setSel(idx)} onClick={() => r.run()}>
                  <span className="p-ico" aria-hidden>{ICON[r.kind]}</span>
                  <span className="p-text"><span className="p-title">{mark(r.title)}</span>{r.sub && <span className="p-sub">{r.sub}</span>}</span>
                </div>
              </div>
            )
          })}
          {!results.length && <div className="palette-none">{data ? `Nothing matches “${q}”.` : 'Loading…'}</div>}
        </div>
        <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>/</kbd> or <kbd>⌘K</kbd> search anywhere</span></div>
      </div>
    </div>
  )
}
