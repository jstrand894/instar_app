import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'
import PageView, { HL_COLORS, type Tool } from '../components/PageView'
import { store } from '../lib/store'
import { cleanDoi, firstSurname, lookupDoi, searchByTitle, type Candidate } from '../lib/crossref'
import type { Highlight, HighlightColor, Paper, PaperLink, PaperStatus, Project, Rect, Stroke } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const INK_COLORS = ['#1b1b1f', '#d32f2f', '#1565c0', '#2e7d32']

interface Pending { page: number; rects: Rect[]; text: string }

export default function Reader() {
  const { id } = useParams()
  const [paper, setPaper] = useState<Paper | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [links, setLinks] = useState<PaperLink[]>([])
  const [ink, setInk] = useState<Record<number, Stroke[]>>({})
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [avail, setAvail] = useState(800)
  const [tool, setTool] = useState<Tool>('none')
  const [penColor, setPenColor] = useState(INK_COLORS[0])
  const [pending, setPending] = useState<Pending | null>(null)
  const [panel, setPanel] = useState(() => window.innerWidth > 900)
  const [tab, setTab] = useState<'highlights' | 'notes'>('highlights')
  const scroller = useRef<HTMLDivElement>(null)
  const attachInput = useRef<HTMLInputElement>(null)
  const undoStack = useRef<number[]>([])
  const holding = useRef(false)
  const inkTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  // load paper, file, annotations
  useEffect(() => {
    if (!id) return
    let dead = false
    ;(async () => {
      try {
        const papers = await store.papers()
        const p = papers.find(x => x.id === id)
        if (!p) { setError('Paper not found.'); return }
        setPaper(p)
        Promise.all([store.projects(), store.projectPapers().catch(() => [] as PaperLink[])]).then(([pr, ls]) => { if (!dead) { setProjects(pr); setLinks(ls.filter(l => l.paper_id === id)) } })
        const [url, hl, inkRows] = await Promise.all([store.fileUrl(p.file_path), store.highlights(id), store.ink(id)])
        if (!p.file_path) { setHighlights(hl); setTab('notes'); return }
        if (!url) { setError('PDF file is not available on this device. (Demo mode only keeps uploads until you reload; add Supabase keys to keep them.)'); setHighlights(hl); return }
        const d = await pdfjs.getDocument({ url }).promise
        const pages = await Promise.all(Array.from({ length: d.numPages }, (_, i) => d.getPage(i + 1).then(pg => {
          const v = pg.getViewport({ scale: 1 }); return { w: v.width, h: v.height }
        })))
        if (dead) return
        setDoc(d); setSizes(pages); setHighlights(hl)
        setInk(Object.fromEntries(inkRows.map(r => [r.page, r.strokes])))
      } catch (e) { setError((e as Error).message) }
    })()
    return () => { dead = true }
  }, [id])

  // fit-to-width
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setAvail(el.clientWidth))
    ro.observe(el); setAvail(el.clientWidth)
    return () => ro.disconnect()
  }, [doc])

  const baseWidth = sizes[0]?.w ?? 612
  const scale = Math.min(Math.max((avail - 24) / baseWidth, 0.3), 2) * zoom

  // text selection -> pending highlight
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const onSel = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || !sel.rangeCount) { if (!holding.current) setPending(null); return }
        const range = sel.getRangeAt(0)
        const node = range.commonAncestorContainer
        const el = (node.nodeType === 1 ? node as Element : node.parentElement)?.closest('.pdfPage') as HTMLElement | null
        if (!el) { setPending(null); return }
        const pr = el.getBoundingClientRect()
        const rects = Array.from(range.getClientRects())
          .filter(r => r.width > 2 && r.height > 2 && r.height < pr.height * 0.08)
          .filter((r, _i, all) => !all.some(o => o !== r && o.left <= r.left + 0.5 && o.right >= r.right - 0.5 && o.top <= r.top + 0.5 && o.bottom >= r.bottom - 0.5 && (o.width > r.width || o.height > r.height)))
          .map(r => ({ x: (r.left - pr.left) / pr.width, y: (r.top - pr.top) / pr.height, w: r.width / pr.width, h: r.height / pr.height }))
        if (!rects.length) { setPending(null); return }
        setPending({ page: Number(el.dataset.page), rects, text: sel.toString().replace(/\s+/g, ' ').trim() })
      }, 250)
    }
    document.addEventListener('selectionchange', onSel)
    return () => { document.removeEventListener('selectionchange', onSel); clearTimeout(t) }
  }, [])

  async function commitHighlight(color: HighlightColor) {
    if (!pending || !id) return
    holding.current = false
    const row = await store.addHighlight({ paper_id: id, page: pending.page, rects: pending.rects, text: pending.text, color, note: '' })
    setHighlights(h => [...h, row])
    window.getSelection()?.removeAllRanges(); setPending(null)
    setPanel(true); setTab('highlights')
  }

  const onStrokes = useCallback((page: number, strokes: Stroke[]) => {
    setInk(prev => ({ ...prev, [page]: strokes }))
    undoStack.current.push(page)
    clearTimeout(inkTimers.current[page])
    inkTimers.current[page] = setTimeout(() => { if (id) store.saveInk(id, page, strokes) }, 600)
  }, [id])

  function undo() {
    const page = undoStack.current.pop()
    if (page === undefined) return
    setInk(prev => {
      const next = (prev[page] ?? []).slice(0, -1)
      clearTimeout(inkTimers.current[page])
      inkTimers.current[page] = setTimeout(() => { if (id) store.saveInk(id, page, next) }, 600)
      return { ...prev, [page]: next }
    })
  }

  async function patchPaper(patch: Partial<Paper>) {
    if (!paper) return
    setPaper({ ...paper, ...patch }); await store.patchPaper(paper.id, patch)
  }
  async function linkProject(pid: string) {
    if (!paper || !pid) return
    setLinks(ls => [...ls, { project_id: pid, paper_id: paper.id, created_at: new Date().toISOString() }])
    try { await store.linkPaper(pid, paper.id) } catch (e) { setError((e as Error).message) }
  }
  async function unlinkProject(pid: string) {
    if (!paper) return
    setLinks(ls => ls.filter(l => l.project_id !== pid))
    try { await store.unlinkPaper(pid, paper.id) } catch (e) { setError((e as Error).message) }
  }
  async function attachPdf(file: File) {
    if (!paper) return
    try { await store.attachPdf(paper.id, file); window.location.reload() } catch (e) { setError((e as Error).message) }
  }
  async function patchHL(hid: string, patch: Partial<Highlight>) {
    setHighlights(hs => hs.map(h => h.id === hid ? { ...h, ...patch } : h)); await store.patchHighlight(hid, patch)
  }
  async function delHL(hid: string) {
    setHighlights(hs => hs.filter(h => h.id !== hid)); await store.deleteHighlight(hid)
  }
  function jump(h: Highlight) {
    document.getElementById(`hl-${h.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    if (window.innerWidth <= 900) setPanel(false)
  }

  const sortedHL = useMemo(() => [...highlights].sort((a, b) => a.page - b.page || a.rects[0].y - b.rects[0].y), [highlights])

  return (
    <div className="reader">
      <div className="reader-bar">
        <Link to="/library" className="back">‹ Papers</Link>
        <span className="reader-title">{paper?.title ?? ''}</span>
        <div className="tools">
          <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.15).toFixed(2)))} aria-label="Zoom out">−</button>
          <button onClick={() => setZoom(z => Math.min(2.5, +(z + 0.15).toFixed(2)))} aria-label="Zoom in">+</button>
          <span className="sep" />
          <button className={tool === 'pen' ? 'on' : ''} onClick={() => setTool(tool === 'pen' ? 'none' : 'pen')}>Pen</button>
          <button className={tool === 'eraser' ? 'on' : ''} onClick={() => setTool(tool === 'eraser' ? 'none' : 'eraser')}>Erase</button>
          {tool !== 'none' && <>
            {INK_COLORS.map(c => (
              <button key={c} className={`dot ${c === penColor ? 'on' : ''}`} style={{ background: c }} onClick={() => { setPenColor(c); setTool('pen') }} aria-label={`Ink ${c}`} />
            ))}
            <button onClick={undo}>Undo</button>
          </>}
          <span className="sep" />
          <button className={panel ? 'on' : ''} onClick={() => setPanel(!panel)}>Notes</button>
        </div>
      </div>

      <div className="reader-body">
        <div className="reader-scroll" ref={scroller}>
          {error && <p className="error pad">{error}</p>}
          {paper && !paper.file_path && (
            <div className="no-pdf">
              <h2>No PDF attached yet</h2>
              <p className="muted">You can still keep notes on this paper. Attach the PDF when you find it to read and highlight here.</p>
              <div className="row">
                <button className="primary" onClick={() => attachInput.current?.click()}>Attach PDF</button>
                <a className="link" target="_blank" rel="noreferrer"
                  href={paper.doi ? `https://doi.org/${paper.doi}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`}>
                  {paper.doi ? 'Open DOI' : 'Find online'}
                </a>
              </div>
              <input ref={attachInput} type="file" accept="application/pdf" hidden onChange={e => { const f = e.target.files?.[0]; if (f) attachPdf(f) }} />
            </div>
          )}
          {!doc && !error && paper?.file_path && <p className="muted pad">Loading…</p>}
          {doc && sizes.map((size, i) => (
            <PageView key={i} doc={doc} num={i + 1} size={size} scale={scale}
              highlights={highlights.filter(h => h.page === i + 1)}
              strokes={ink[i + 1] ?? []} tool={tool} penColor={penColor}
              scroller={scroller} onStrokes={onStrokes} />
          ))}
        </div>

        {panel && (
          <aside className="reader-side">
            <div className="tabs">
              <button className={tab === 'highlights' ? 'on' : ''} onClick={() => setTab('highlights')}>Highlights ({highlights.length})</button>
              <button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>Notes</button>
              <button className="close" onClick={() => setPanel(false)} aria-label="Close panel">×</button>
            </div>
            {tab === 'highlights' ? (
              <div className="side-scroll">
                {!sortedHL.length && <p className="muted pad">Select text in the PDF, then choose a color to highlight it.</p>}
                {sortedHL.map(h => (
                  <div className="hl-item" key={h.id} style={{ borderLeftColor: HL_COLORS[h.color] }}>
                    <button className="hl-text" onClick={() => jump(h)}>“{h.text}”</button>
                    <div className="muted small">Page {h.page}</div>
                    <textarea placeholder="Add a note…" defaultValue={h.note} onBlur={e => e.target.value !== h.note && patchHL(h.id, { note: e.target.value })} />
                    <div className="row">
                      {(Object.keys(HL_COLORS) as HighlightColor[]).map(c => (
                        <button key={c} className={`dot ${c === h.color ? 'on' : ''}`} style={{ background: HL_COLORS[c] }} onClick={() => patchHL(h.id, { color: c })} aria-label={c} />
                      ))}
                      <button className="link small danger" onClick={() => delHL(h.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : paper && (
              <div className="side-scroll pad">
                <label>Title<input key={'t' + paper.title} defaultValue={paper.title} onBlur={e => patchPaper({ title: e.target.value })} /></label>
                <label>Authors<input key={'a' + paper.authors} defaultValue={paper.authors} onBlur={e => patchPaper({ authors: e.target.value })} /></label>
                <label>Year<input key={'y' + paper.year} defaultValue={paper.year} onBlur={e => patchPaper({ year: e.target.value })} /></label>
                <label>Status
                  <select value={paper.status} onChange={e => patchPaper({ status: e.target.value as PaperStatus })}>
                    <option value="to-read">To read</option><option value="reading">Reading</option><option value="read">Read</option><option value="unavailable">Unavailable</option>
                  </select>
                </label>
                <label>Category<input defaultValue={paper.category} onBlur={e => patchPaper({ category: e.target.value })} /></label>
                <label>Priority<input defaultValue={paper.priority} placeholder="Core / Recommended" onBlur={e => patchPaper({ priority: e.target.value })} /></label>
                <label>Source<input key={'s' + paper.source} defaultValue={paper.source} onBlur={e => patchPaper({ source: e.target.value })} /></label>
                <label>DOI<input key={'d' + paper.doi} defaultValue={paper.doi} onBlur={e => patchPaper({ doi: e.target.value.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') })} /></label>
                <div className="linked-projects">
                  <span className="muted small">Projects</span>
                  <div className="row wrap">
                    {links.map(l => projects.find(pr => pr.id === l.project_id)).filter((x): x is Project => !!x).map(pr => (
                      <span className="pill proj-chip" key={pr.id}><Link to={`/project/${pr.id}`}>{pr.name}</Link><button aria-label={`Unlink ${pr.name}`} onClick={() => unlinkProject(pr.id)}>×</button></span>
                    ))}
                    {!links.length && <span className="muted small">Not linked to any project</span>}
                  </div>
                  <select value="" onChange={e => linkProject(e.target.value)} aria-label="Link to project">
                    <option value="">Link to a project…</option>
                    {[...projects].filter(pr => !links.some(l => l.project_id === pr.id)).sort((a, b) => Number(b.type === 'manuscript') - Number(a.type === 'manuscript') || a.name.localeCompare(b.name))
                      .map(pr => <option key={pr.id} value={pr.id}>{pr.type === 'manuscript' ? '📄 ' : ''}{pr.name}</option>)}
                  </select>
                </div>
                <DoiTools paper={paper} onApply={patchPaper} />
                <label>Why it matters<textarea defaultValue={paper.why} onBlur={e => patchPaper({ why: e.target.value })} /></label>
                <label>Notes
                  <textarea className="big" placeholder="Summary, questions, ideas…" defaultValue={paper.notes} onBlur={e => e.target.value !== paper.notes && patchPaper({ notes: e.target.value })} />
                </label>
              </div>
            )}
          </aside>
        )}
      </div>

      {pending && (
        <div className="hl-toolbar" onPointerDown={() => { holding.current = true; setTimeout(() => { holding.current = false }, 1500) }}>
          <span className="small">Highlight</span>
          {(Object.keys(HL_COLORS) as HighlightColor[]).map(c => (
            <button key={c} className="dot lg" style={{ background: HL_COLORS[c] }} onMouseDown={e => e.preventDefault()} onClick={() => commitHighlight(c)} aria-label={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function DoiTools({ paper, onApply }: { paper: Paper; onApply: (patch: Partial<Paper>) => void | Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [cands, setCands] = useState<Candidate[]>([])

  async function fill() {
    setBusy(true); setMsg(''); setCands([])
    try {
      const m = await lookupDoi(paper.doi)
      const patch: Partial<Paper> = { doi: m.doi }
      if (!paper.title && m.title) patch.title = m.title
      if (!paper.authors && m.authors) patch.authors = m.authors
      if (!paper.year && m.year) patch.year = m.year
      if (!paper.source && m.source) patch.source = m.source
      await onApply(patch)
      setMsg(Object.keys(patch).length > 1 ? 'Filled in the blank fields from Crossref.' : 'Nothing to fill: all fields already have values.')
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }
  async function find() {
    setBusy(true); setMsg(''); setCands([])
    try {
      const r = await searchByTitle(paper.title, firstSurname(paper.authors))
      setCands(r.slice(0, 3)); if (!r.length) setMsg('No matches found.')
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="doi-tools">
      <div className="row wrap">
        {paper.doi
          ? <><button disabled={busy} onClick={fill}>Fill blanks from DOI</button>
              <a className="link small" href={`https://doi.org/${cleanDoi(paper.doi)}`} target="_blank" rel="noreferrer">Open DOI</a></>
          : <button disabled={busy} onClick={find}>Find DOI from title</button>}
      </div>
      {msg && <p className="muted small">{msg}</p>}
      {cands.map(c => (
        <div className="cand" key={c.doi}>
          <b>{c.title}</b>
          <span className="muted small">{[c.authors, c.year, c.source].filter(Boolean).join(' · ')}</span>
          <button className="small" onClick={async () => { await onApply({ doi: c.doi, ...(paper.authors ? {} : { authors: c.authors }), ...(paper.year ? {} : { year: c.year }), ...(paper.source ? {} : { source: c.source }) }); setCands([]); setMsg('DOI saved.') }}>Use this one</button>
        </div>
      ))}
    </div>
  )
}
