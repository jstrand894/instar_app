import type { Project } from '../types'

export type QuickMode = 'todo' | 'deadline' | 'update'
export interface QuickParse {
  mode: QuickMode | null // what the text says it is ("deadline for…"), or null to keep what is picked
  projectId: string | null // a project named in the text
  projectName: string | null
  title: string // the text with the recognised bits taken out
  date: string | null // ISO day found in the text
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const NUMWORD: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const DAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs?(?:day)?)?|fri(?:day)?|sat(?:urday)?)'
const LEAD = '(?:\\b(?:on|by|due(?:\\s+on)?|until|before)\\s+)?'
const DATE_RE = new RegExp(`${LEAD}\\b(?:` + [
  `${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, // December 1, Dec 1st, Dec 1 2026
  `(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s+(\\d{4}))?`, // 1 December
  `(\\d{4})-(\\d{2})-(\\d{2})`, // 2026-12-01
  `(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?`, // 12/1, 12/1/26
  `(today|tonight|tomorrow|tmrw)`,
  `in\\s+(\\d+|an?|one|two|three|four|five|six)\\s+(day|week|month)s?`,
  `(next\\s+week)`,
  `(?:(next|this)\\s+)?${DAY_RE}`,
].join('|') + `)\\b`, 'i')

function monthIdx(s: string) { return MONTHS.indexOf(s.slice(0, 3).toLowerCase()) }

/** Finds a date phrase anywhere in the text; returns the ISO day and the text with the phrase removed. */
function takeDate(text: string, now: Date): { date: string | null; rest: string } {
  const m = DATE_RE.exec(text)
  if (!m) return { date: null, rest: text }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const g = m.slice(1)
  let d: Date | null = null
  const future = (mo: number, day: number, yr?: string) => {
    const x = new Date(yr ? +yr : today.getFullYear(), mo, day)
    if (!yr && x < today) x.setFullYear(x.getFullYear() + 1)
    return x.getMonth() === mo ? x : null // rejects Feb 31 and the like
  }
  if (g[0]) d = future(monthIdx(g[0]), +g[1], g[2])
  else if (g[4]) d = future(monthIdx(g[4]), +g[3], g[5])
  else if (g[6]) d = new Date(+g[6], +g[7] - 1, +g[8])
  else if (g[9]) { const y = g[11] ? (g[11].length === 2 ? 2000 + +g[11] : +g[11]) : undefined; d = future(+g[9] - 1, +g[10], y ? String(y) : undefined) }
  else if (g[12]) {
    const w = g[12].toLowerCase(); d = new Date(today)
    if (w === 'tomorrow' || w === 'tmrw') d.setDate(d.getDate() + 1)
  } else if (g[13]) {
    const n = /^\d+$/.test(g[13]) ? +g[13] : NUMWORD[g[13].toLowerCase()] ?? 1, unit = g[14].toLowerCase()
    d = new Date(today)
    if (unit === 'month') d.setMonth(d.getMonth() + n); else d.setDate(d.getDate() + n * (unit === 'week' ? 7 : 1))
  } else if (g[15]) { d = new Date(today); d.setDate(d.getDate() + 7) }
  else if (g[17]) {
    const idx = WEEKDAYS.indexOf(g[17].slice(0, 3).toLowerCase()); d = new Date(today)
    let diff = (idx - today.getDay() + 7) % 7
    if (g[16]?.toLowerCase() === 'next' || diff === 0) diff = diff || 7
    d.setDate(d.getDate() + diff)
  }
  if (!d || isNaN(d.getTime())) return { date: null, rest: text }
  return { date: iso(d), rest: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)) }
}

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'for', 'in', 'on', 'to', 'my', 'our', 'with', 'at', 'by'])
const GENERIC = new Set(['manuscript', 'manuscripts', 'paper', 'project', 'projects', 'study', 'draft', 'app', 'repo'])
const PREP = new Set(['in', 'on', 'for', 'to', 'under', 'from', 're', 'regarding', 'about', 'at'])
const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean)
const tokMatch = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)))

/** Looks for a project named in the text. Returns the project and the word range to take out (if it is safe to). */
function findProject(text: string, projects: Project[]): { project: Project; from: number; to: number } | null {
  const toks = text.split(/\s+/).filter(Boolean)
  const low = toks.map(t => t.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, ''))
  type Hit = { p: Project; score: number; idx: number[]; whole: boolean }
  const hits: Hit[] = []
  for (const p of projects) {
    const keys = words(p.name).filter(w => !STOP.has(w) && !GENERIC.has(w))
    if (!keys.length) continue
    const idx: number[] = []
    let found = 0
    for (const k of keys) {
      const i = low.findIndex((t, n) => !!t && !STOP.has(t) && !idx.includes(n) && tokMatch(t, k))
      if (i >= 0) { found++; idx.push(i) }
    }
    if (!found) continue
    const whole = found === keys.length
    const asType = low.some(t => t === p.type || (p.type === 'manuscript' && /^manuscripts?$/.test(t))) ? 0.25 : 0
    hits.push({ p, score: found / keys.length + asType + (found > 1 ? 0.1 : 0), idx, whole })
  }
  if (!hits.length) return null
  hits.sort((a, b) => b.score - a.score)
  const best = hits[0]
  if (hits[1] && hits[1].score === best.score) return null // can't tell which one: don't guess
  const from = Math.min(...best.idx), to = Math.max(...best.idx)
  const introduced = from > 0 && PREP.has(low[from - 1]) || (from > 1 && STOP.has(low[from - 1]) && PREP.has(low[from - 2]))
  if (!best.whole && !introduced) return null // a partial name needs "in/for/on" in front to count
  return { project: best.p, from, to }
}

/** Reads one line typed into Quick add: what it is, which project, and when. Nothing is guessed when it is unclear. */
export function parseQuick(input: string, projects: Project[], picked: QuickMode, now = new Date()): QuickParse {
  let text = input.replace(/\s*\n\s*/g, ' ').trim()
  let mode: QuickMode | null = null

  // "deadline for …", "todo …", "log …" at the start (due:/update:/t:/d:/u: need the colon so ordinary sentences are left alone)
  const k = /^(deadline|todo|to-do|task|log|due|update|d|t|u)\b\s*(:)?\s*/i.exec(text)
  if (k) {
    const w = k[1].toLowerCase(), colon = !!k[2], rest = text.slice(k[0].length)
    if (rest && (colon || ['deadline', 'todo', 'to-do', 'task', 'log'].includes(w))) {
      mode = w === 'deadline' || w === 'due' || w === 'd' ? 'deadline' : w === 'log' || w === 'update' || w === 'u' ? 'update' : 'todo'
      text = mode === 'deadline' ? rest.replace(/^(for|on|:)\s+/i, '') : rest
    }
  }
  const eff = mode ?? picked

  let date: string | null = null
  if (eff !== 'update') { const r = takeDate(text, now); date = r.date; text = r.rest }
  text = text.replace(/\s+/g, ' ').trim()

  let projectId: string | null = null, projectName: string | null = null
  const hit = findProject(text, projects)
  if (hit) {
    projectId = hit.project.id; projectName = hit.project.name
    if (eff !== 'update') {
      // take the project phrase out only when it is a tidy "… in the ento manuscript" tail
      const toks = text.split(/\s+/)
      let to = hit.to
      while (to + 1 < toks.length && GENERIC.has(toks[to + 1].toLowerCase().replace(/[^\p{L}]/gu, ''))) to++
      let from = hit.from
      while (from > 0 && /^(the|my|our)$/i.test(toks[from - 1])) from--
      const prep = from > 0 && PREP.has(toks[from - 1].toLowerCase())
      if (prep && to === toks.length - 1 && from - 1 > 0) text = toks.slice(0, from - 1).join(' ')
    }
  }

  text = text.replace(/\s+/g, ' ').replace(/^[\s,;:.-]+|[\s,;:-]+$/g, '').replace(/\s+(in|on|for|by|due|to|at|until|before)$/i, '').trim()
  return { mode, projectId, projectName, title: text, date }
}
