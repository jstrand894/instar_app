import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Paper, PaperStatus } from '../types'

export type TimelineLanes = 'category' | 'status'

const STATUS_LABEL: Record<PaperStatus, string> = { 'to-read': 'To read', reading: 'Reading', read: 'Read', unavailable: 'Unavailable' }
const STATUS_ORDER: PaperStatus[] = ['reading', 'to-read', 'read', 'unavailable']

const yearOf = (p: Paper) => { const m = /\d{4}/.exec(p.year || ''); return m ? Number(m[0]) : null }
const surname = (a: string) => (a.split(/[,;&]| and /)[0] || '').trim().split(/\s+/).pop() || ''

export default function PaperTimeline({ papers, lanes }: { papers: Paper[]; lanes: TimelineLanes }) {
  const { years, rows, undated } = useMemo(() => {
    const dated = papers.filter(p => yearOf(p) !== null)
    const ys = [...new Set(dated.map(p => yearOf(p)!))].sort((a, b) => a - b)
    const key = (p: Paper) => (lanes === 'status' ? STATUS_LABEL[p.status] : p.category || 'Uncategorized')
    const names = [...new Set(papers.map(key))]
    if (lanes === 'status') names.sort((a, b) => STATUS_ORDER.findIndex(s => STATUS_LABEL[s] === a) - STATUS_ORDER.findIndex(s => STATUS_LABEL[s] === b))
    else names.sort((a, b) => (a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b)))
    const rs = names.map(name => ({
      name,
      cells: new Map(ys.map(y => [y, dated.filter(p => key(p) === name && yearOf(p) === y)])),
      undated: papers.filter(p => key(p) === name && yearOf(p) === null),
    })).filter(r => [...r.cells.values()].some(c => c.length) || r.undated.length)
    return { years: ys, rows: rs, undated: papers.filter(p => yearOf(p) === null) }
  }, [papers, lanes])

  if (!papers.length) return null

  const chip = (p: Paper) => (
    <Link key={p.id} to={`/read/${p.id}`} className={`ptl-chip st-${p.status}`} title={`${p.title}${p.authors ? ` — ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''}`}>
      <span className="ptl-t">{p.title}</span>
      {p.authors && <span className="ptl-a">{surname(p.authors)}</span>}
    </Link>
  )

  return (
    <div className="ptl-wrap">
      {years.length > 0 && (
        <div className="ptl-scroll">
          <div className="ptl-grid" style={{ gridTemplateColumns: `minmax(7rem, 9rem) repeat(${years.length + 1}, minmax(10rem, 1fr))` }}>
            <div className="ptl-corner" />
            {years.map((y, i) => (
              <div key={y} className="ptl-year">
                {y}{i > 0 && y - years[i - 1] > 1 && <span className="ptl-gap">+{y - years[i - 1]}y</span>}
              </div>
            ))}
            <div className="ptl-year">Undated</div>
            {rows.map(r => (
              <div key={r.name} className="ptl-row">
                <div className="ptl-lane">{r.name}</div>
                {years.map(y => <div key={y} className="ptl-cell">{r.cells.get(y)!.map(chip)}</div>)}
                <div className="ptl-cell">{r.undated.map(chip)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {years.length === 0 && undated.length > 0 && <p className="muted small">None of these papers have a publication year yet, so there is nothing to place on a timeline.</p>}
    </div>
  )
}
