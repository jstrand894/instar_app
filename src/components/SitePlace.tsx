import { useEffect, useState } from 'react'
import { hasPin, placeName, placeText } from '../lib/sites'
import type { FieldSite } from '../types'

/** Where a site is, as a broad place name rather than coordinates. */
export function usePlace(s: Pick<FieldSite, 'address' | 'lat' | 'lng'>) {
  const [place, setPlace] = useState<string | null>(null)
  useEffect(() => {
    setPlace(null)
    if (!hasPin(s)) return
    let live = true
    placeName(s.lat, s.lng).then(n => { if (live) setPlace(n) })
    return () => { live = false }
  }, [s.lat, s.lng]) // eslint-disable-line react-hooks/exhaustive-deps
  return { place, text: placeText(s, place) }
}

export default function SitePlace({ site }: { site: Pick<FieldSite, 'address' | 'lat' | 'lng'> }) {
  const { text } = usePlace(site)
  return text ? <p className="muted small">{text}</p> : null
}
