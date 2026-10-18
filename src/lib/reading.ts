import type { Paper, PaperLink, Project } from '../types'
import { STAGES } from './manuscript'

const DAY = 864e5

export interface ReadStats { week: number; month: number; year: number; total: number; reading: number; coreRead: number; coreTotal: number }

export function readStats(papers: Paper[], now = Date.now()): ReadStats {
  const read = papers.filter(p => p.status === 'read')
  const since = (days: number) => read.filter(p => p.read_at && now - new Date(p.read_at).getTime() < days * DAY).length
  const core = papers.filter(p => p.priority === 'Core')
  return {
    week: since(7), month: since(30), year: since(365), total: read.length,
    reading: papers.filter(p => p.status === 'reading').length,
    coreRead: core.filter(p => p.status === 'read').length, coreTotal: core.length,
  }
}

const STOP = new Set(('the and for with from that this are was were its into using use used their between among within across over under about after before through than then ' +
  'not but can may how why what when who which also more most other some such via per new case cases study studies analysis their there these those has have had been being does did ' +
  'one two three first second part towards toward against both each very much many however based').split(' '))

/** Word counts from paper titles, for the word cloud. */
export function titleWords(titles: string[], limit = 40): { word: string; n: number }[] {
  const counts = new Map<string, number>()
  for (const t of titles) {
    for (const raw of t.toLowerCase().replace(/<[^>]+>/g, ' ').split(/[^a-zÀ-ɏ'-]+/)) {
      const w = raw.replace(/^[-']+|[-']+$/g, '')
      if (w.length < 3 || STOP.has(w)) continue
      counts.set(w, (counts.get(w) ?? 0) + 1)
    }
  }
  return [...counts.entries()].map(([word, n]) => ({ word, n })).sort((a, b) => b.n - a.n || a.word.localeCompare(b.word)).slice(0, limit)
}

export interface Recommendation { paper: Paper; reasons: string[]; score: number }

/** Ranks unread papers: what feeds an active manuscript or project first, then Core papers, then PDFs you already have. */
export function recommend(papers: Paper[], projects: Project[], links: PaperLink[], skipped: Set<string>): Recommendation[] {
  const lastRead = [...papers].filter(p => p.status === 'read' && p.read_at).sort((a, b) => (b.read_at ?? '').localeCompare(a.read_at ?? ''))[0]
  const projById = new Map(projects.map(p => [p.id, p]))
  const out: Recommendation[] = []
  for (const p of papers) {
    if (p.status !== 'to-read' || skipped.has(p.id)) continue
    let score = 0; const reasons: string[] = []
    if (p.priority === 'Core') { score += 3; reasons.push('Core paper') } else if (p.priority) score += 1
    for (const l of links) {
      if (l.paper_id !== p.id) continue
      const pr = projById.get(l.project_id); if (!pr || pr.status !== 'active' || pr.stage === 'accepted') continue
      const urgent = pr.type === 'manuscript' && ['drafting', 'internal', 'revision'].includes(pr.stage ?? 'drafting')
      score += urgent ? 5 : pr.type === 'manuscript' ? 3 : 2
      reasons.push(`For ${pr.name}${pr.type === 'manuscript' && pr.stage ? ` (${STAGES.find(s => s.id === pr.stage)?.label.toLowerCase()})` : ''}`)
    }
    if (p.file_path) { score += 1.5; reasons.push('PDF ready') }
    if (lastRead && lastRead.category && p.category === lastRead.category) { score += 1; reasons.push('Same topic as your last read') }
    out.push({ paper: p, reasons, score })
  }
  // Ties keep the order of your reading list (seminal papers first).
  return out.sort((a, b) => b.score - a.score || a.paper.created_at.localeCompare(b.paper.created_at))
}
