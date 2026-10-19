import Icon from '../components/Icon'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Empty from '../components/Empty'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import { friendlyError } from '../lib/errors'
import { firstSurname, isConfident, lookupDoi, searchByTitle } from '../lib/crossref'
import ReadingDashboard from '../components/ReadingDashboard'
import type { Paper, PaperLink, PaperStatus, Project } from '../types'

const STATUS: { id: PaperStatus; label: string }[] = [
  { id: 'to-read', label: 'To read' }, { id: 'reading', label: 'Reading' },
  { id: 'read', label: 'Read' }, { id: 'unavailable', label: 'Unavailable' },
]

export default function Library() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [links, setLinks] = useState<PaperLink[]>([])
  const [projFilter, setProjFilter] = useState('all')
  const [tag, setTag] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<PaperStatus | 'all'>('all')
  const [category, setCategory] = useState('all')
  const [priority, setPriority] = useState('all')
  const [pdfOnly, setPdfOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [doiOpen, setDoiOpen] = useState(false)
  const [doiText, setDoiText] = useState('')
  const [progress, setProgress] = useState('')
  const cancel = useRef(false)
  const pdfInput = useRef<HTMLInputElement>(null)
  const listInput = useRef<HTMLInputElement>(null)
  const attachFor = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [pp, pr, ls] = await Promise.all([store.papers(), store.projects(), store.projectPapers().catch(() => [] as PaperLink[])])
      setPapers(pp); setProjects(pr); setLinks(ls)
    } catch (e) { setError(friendlyError(e)) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { const t = setTimeout(() => { import('./Reader') }, 1500); return () => clearTimeout(t) }, [])
  useEffect(() => { window.addEventListener('tm-data', refresh); return () => window.removeEventListener('tm-data', refresh) }, [refresh])

  async function uploadPdfs(files: FileList | File[]) {
    setBusy(true); setError(''); setNote('')
    try {
      for (const f of Array.from(files)) {
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) continue
        await store.addPaper(f, { title: f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ') })
      }
      await refresh()
    } catch (e) { setError(friendlyError(e)) }
    setBusy(false)
  }

  async function attach(id: string, file: File) {
    setBusy(true); setError('')
    try { await store.attachPdf(id, file); await refresh() } catch (e) { setError(friendlyError(e)) }
    setBusy(false)
  }

  async function importList(file: File) {
    setBusy(true); setError(''); setNote('')
    try {
      const { parseReadingList } = await import('../lib/readingList') // only loaded when you import a list
      const items = await parseReadingList(file)
      if (!items.length) { setError('No papers found in that spreadsheet.'); setBusy(false); return }
      if (!confirm(`Import ${items.length} papers from "${file.name}"? Ones already in your library are skipped.`)) { setBusy(false); return }
      const r = await store.importPapers(items)
      setNote(`Imported ${r.added} papers${r.skipped ? `, skipped ${r.skipped} already in your library` : ''}.`)
      await refresh()
    } catch (e) { setError(friendlyError(e)) }
    setBusy(false)
  }

  async function addByDoi(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNote('')
    try {
      const m = await lookupDoi(doiText)
      const dup = papers.find(p => p.doi && p.doi.toLowerCase() === m.doi.toLowerCase())
      if (dup) setNote(`Already in your library: "${dup.title}"`)
      else {
        await store.addPaper(null, { title: m.title || m.doi, authors: m.authors, year: m.year, source: m.source, doi: m.doi })
        setNote(`Added "${m.title}". Attach the PDF from its card when you have it.`); setDoiText(''); setDoiOpen(false); await refresh()
      }
    } catch (er) { setError(friendlyError(er)) }
    setBusy(false)
  }

  async function findMissingDois() {
    const todo = papers.filter(p => !p.doi && p.title)
    if (!todo.length) return
    if (!confirm(`Look up ${todo.length} papers on Crossref? Confident matches get their DOI (and any blank author, year or journal) filled in; anything uncertain is left alone.`)) return
    cancel.current = false; setBusy(true); setError(''); setNote('')
    let found = 0, unsure = 0, failed = 0
    for (let i = 0; i < todo.length && !cancel.current; i++) {
      const p = todo[i]; setProgress(`Checking ${i + 1} of ${todo.length}…`)
      try {
        const cands = await searchByTitle(p.title, firstSurname(p.authors))
        const best = cands.find(c => isConfident(c, p))
        if (best) {
          const patch: Partial<Paper> = { doi: best.doi }
          if (!p.authors && best.authors) patch.authors = best.authors
          if (!p.year && best.year) patch.year = best.year
          if (!p.source && best.source) patch.source = best.source
          await store.patchPaper(p.id, patch); found++
        } else unsure++
      } catch { failed++ }
      await new Promise(r => setTimeout(r, 400))
    }
    setProgress(''); setBusy(false); await refresh()
    setNote(`Found ${found} DOIs${unsure ? `; ${unsure} had no confident match (books, old papers, or different titles), so check those by hand` : ''}${failed ? `; ${failed} could not be checked because Crossref was busy, so run it again` : ''}${cancel.current ? ' (stopped early)' : ''}.`)
  }

  async function setPaperStatus(p: Paper, s: PaperStatus) {
    setPapers(ps => ps.map(x => x.id === p.id ? { ...x, status: s } : x))
    try { await store.patchPaper(p.id, { status: s }) } catch (e) { setError(friendlyError(e)) }
  }

  const categories = useMemo(() => [...new Set(papers.map(p => p.category).filter(Boolean))], [papers])
  const priorities = useMemo(() => [...new Set(papers.map(p => p.priority).filter(Boolean))], [papers])

  const allTags = [...new Set(papers.flatMap(p => p.tags ?? []))].sort()
  const needle = q.toLowerCase()
  const list = papers.filter(p =>
    (status === 'all' || p.status === status) &&
    (category === 'all' || p.category === category) &&
    (priority === 'all' || p.priority === priority) &&
    (!pdfOnly || p.file_path) &&
    (projFilter === 'all' || links.some(l => l.paper_id === p.id && l.project_id === projFilter)) &&
    (!tag || (p.tags ?? []).includes(tag)) &&
    (!needle || `${p.title} ${p.authors} ${p.year} ${p.source} ${p.why} ${p.category}`.toLowerCase().includes(needle)))

  const groups = useMemo(() => {
    const m = new Map<string, Paper[]>()
    for (const p of list) (m.get(p.category || 'Uncategorized') ?? m.set(p.category || 'Uncategorized', []).get(p.category || 'Uncategorized')!).push(p)
    const order = (c: string) => (c === 'Uncategorized' ? 1e9 : categories.indexOf(c))
    return [...m.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([name, ps]) => ({
      name,
      papers: ps.sort((a, b) => (a.priority === 'Core' ? 0 : 1) - (b.priority === 'Core' ? 0 : 1) || Number(a.year) - Number(b.year)),
    }))
  }, [list, categories])

  const count = (s: PaperStatus | 'all') => (s === 'all' ? papers : papers.filter(p => p.status === s)).length

  return (
    <div className={`page ${drag ? 'dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={e => { if (e.currentTarget === e.target) setDrag(false) }}
      onDrop={e => { e.preventDefault(); setDrag(false); uploadPdfs(e.dataTransfer.files) }}>
      <header className="page-head">
        <h1>Reading</h1>
        <div className="row">
          <button disabled={busy} onClick={() => setDoiOpen(!doiOpen)} className="with-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="wand"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5" /></svg>Add by DOI</button>
          <button disabled={busy} onClick={() => listInput.current?.click()}>Import reading list</button>
          <button className="primary" disabled={busy} onClick={() => { attachFor.current = null; pdfInput.current?.click() }}>{busy ? 'Working…' : 'Upload PDF'}</button>
        </div>
        <input ref={pdfInput} type="file" accept="application/pdf" multiple hidden onChange={e => {
          const f = e.target.files; if (!f?.length) return
          if (attachFor.current) attach(attachFor.current, f[0]); else uploadPdfs(f)
          e.target.value = ''
        }} />
        <input ref={listInput} type="file" accept=".xlsx" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importList(f); e.target.value = '' }} />
      </header>

      {doiOpen && (
        <form className="card doi-form" onSubmit={addByDoi}>
          <input autoFocus placeholder="Paste a DOI, e.g. 10.2307/3894934 or https://doi.org/…" value={doiText} onChange={e => setDoiText(e.target.value)} />
          <button className="primary" disabled={busy || !doiText.trim()}>Look up and add</button>
        </form>
      )}

      <ReadingDashboard papers={papers} projects={projects} links={links} onChange={refresh} />

      <div className="chips">
        <button className={status === 'all' ? 'on' : ''} onClick={() => setStatus('all')}>All</button>
        {STATUS.filter(s => s.id !== 'unavailable' || count('unavailable')).map(s => (
          <button key={s.id} className={status === s.id ? 'on' : ''} onClick={() => setStatus(s.id)}>{s.label}</button>
        ))}
        <label className="check"><input type="checkbox" checked={pdfOnly} onChange={e => setPdfOnly(e.target.checked)} /> Has PDF</label>
      </div>
      <div className="filters">
        {allTags.length > 0 && (
          <select value={tag} onChange={e => setTag(e.target.value)} aria-label="Filter by tag">
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
        )}
        {categories.length > 0 && (
          <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
            <option value="all">All categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        )}
        {priorities.length > 0 && (
          <select value={priority} onChange={e => setPriority(e.target.value)} aria-label="Priority">
            <option value="all">All priorities</option>
            {priorities.map(c => <option key={c}>{c}</option>)}
          </select>
        )}
        {links.length > 0 && (
          <select value={projFilter} onChange={e => setProjFilter(e.target.value)} aria-label="Project">
            <option value="all">All projects</option>
            {projects.filter(pr => links.some(l => l.project_id === pr.id)).map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
          </select>
        )}
        <input className="search" type="search" placeholder="Search title, author, year, notes" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {error && <p className="error">{error}</p>}
      {note && <p className="ok">{note}</p>}
      {papers.some(p => !p.doi) && (
        <div className="row small-row">
          {progress
            ? <><span className="muted small">{progress}</span><button className="link small" onClick={() => { cancel.current = true }}>Stop</button></>
            : <button className="link small" disabled={busy} onClick={findMissingDois}>Find missing DOIs ({papers.filter(p => !p.doi).length})</button>}
        </div>
      )}

      {groups.map(g => (
        <section key={g.name} className="group">
          <h2 className="group-title">{g.name} <span className="muted small">{g.papers.length}</span></h2>
          <div className="list">
            {g.papers.map(p => (
              <div className="card paper2" key={p.id}>
                <div className="paper-top">
                  <Link to={`/read/${p.id}`} className="paper-title">{p.title}</Link>
                  <select className={`status st-${p.status}`} value={p.status} onChange={e => setPaperStatus(p, e.target.value as PaperStatus)} aria-label="Status">
                    {STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div className="muted small">{[p.authors, p.year, p.source].filter(Boolean).join(' · ')}</div>
                {p.why && <div className="why">{p.why}</div>}
                {(p.tags?.length ?? 0) > 0 && <div className="card-tags">{p.tags!.map(t => <a key={t} href="#search" onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('tm-search', { detail: '#' + t })) }}>#{t}</a>)}</div>}
                {links.some(l => l.paper_id === p.id) && (
                  <div className="paper-foot">
                    {links.filter(l => l.paper_id === p.id).map(l => projects.find(pr => pr.id === l.project_id)).filter((x): x is Project => !!x).map(pr => (
                      <Link key={pr.id} to={`/project/${pr.id}`} className="pill proj-tag">{pr.type === 'manuscript' && <Icon name="file" size={12} />} {pr.name}</Link>
                    ))}
                  </div>
                )}
                <div className="paper-foot">
                  {p.priority && <span className={`pill pr-${p.priority.toLowerCase()}`}>{p.priority}</span>}
                  {p.file_path
                    ? <Link to={`/read/${p.id}`} className="pill has-pdf">PDF</Link>
                    : <button className="link small" onClick={() => { attachFor.current = p.id; pdfInput.current?.click() }}>Attach PDF</button>}
                  {p.doi
                    ? <a className="link small" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">DOI</a>
                    : <a className="link small" href={`https://scholar.google.com/scholar?q=${encodeURIComponent(p.title)}`} target="_blank" rel="noreferrer">Find online</a>}
                  <span className="spacer" />
                  <button className="link small danger" onClick={async () => {
                    notify.undoable(`Deleted "${p.title}"`, () => store.deletePaper(p.id), [p.id])
                  }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {!list.length && (
        <Empty icon="book" dashed title={papers.length ? 'No matches' : 'Your reading library is empty'}
          actions={!papers.length && <><button onClick={() => listInput.current?.click()}>Import reading list</button><button onClick={() => setDoiOpen(true)}>Add by DOI</button><button className="primary" onClick={() => pdfInput.current?.click()}>Upload PDF</button></>}>
          {papers.length ? 'Try different filters or search.' : 'Bring in your Excel reading list, paste a DOI, or drop PDFs anywhere on this page. Highlights, notes and Apple Pencil ink live right in the reader.'}
        </Empty>
      )}
    </div>
  )
}
