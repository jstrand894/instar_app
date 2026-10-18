import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { store } from './store'
import type { Paper, Project } from '../types'

export interface LinkTarget { kind: 'project' | 'paper'; id: string; label: string; sub: string }

interface Ctx {
  /** Finds the project, manuscript or paper a [[name]] refers to. */
  resolve: (text: string) => LinkTarget | null
  /** Suggestions while typing after [[ . */
  options: (q: string) => LinkTarget[]
  /** Every tag in use, most common first. */
  tags: { tag: string; count: number }[]
}

const LinksContext = createContext<Ctx>({ resolve: () => null, options: () => [], tags: [] })
export const useLinks = () => useContext(LinksContext)

export const normalizeTag = (t: string) => t.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '')

/** Loads names and tags once for the whole app, and keeps them fresh when something is saved. */
export function LinksProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [papers, setPapers] = useState<Paper[]>([])
  useEffect(() => {
    const load = () => Promise.all([store.projects(), store.papers()]).then(([a, b]) => { setProjects(a); setPapers(b) }).catch(() => {})
    load(); window.addEventListener('tm-data', load); return () => window.removeEventListener('tm-data', load)
  }, [])

  const value = useMemo<Ctx>(() => {
    const all: LinkTarget[] = [
      ...projects.map(p => ({ kind: 'project' as const, id: p.id, label: p.name, sub: p.type === 'manuscript' ? 'Manuscript' : 'Project' })),
      ...papers.map(p => ({ kind: 'paper' as const, id: p.id, label: p.title, sub: [p.authors.split(',')[0], p.year].filter(Boolean).join(' ') })),
    ]
    const find = (q: string) => {
      const n = q.trim().toLowerCase(); if (!n) return []
      const rank = (t: LinkTarget) => { const l = t.label.toLowerCase(); return l === n ? 0 : l.startsWith(n) ? 1 : l.includes(n) ? 2 : 9 }
      return all.map(t => ({ t, r: rank(t) })).filter(x => x.r < 9).sort((a, b) => a.r - b.r || (a.t.kind === b.t.kind ? 0 : a.t.kind === 'project' ? -1 : 1)).map(x => x.t)
    }
    const counts = new Map<string, number>()
    for (const t of [...projects.flatMap(p => p.tags ?? []), ...papers.flatMap(p => p.tags ?? [])]) counts.set(t, (counts.get(t) ?? 0) + 1)
    return {
      resolve: q => find(q)[0] ?? null,
      options: q => (q.trim() ? find(q) : all.slice(0, 8)),
      tags: [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
    }
  }, [projects, papers])

  return <LinksContext.Provider value={value}>{children}</LinksContext.Provider>
}

/** Splits text into plain pieces, [[links]] and #tags. */
export type Piece = { t: 'text'; s: string } | { t: 'link'; s: string } | { t: 'tag'; s: string }
export function parsePieces(text: string): Piece[] {
  const out: Piece[] = []; const re = /\[\[([^\]\n]+)\]\]|(^|[\s(])#([\p{L}\p{N}_-]+)/gu
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) { if (m.index > last) out.push({ t: 'text', s: text.slice(last, m.index) }); out.push({ t: 'link', s: m[1] }); last = m.index + m[0].length }
    else { const start = m.index + m[2].length; if (start > last) out.push({ t: 'text', s: text.slice(last, start) }); out.push({ t: 'tag', s: m[3] }); last = start + 1 + m[3].length }
  }
  if (last < text.length) out.push({ t: 'text', s: text.slice(last) })
  return out
}
