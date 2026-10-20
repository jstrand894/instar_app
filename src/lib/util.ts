export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
export const isDesktop = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches

import type { ProjectEvent } from '../types'

/** The next time this event happens (weekly events roll forward), or null once a one-off is over. */
export function nextOccurrence(e: ProjectEvent, from = new Date()): Date | null {
  const start = new Date(e.starts_at)
  const grace = 60 * 60 * 1000 // keep showing for an hour after it starts
  if (e.repeat === 'weekly') {
    const week = 7 * 864e5
    if (start.getTime() + grace >= from.getTime()) return start
    const weeks = Math.ceil((from.getTime() - grace - start.getTime()) / week)
    const d = new Date(start); d.setDate(d.getDate() + weeks * 7) // setDate keeps wall-clock time across DST
    return d
  }
  return start.getTime() + grace >= from.getTime() ? start : null
}

export function fmtWhen(d: Date, now = new Date()): string {
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((midnight(d) - midnight(now)) / 864e5)
  if (days === 0) return `Today ${time}`
  if (days === 1) return `Tomorrow ${time}`
  if (days > 1 && days < 7) return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`
}

/** Every occurrence of a project event inside [from, to). */
export function occurrencesBetween(e: ProjectEvent, from: Date, to: Date): Date[] {
  const out: Date[] = []; const start = new Date(e.starts_at)
  if (e.repeat !== 'weekly') return start >= from && start < to ? [start] : out
  const d = new Date(start)
  if (d < from) d.setDate(d.getDate() + Math.ceil((from.getTime() - d.getTime()) / (7 * 864e5)) * 7)
  for (let i = 0; d < to && i < 200; i++) { out.push(new Date(d)); d.setDate(d.getDate() + 7) }
  return out
}

/** 95 -> "1h 35m", 25 -> "25m". */
export function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60), r = Math.round(m % 60)
  return h ? `${h}h${r ? ` ${r}m` : ''}` : `${r}m`
}

/** "Good morning" / "Good afternoon" / "Good evening" for an hour (0-23). */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Pulls a trailing date phrase (today, tomorrow, fri, 3/14, 2026-03-14) off a line: "email reviewer fri" -> title + ISO date. */
export function splitWhen(line: string, now = new Date()): { title: string; date: string | null } {
  const m = line.trim().match(/^(.*?)\s*\b(today|tomorrow|tmrw|(?:next\s+)?(?:sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs?|rsday)?|fri(?:day)?|sat(?:urday)?)|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})\s*$/i)
  if (!m || !m[1].trim()) return { title: line.trim(), date: null }
  const w = m[2].toLowerCase(); const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (w === 'today') return { title: m[1].trim(), date: isoDay(base) }
  if (w === 'tomorrow' || w === 'tmrw') { base.setDate(base.getDate() + 1); return { title: m[1].trim(), date: isoDay(base) } }
  if (/^\d{4}-/.test(w)) return { title: m[1].trim(), date: w }
  const sl = w.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (sl) {
    const d = new Date(now.getFullYear(), +sl[1] - 1, +sl[2]); if (d < base) d.setFullYear(d.getFullYear() + 1)
    return { title: m[1].trim(), date: isoDay(d) }
  }
  const idx = WEEKDAYS.indexOf(w.replace(/^next\s+/, '').slice(0, 3))
  if (idx < 0) return { title: line.trim(), date: null }
  let diff = (idx - base.getDay() + 7) % 7; if (diff === 0 || w.startsWith('next')) diff = diff || 7
  base.setDate(base.getDate() + diff)
  return { title: m[1].trim(), date: isoDay(base) }
}

/** The one line to show for a GitHub push entry: the commit message (older entries began "Pushed N commit(s) to branch" with the messages as bullets below). */
/** A stored commit entry as plain commit text: no file list and no hashes; the "abc1234 on main" line becomes "Pushed to main". */
export function commitText(body: string): string {
  return body.split('\n')
    .filter(l => !/^[+~-] \S/.test(l) && !/^…and \d+ more files$/.test(l))
    .map(l => l.replace(/^[0-9a-f]{7} on (\S+)$/, 'Pushed to $1').replace(/\s*\([0-9a-f]{7}\)$/, ''))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
/** The one-line headline of a commit entry: the first commit message, without bullets or the "N commits pushed" header. */
export function commitHeadline(body: string): string {
  const line = commitText(body).split('\n').find(l => l.trim() && !/^(Pushed \d+ commits? to |\d+ commits pushed to |Pushed to )/.test(l))
  return (line ?? body.split('\n')[0]).replace(/^•\s*/, '')
}

/** ISO timestamp -> value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso), p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
/** datetime-local value -> ISO timestamp, or undefined when blank/invalid. */
export function fromLocalInput(v: string): string | undefined {
  const d = new Date(v); return v && !isNaN(d.getTime()) ? d.toISOString() : undefined
}
