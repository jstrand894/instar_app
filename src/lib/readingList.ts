import { readSheet } from 'read-excel-file/browser'
import type { PaperInput, PaperStatus } from '../types'

const text = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

function statusFrom(v: string): PaperStatus {
  const s = v.toLowerCase()
  if (!s) return 'to-read'
  if (s.startsWith('unavail')) return 'unavailable'
  if (s.startsWith('read') ) return s === 'reading' ? 'reading' : 'read'
  if (s === 'r' || s === 'in progress') return 'reading'
  return 'read' // any other mark (e.g. "x") means finished
}

/** Parses a reading-list spreadsheet. Expected headers (case-insensitive):
 *  Read, doi, Category, Priority, Authors, Year, Title, Source, Why it matters */
export async function parseReadingList(file: File): Promise<PaperInput[]> {
  const rows = await readSheet(file)
  if (rows.length < 2) return []
  const head = rows[0].map(h => text(h).toLowerCase())
  const col = (...names: string[]) => head.findIndex(h => names.some(n => h === n || h.startsWith(n)))
  const c = {
    read: col('read', 'status'), doi: col('doi'), category: col('category'), priority: col('priority'),
    authors: col('authors', 'author'), year: col('year'), title: col('title'), source: col('source'), why: col('why'),
  }
  if (c.title < 0) throw new Error('Could not find a "Title" column in the first row.')
  const get = (r: unknown[], i: number) => (i >= 0 ? text(r[i]) : '')
  return rows.slice(1).filter(r => get(r, c.title)).map(r => ({
    title: get(r, c.title),
    authors: get(r, c.authors),
    year: get(r, c.year),
    doi: get(r, c.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''),
    category: get(r, c.category),
    priority: get(r, c.priority),
    source: get(r, c.source),
    why: get(r, c.why),
    status: statusFrom(get(r, c.read)),
  }))
}
