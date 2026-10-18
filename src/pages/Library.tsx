import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../lib/store'
import { parseReadingList } from '../lib/readingList'
import type { Paper, PaperStatus } from '../types'

const STATUS: { id: PaperStatus; label: string }[] = [
  { id: 'to-read', label: 'To read' }, { id: 'reading', label: 'Reading' },
  { id: 'read', label: 'Read' }, { id: 'unavailable', label: 'Unavailable' },
]

export default function Library() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<PaperStatus | 'all'>('all')
  const [category, setCategory] = useState('all')
  const [priority, setPriority] = useState('all')
  const [pdfOnly, setPdfOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const pdfInput = useRef<HTMLInputElement>(null)
  const listInput = useRef<HTMLInputElement>(null)
  const attachFor = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try { setPapers(await store.papers()) } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  async function uploadPdfs(files: FileList | File[]) {
    setBusy(true); setError(''); setNote('')
    try {
      for (const f of Array.from(files)) {
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) continue
        await store.addPaper(f, { title: f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ') })
      }
      await refresh()
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  async function attach(id: string, file: File) {
    setBusy(true); setError('')
    try { await store.attachPdf(id, file); await refresh() } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  async function importList(file: File) {
    setBusy(true); setError(''); setNote('')
    try {
      const items = await parseReadingList(file)
      if (!items.length) { setError('No papers found in that spreadsheet.'); setBusy(false); return }
      if (!confirm(`Import ${items.length} papers from "${file.name}"? Ones already in your library are skipped.`)) { setBusy(false); return }
      const r = await store.importPapers(items)
      setNote(`Imported ${r.added} papers${r.skipped ? `, skipped ${r.skipped} already in your library` : ''}.`)
      await refresh()
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  async function setPaperStatus(p: Paper, s: PaperStatus) {
    setPapers(ps => ps.map(x => x.id === p.id ? { ...x, status: s } : x))
    try { await store.patchPaper(p.id, { status: s }) } catch (e) { setError((e as Error).message) }
  }

  const categories = useMemo(() => [...new Set(papers.map(p => p.category).filter(Boolean))], [papers])
  const priorities = useMemo(() => [...new Set(papers.map(p => p.priority).filter(Boolean))], [papers])

  const needle = q.toLowerCase()
  const list = papers.filter(p =>
    (status === 'all' || p.status === status) &&
    (category === 'all' || p.category === category) &&
    (priority === 'all' || p.priority === priority) &&
    (!pdfOnly || p.file_path) &&
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
        <h1>Papers</h1>
        <div className="row">
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

      {papers.length > 0 && (
        <div className="stats">
          <div><b>{papers.length}</b><span>papers</span></div>
          <div><b>{count('read')}</b><span>read</span></div>
          <div><b>{count('reading')}</b><span>reading</span></div>
          <div><b>{papers.filter(p => p.file_path).length}</b><span>with PDF</span></div>
        </div>
      )}

      <div className="chips">
        <button className={status === 'all' ? 'on' : ''} onClick={() => setStatus('all')}>All</button>
        {STATUS.filter(s => s.id !== 'unavailable' || count('unavailable')).map(s => (
          <button key={s.id} className={status === s.id ? 'on' : ''} onClick={() => setStatus(s.id)}>{s.label}</button>
        ))}
        <label className="check"><input type="checkbox" checked={pdfOnly} onChange={e => setPdfOnly(e.target.checked)} /> Has PDF</label>
      </div>
      <div className="filters">
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
        <input className="search" type="search" placeholder="Search title, author, year, notes" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {error && <p className="error">{error}</p>}
      {note && <p className="ok">{note}</p>}

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
                    if (confirm(`Delete "${p.title}", including its notes and highlights?`)) { await store.deletePaper(p.id); refresh() }
                  }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {!list.length && (
        <div className="empty-box dashed">
          <h2>{papers.length ? 'No matches' : 'Your reading library is empty'}</h2>
          <p className="muted">{papers.length ? 'Try different filters or search.' : 'Import your reading-list spreadsheet, or drop PDFs anywhere on this page.'}</p>
          {!papers.length && <div className="row"><button onClick={() => listInput.current?.click()}>Import reading list</button><button className="primary" onClick={() => pdfInput.current?.click()}>Upload PDF</button></div>}
        </div>
      )}
    </div>
  )
}
