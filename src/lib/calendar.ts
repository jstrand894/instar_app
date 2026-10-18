import ICAL from 'ical.js'
import { supabase } from './supabase'
import type { Calendar } from '../types'

export interface CalEvent {
  id: string
  calId: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  location: string
}

export interface Feed { id: string; ics?: string; error?: string }

const normalize = (url: string) => url.trim().replace(/^webcal:\/\//i, 'https://')

/** Google "share" links aren't feeds; catch the common mix-up before saving. */
export function checkFeedUrl(raw: string): string | null {
  const url = normalize(raw)
  if (!/^https:\/\//i.test(url)) return 'The link must start with https:// or webcal://'
  if (/calendar\.google\.com\/calendar\/(embed|u\/\d+\/r|r\?)|[?&]cid=/i.test(url))
    return 'That is a sharing link, not the calendar feed. In Google Calendar use "Secret address in iCal format" (it ends in .ics).'
  return null
}
export { normalize as normalizeFeedUrl }

let cache: { at: number; key: string; feeds: Feed[] } | null = null

/** Fetches the raw .ics text for each calendar. With Supabase this goes through an edge function
 *  (browsers can't fetch these feeds directly); in demo mode it tries a direct fetch. */
export async function fetchFeeds(cals: Calendar[], force = false): Promise<Feed[]> {
  const key = cals.map(c => c.id + c.url).join('|')
  if (!force && cache && cache.key === key && Date.now() - cache.at < 5 * 60_000) return cache.feeds
  let feeds: Feed[]
  if (supabase) {
    const { data, error } = await supabase.functions.invoke('calendar-feed')
    if (error) throw new Error(`Could not reach the calendar function (${error.message}). Has it been deployed in Supabase?`)
    feeds = (data as { feeds: Feed[] }).feeds
  } else {
    feeds = await Promise.all(cals.map(async c => {
      try { const r = await fetch(normalize(c.url)); if (!r.ok) throw new Error(`HTTP ${r.status}`); return { id: c.id, ics: await r.text() } }
      catch (e) { return { id: c.id, error: (e as Error).message } }
    }))
  }
  cache = { at: Date.now(), key, feeds }
  return feeds
}

/** Expands an .ics file (including repeating events and exceptions) into concrete events inside [from, to). */
export function expandIcs(calId: string, ics: string, from: Date, to: Date): CalEvent[] {
  const comp = new ICAL.Component(ICAL.parse(ics))
  for (const tz of comp.getAllSubcomponents('vtimezone')) { try { ICAL.TimezoneService.register(tz) } catch { /* unknown zone: fall back */ } }

  const masters = new Map<string, ICAL.Event>()
  const loose: ICAL.Event[] = []
  const exceptions: ICAL.Event[] = []
  for (const v of comp.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(v)
    if (v.hasProperty('recurrence-id')) exceptions.push(ev)
    else if (ev.isRecurring()) masters.set(ev.uid, ev)
    else loose.push(ev)
  }
  for (const ex of exceptions) {
    const m = masters.get(ex.uid)
    if (m) m.relateException(ex); else loose.push(ex)
  }

  const out: CalEvent[] = []
  const push = (ev: ICAL.Event, start: ICAL.Time, end: ICAL.Time, i: number) => {
    const s = start.toJSDate(); let e = end.toJSDate()
    if (e < s) e = s
    if (e < from || s >= to) return
    if (String(ev.component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED') return
    out.push({ id: `${calId}:${ev.uid}:${i}:${s.getTime()}`, calId, title: ev.summary || '(no title)', start: s, end: e, allDay: start.isDate, location: ev.location || '' })
  }

  for (const ev of loose) push(ev, ev.startDate, ev.endDate, 0)

  const toT = ICAL.Time.fromJSDate(to, true)
  for (const ev of masters.values()) {
    const it = ev.iterator()
    let next: ICAL.Time | null, n = 0
    while ((next = it.next()) && n++ < 3000) {
      if (next.compare(toT) > 0) break
      const d = ev.getOccurrenceDetails(next)
      push(d.item, d.startDate, d.endDate, n)
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}
