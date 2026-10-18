import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../lib/store'
import { ago } from '../lib/util'
import type { Paper, PaperStatus } from '../types'

const STATUS: { id: PaperStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'to-read', label: 'To read' },
  { id: 'reading', label: 'Reading' }, { id: 'read', label: 'Read' },
]

export default function Library() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<PaperStatus | 'all'>('all')
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try { setPapers(await store.papers()) } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  async function upload(files: FileList | File[]) {
    setBusy(true); setError('')
    try {
      for (const f of Array.from(files)) {
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) continue
        await store.addPaper(f, { title: f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '), authors: '', year: '' })
      }
      await refresh()
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  const needle = q.toLowerCase()
  const list = papers.filter(p =>
    (status === 'all' || p.status === status) &&
    (!needle || `${p.title} ${p.authors} ${p.year}`.toLowerCase().includes(needle)))

  return (
    <div className={`page ${drag ? 'dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={e => { if (e.currentTarget === e.target) setDrag(false) }}
      onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files) }}>
      <header className="page-head">
        <h1>Papers</h1>
        <button className="primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : 'Upload PDF'}</button>
        <input ref={input} type="file" accept="application/pdf" multiple hidden onChange={e => e.target.files && upload(e.target.files)} />
      </header>

      <div className="chips">
        {STATUS.map(s => <button key={s.id} className={status === s.id ? 'on' : ''} onClick={() => setStatus(s.id)}>{s.label}</button>)}
        <input className="search" type="search" placeholder="Search title, author, year" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}

      <div className="list">
        {list.map(p => (
          <div className="card paper" key={p.id}>
            <Link to={`/read/${p.id}`} className="paper-main">
              <strong>{p.title}</strong>
              <span className="muted small">{[p.authors, p.year].filter(Boolean).join(' · ') || 'Add authors and year in the reader'}</span>
            </Link>
            <span className={`pill s-${p.status}`}>{p.status.replace('-', ' ')}</span>
            <time className="muted small">{ago(p.created_at)}</time>
            <button className="link small danger" onClick={async () => {
              if (confirm(`Delete "${p.title}", including its highlights?`)) { await store.deletePaper(p.id); refresh() }
            }}>Delete</button>
          </div>
        ))}
      </div>
      {!list.length && (
        <div className="empty-box dashed">
          <h2>{papers.length ? 'No matches' : 'Your reading library is empty'}</h2>
          <p className="muted">{papers.length ? 'Try a different search or status.' : 'Drop PDFs anywhere on this page, or upload from this device.'}</p>
          {!papers.length && <button className="primary" onClick={() => input.current?.click()}>Upload PDF</button>}
        </div>
      )}
    </div>
  )
}
