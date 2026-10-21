import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
// a drawn pin, so no marker image files are needed
const pin = (on = false) => L.divIcon({ className: 'site-pin', html: `<i class="${on ? 'on' : ''}"></i>`, iconSize: [26, 26], iconAnchor: [13, 26], tooltipAnchor: [0, -24] })

function makeMap(el: HTMLElement) {
  const map = L.map(el, { scrollWheelZoom: false }).setView([20, 0], 2)
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATTR }).addTo(map)
  return map
}

export interface MapSite { id: string; name: string; lat: number; lng: number }

/** Every field site as a pin; clicking one opens it. */
export function SitesMap({ sites, onOpen }: { sites: MapSite[]; onOpen: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const open = useRef(onOpen)
  useEffect(() => { open.current = onOpen })
  useEffect(() => {
    const map = makeMap(box.current!)
    const pts = sites.map(s => {
      const m = L.marker([s.lat, s.lng], { icon: pin(), title: s.name, keyboard: true }).addTo(map)
      m.bindTooltip(s.name, { direction: 'top' }); m.on('click', () => open.current(s.id))
      return [s.lat, s.lng] as [number, number]
    })
    if (pts.length === 1) map.setView(pts[0], 12)
    else if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 13 })
    return () => { map.remove() }
  }, [sites])
  return <div ref={box} className="site-map" role="region" aria-label="Map of field sites" />
}

/** A small map where you click to place (or move) the site's pin. */
export function PickMap({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const pick = useRef(onPick)
  useEffect(() => { pick.current = onPick })
  const map = useRef<L.Map | null>(null)
  const mark = useRef<L.Marker | null>(null)
  useEffect(() => {
    const m = makeMap(box.current!); map.current = m
    m.on('click', e => pick.current(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)))
    return () => { m.remove(); map.current = null; mark.current = null }
  }, [])
  useEffect(() => {
    const m = map.current; if (!m) return
    if (lat == null || lng == null) { mark.current?.remove(); mark.current = null; return }
    if (mark.current) mark.current.setLatLng([lat, lng]); else mark.current = L.marker([lat, lng], { icon: pin(true) }).addTo(m)
    m.setView([lat, lng], Math.max(m.getZoom(), 13))
  }, [lat, lng])
  return <div ref={box} className="site-map pick" role="region" aria-label="Click the map to set the site's location" />
}
