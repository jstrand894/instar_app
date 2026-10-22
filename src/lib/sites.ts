import type { FieldSite, SiteVisit } from '../types'

export const hasPin = (s: Pick<FieldSite, 'lat' | 'lng'>): s is { lat: number; lng: number } => s.lat != null && s.lng != null

/** Links that open the site in Google Maps or Apple Maps (the address is used when there is no pin). */
export function mapLinks(s: Pick<FieldSite, 'name' | 'address' | 'lat' | 'lng'>) {
  const q = hasPin(s) ? `${s.lat},${s.lng}` : s.address || s.name
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
    apple: hasPin(s) ? `https://maps.apple.com/?ll=${s.lat},${s.lng}&q=${encodeURIComponent(s.name)}` : `https://maps.apple.com/?q=${encodeURIComponent(q)}`,
  }
}

/** Reads "46.12, -112.45" style text as a position; null for anything else. */
export function parseCoords(q: string): { lat: number; lng: number } | null {
  const m = q.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const lat = +m[1], lng = +m[2]
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

/** Looks an address up with OpenStreetMap's free search; null when nothing matches or the lookup fails. */
export async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  if (!q.trim()) return null
  const c = parseCoords(q); if (c) return c
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } })
    const j = await r.json() as { lat: string; lon: string }[]
    return j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null
  } catch { return null }
}

/** A broad place name (city or county, state) for a pin, so coordinates never need showing; null when the lookup fails. */
export async function placeName(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&addressdetails=1&lat=${lat}&lon=${lng}`, { headers: { Accept: 'application/json' } })
    const a = (await r.json() as { address?: Record<string, string> }).address
    if (!a) return null
    const local = a.city || a.town || a.village || a.municipality || a.hamlet
    const parts = [local || a.county, local ? a.county : undefined, a.state || a.country].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  } catch { return null }
}

/** Shrinks a picked photo to a JPEG about 800px wide (60-100 KB), so covers barely use any storage. */
export function toCover(file: File, width = 800, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image()
    img.onload = () => {
      const w = Math.min(width, img.width), h = Math.round(img.height * (w / img.width))
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      c.toBlob(b => b ? resolve(b) : reject(new Error('Could not shrink that photo.')), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image I can read.')) }
    img.src = url
  })
}

export interface SiteStats { done: SiteVisit[]; planned: SiteVisit[]; last?: SiteVisit; next?: SiteVisit }
/** Past visits newest first, planned ones soonest first. A planned visit stays "next" for an hour after it starts. */
export function siteStats(visits: SiteVisit[], now = Date.now()): SiteStats {
  const done = visits.filter(v => v.status === 'done').sort((a, b) => b.visited_at.localeCompare(a.visited_at))
  const planned = visits.filter(v => v.status === 'planned').sort((a, b) => a.visited_at.localeCompare(b.visited_at))
  return { done, planned, last: done[0], next: planned.find(v => new Date(v.visited_at).getTime() + 36e5 >= now) }
}
