import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { store } from '../lib/store'
import { readStats, recommend, titleWords } from '../lib/reading'
import type { Paper, PaperLink, Project } from '../types'

export default function ReadingDashboard({ papers, projects, links, onChange }: {
  papers: Paper[]; projects: Project[]; links: PaperLink[]; onChange: () => void
}) {
  const nav = useNavigate()
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const recs = useMemo(() => recommend(papers, projects, links, skipped), [papers, projects, links, skipped])
  const stats = useMemo(() => readStats(papers), [papers])
  const words = useMemo(() => titleWords(papers.filter(p => p.status === 'read').map(p => p.title)), [papers])
  const reading = papers.filter(p => p.status === 'reading')
  const [first, ...rest] = recs

  async function start(p: Paper) {
    await store.patchPaper(p.id, { status: 'reading' }); onChange(); nav(`/read/${p.id}`)
  }

  const card = (label: string, value: number | string, sub?: string) => (
    <div className="stat-card"><b>{value}</b><span>{label}</span>{sub && <small>{sub}</small>}</div>
  )

  return (
    <div className="rd">
      <section className="card next-read">
        <div className="next-head"><h2>Recommended next read</h2>
          {recs.length > 1 && <button className="link small" onClick={() => setSkipped(new Set([...skipped, first.paper.id]))}>Not this one →</button>}
        </div>
        {first ? (
          <>
            <Link to={`/read/${first.paper.id}`} className="next-title">{first.paper.title}</Link>
            <div className="muted small">{[first.paper.authors, first.paper.year, first.paper.source].filter(Boolean).join(' · ')}</div>
            {first.paper.why && <p className="why">{first.paper.why}</p>}
            <div className="paper-foot">
              {first.reasons.map(r => <span key={r} className="pill proj-tag">{r}</span>)}
              <span className="spacer" />
              <button className="primary" onClick={() => start(first.paper)}>Start reading</button>
            </div>
            {rest.length > 0 && (
              <div className="also">
                <span className="muted small">Also good next</span>
                {rest.slice(0, 2).map(r => <Link key={r.paper.id} to={`/read/${r.paper.id}`}>{r.paper.title}</Link>)}
              </div>
            )}
          </>
        ) : <p className="muted">{papers.length ? 'Nothing left on your to-read list. Nice.' : 'Import your reading list or add papers by DOI, and a recommendation will show up here.'}</p>}
        {reading.length > 0 && (
          <div className="also"><span className="muted small">Currently reading</span>
            {reading.slice(0, 3).map(p => <Link key={p.id} to={`/read/${p.id}`}>{p.title}</Link>)}</div>
        )}
      </section>

      <div className="rd-grid">
        <div className="stat-cards">
          {card('read this week', stats.week)}
          {card('read this month', stats.month)}
          {card('read this year', stats.year)}
          {card('read all time', stats.total, stats.reading ? `${stats.reading} in progress` : undefined)}
          {stats.coreTotal > 0 && (
            <div className="stat-card wide-card">
              <b>{stats.coreRead}<small> / {stats.coreTotal}</small></b><span>Core papers read</span>
              <div className="meter"><i style={{ width: `${(stats.coreRead / stats.coreTotal) * 100}%` }} /></div>
            </div>
          )}
        </div>
        <section className="card cloud-card">
          <h2>What you've been reading</h2>
          <WordCloud words={words} />
        </section>
      </div>
    </div>
  )
}

function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) }

function WordCloud({ words }: { words: { word: string; n: number }[] }) {
  if (!words.length) return <p className="muted">Mark papers as read and a cloud of the words in their titles will grow here.</p>
  const max = words[0].n, min = words[words.length - 1].n
  // Biggest words toward the middle: order by size, then alternate sides.
  const ordered: typeof words = []
  words.forEach((w, i) => (i % 2 ? ordered.unshift(w) : ordered.push(w)))
  return (
    <div className="cloud" aria-label="Word cloud of titles you have read">
      {ordered.map(w => {
        const t = max === min ? 0.5 : (w.n - min) / (max - min)
        const size = 13 + Math.sqrt(t) * 26
        return (
          <span key={w.word} title={`${w.word}: ${w.n}`} style={{
            fontSize: `${size}px`, fontWeight: t > 0.4 ? 700 : 500,
            opacity: 0.55 + t * 0.45, transform: `translateY(${(hash(w.word) % 7) - 3}px)`,
          }}>{w.word}</span>
        )
      })}
    </div>
  )
}
