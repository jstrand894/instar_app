import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'
import PageView, { HL_COLORS, type Tool } from '../components/PageView'
import { store } from '../lib/store'
import type { Highlight, HighlightColor, Paper, PaperStatus, Rect, Stroke } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const INK_COLORS = ['#1b1b1f', '#d32f2f', '#1565c0', '#2e7d32']

interface Pending { page: number; rects: Rect[]; text: string }

export default function Reader() {
  const { id } = useParams()
  const [paper, setPaper] = useState<Paper | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
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
        const [url, hl, inkRows] = await Promise.all([store.fileUrl(p.file_path), store.highlights(id), store.ink(id)])
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
          {!doc && !error && <p className="muted pad">Loading…</p>}
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
                <label>Title<input defaultValue={paper.title} onBlur={e => patchPaper({ title: e.target.value })} /></label>
                <label>Authors<input defaultValue={paper.authors} onBlur={e => patchPaper({ authors: e.target.value })} /></label>
                <label>Year<input defaultValue={paper.year} onBlur={e => patchPaper({ year: e.target.value })} /></label>
                <label>Status
                  <select value={paper.status} onChange={e => patchPaper({ status: e.target.value as PaperStatus })}>
                    <option value="to-read">To read</option><option value="reading">Reading</option><option value="read">Read</option>
                  </select>
                </label>
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
