/** Lookups against Crossref's free public API (works straight from the browser). */
export interface DoiMeta { doi: string; title: string; authors: string; year: string; source: string }

interface CrAuthor { given?: string; family?: string; name?: string }
interface CrWork {
  DOI: string; title?: string[]; author?: CrAuthor[]; 'container-title'?: string[]; volume?: string; page?: string
  issued?: { 'date-parts'?: (number | null)[][] }; published?: { 'date-parts'?: (number | null)[][] }
  'published-print'?: { 'date-parts'?: (number | null)[][] }; 'published-online'?: { 'date-parts'?: (number | null)[][] }
  score?: number
}

/** Crossref throttles bursts with HTTP 429; wait and retry instead of failing. */
async function crFetch(url: string): Promise<Response> {
  let r = await fetch(url)
  for (let attempt = 1; attempt <= 4 && (r.status === 429 || r.status === 503); attempt++) {
    const wait = Number(r.headers.get('retry-after')) * 1000 || 1500 * attempt
    await new Promise(res => setTimeout(res, Math.min(wait, 8000)))
    r = await fetch(url)
  }
  return r
}

export const cleanDoi = (raw: string) =>
  raw.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').replace(/[.,;)\s]+$/, '')

/** "Huffaker CB, Kennett CE": same style as your reading list. */
const fmtAuthors = (a: CrAuthor[] = []) =>
  a.map(x => x.family
    ? `${x.family} ${(x.given ?? '').split(/[\s.\-]+/).filter(Boolean).map(g => g[0]).join('').toUpperCase()}`.trim()
    : x.name ?? '').filter(Boolean).join(', ')

function toMeta(w: CrWork): DoiMeta {
  const parts = (w['published-print'] ?? w.issued ?? w['published-online'] ?? w.published)?.['date-parts']?.[0]
  const journal = w['container-title']?.[0] ?? ''
  const source = [journal, [w.volume, w.page].filter(Boolean).join(', ')].filter(Boolean).join(' ')
  return { doi: w.DOI, title: (w.title?.[0] ?? '').replace(/\s+/g, ' ').trim(), authors: fmtAuthors(w.author), year: parts?.[0] ? String(parts[0]) : '', source }
}

export async function lookupDoi(raw: string): Promise<DoiMeta> {
  const doi = cleanDoi(raw)
  if (!/^10\.\d{4,9}\/\S+$/.test(doi)) throw new Error('That does not look like a DOI (it should start with 10.)')
  const r = await crFetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)
  if (r.status === 404) throw new Error('Crossref has no record of that DOI.')
  if (!r.ok) throw new Error(`Crossref lookup failed (HTTP ${r.status}).`)
  return toMeta((await r.json()).message as CrWork)
}

export interface Candidate extends DoiMeta { similarity: number }

const tokens = (s: string) => new Set(s.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 2))
export function similarity(a: string, b: string): number {
  const A = tokens(a), B = tokens(b)
  if (!A.size || !B.size) return 0
  let hit = 0; for (const t of A) if (B.has(t)) hit++
  return hit / (A.size + B.size - hit)
}

/** Best Crossref matches for a title (and optionally a first author's surname). */
export async function searchByTitle(title: string, author = ''): Promise<Candidate[]> {
  const q = encodeURIComponent(`${title} ${author}`.trim())
  const r = await crFetch(`https://api.crossref.org/works?query.bibliographic=${q}&rows=5`)
  if (!r.ok) throw new Error(r.status === 429 ? 'Crossref is rate-limiting requests right now. Wait a minute and try again.' : `Crossref search failed (HTTP ${r.status}).`)
  const items = ((await r.json()).message.items ?? []) as CrWork[]
  return items.map(toMeta).map(m => ({ ...m, similarity: similarity(title, m.title) })).sort((a, b) => b.similarity - a.similarity)
}

/** Share of the paper's own title words that appear in the candidate's title. */
function coverage(title: string, candidate: string): number {
  const A = tokens(title), B = tokens(candidate)
  if (!A.size) return 0
  let hit = 0; for (const t of A) if (B.has(t)) hit++
  return hit / A.size
}

/** "van Klinken RD, Smith J" -> "van Klinken" */
export function firstSurname(authors: string): string {
  const parts = (authors.split(',')[0] ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1 && /^[A-Z]{1,4}$/.test(parts[parts.length - 1])) parts.pop()
  return parts.join(' ')
}

/** Confident automatic match: the title agrees (allowing extra words such as "Invited paper:"),
 *  the year is within one, and the first author appears in the candidate's author list. */
export function isConfident(c: Candidate, paper: { title: string; year: string; authors: string }): boolean {
  const titleOk = c.similarity >= 0.85 || (coverage(paper.title, c.title) >= 0.9 && tokens(c.title).size <= tokens(paper.title).size * 3)
  if (!titleOk) return false
  if (paper.year && c.year && Math.abs(Number(paper.year) - Number(c.year)) > 1) return false
  const who = firstSurname(paper.authors).toLowerCase()
  if (who && c.authors && !c.authors.toLowerCase().includes(who)) return false
  return true
}
