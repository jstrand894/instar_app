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

/** "Good morning" / "Good afternoon" / "Good evening" for an hour (0-23). */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}
