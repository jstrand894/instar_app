import { useEffect, useState } from 'react'
import Icon, { type IconName } from './Icon'
import { getPrefs } from '../lib/prefs'

interface Day { d: string; code: number; hi: number; lo: number; rain: number; wind: number; temps: number[]; sunrise: string; sunset: string }
interface Wx { place: string; temp: number; code: number; hi: number; lo: number; wind: number; rain: number; day: boolean; hour: number; days: Day[] }
interface City { name: string; lat: number; lon: number }

const KEY = 'tm-weather3'; const CITY = 'tm-weather-city'
const TTL = 30 * 6e4
const usUnits = () => { const u = getPrefs().units; return u === 'f' || (u === 'auto' && (navigator.language || '').toLowerCase().startsWith('en-us')) }

function describe(c: number): [IconName, string] {
  if (c === 0) return ['sun', 'Clear']
  if (c <= 2) return ['partly', 'Partly cloudy']
  if (c === 3) return ['cloud', 'Overcast']
  if (c === 45 || c === 48) return ['fog', 'Foggy']
  if (c >= 51 && c <= 57) return ['drizzle', 'Drizzle']
  if (c >= 61 && c <= 67) return ['rain', 'Rain']
  if (c >= 71 && c <= 77 || c === 85 || c === 86) return ['snow', 'Snow']
  if (c >= 80 && c <= 82) return ['rain', 'Showers']
  if (c >= 95) return ['storm', 'Thunderstorms']
  return ['cloud', 'Weather']
}

/** Picks the card's color family from the weather code (and night). */
function mood(c: number, day: boolean): string {
  if (c >= 95) return 'storm'
  if (c >= 71 && c <= 77 || c === 85 || c === 86) return 'snow'
  if (c >= 51 && c <= 67 || c >= 80 && c <= 82) return 'rain'
  if (c === 45 || c === 48) return 'fog'
  if (c === 3) return 'clouds'
  return day ? 'clear' : 'night'
}

/** A nudge for the day, based on the forecast. */
function advice(w: Wx): string {
  const c = w.code
  if (c >= 95) return 'Storms around. A good day to work indoors and stay put.'
  if (c >= 71 && c <= 77 || c === 85 || c === 86) return 'Snow today. Leave extra time if you are heading out.'
  if (w.rain >= 50 || (c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return `${w.rain >= 50 ? `${w.rain}% chance of rain. ` : ''}Good day for indoor work. Bring an umbrella if you go out.`
  const hot = usUnits() ? 90 : 32; const cold = usUnits() ? 32 : 0
  if (w.hi >= hot) return 'Hot one. Plan outdoor time for the morning or evening.'
  if (w.hi <= cold) return 'Bitterly cold. Dress warm if you go out.'
  if (c <= 1 && w.day) return 'Lovely out. Worth a walk or a break outside.'
  return ''
}

function cached(): Wx | null {
  try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); return c && Date.now() - c.at < TTL ? c.wx : null } catch { return null }
}
function savedCity(): City | null { try { return JSON.parse(localStorage.getItem(CITY) || 'null') } catch { return null } }

async function fetchWx(lat: number, lon: number, place?: string): Promise<Wx> {
  const [f, g] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,is_day&hourly=temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset&timezone=auto&forecast_days=6${usUnits() ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : ''}`).then(r => r.json()),
    place ? Promise.resolve({ city: place }) : fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`).then(r => r.json()).catch(() => ({})),
  ])
  return {
    place: g.city || g.locality || g.principalSubdivision || 'Your location',
    temp: Math.round(f.current.temperature_2m), code: f.current.weather_code, wind: Math.round(f.current.wind_speed_10m), day: !!f.current.is_day,
    hi: Math.round(f.daily.temperature_2m_max[0]), lo: Math.round(f.daily.temperature_2m_min[0]), rain: Math.round(f.daily.precipitation_probability_max?.[0] ?? 0),
    hour: Number(String(f.current.time).slice(11, 13)) || 0,
    days: [0, 1, 2, 3, 4, 5].map(i => ({
      d: i === 0 ? 'Today' : new Date(f.daily.time[i] + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' }),
      code: f.daily.weather_code[i], hi: Math.round(f.daily.temperature_2m_max[i]), lo: Math.round(f.daily.temperature_2m_min[i]),
      rain: Math.round(f.daily.precipitation_probability_max?.[i] ?? 0), wind: Math.round(f.daily.wind_speed_10m_max?.[i] ?? 0),
      temps: (f.hourly.temperature_2m as number[]).slice(i * 24, i * 24 + 24).map(Math.round),
      sunrise: String(f.daily.sunrise?.[i] ?? ''), sunset: String(f.daily.sunset?.[i] ?? ''),
    })),
  }
}

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`

/** The day's temperature hour by hour, as a line you can scrub across. */
function TempLine({ day, nowHour }: { day: Day; nowHour: number | null }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 400, H = 104, PX = 12, PT = 22, PB = 18
  const t = day.temps
  if (t.length < 2) return null
  const lo = Math.min(...t), hi = Math.max(...t), span = Math.max(hi - lo, 1)
  const x = (i: number) => PX + (i / (t.length - 1)) * (W - PX * 2)
  const y = (v: number) => PT + (1 - (v - lo) / span) * (H - PT - PB)
  const pts = t.map((v, i) => [x(i), y(v)] as const)
  let line = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) { const mx = (pts[i - 1][0] + pts[i][0]) / 2; line += ` C${mx},${pts[i - 1][1]} ${mx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}` }
  const area = `${line} L${pts[pts.length - 1][0]},${H - PB} L${pts[0][0]},${H - PB} Z`
  const hiI = t.indexOf(hi), loI = t.indexOf(lo)
  const at = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(Math.max(0, Math.min(t.length - 1, Math.round(((e.clientX - r.left) / r.width * W - PX) / (W - PX * 2) * (t.length - 1)))))
  }
  const hv = hover !== null ? hover : nowHour
  const tipX = hv !== null ? Math.min(Math.max(x(hv), 40), W - 40) : 0
  return (
    <svg className="wx-line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Temperature through ${day.d === 'Today' ? 'today' : day.d}: low ${day.lo}°, high ${day.hi}°`}
      onPointerMove={at} onPointerDown={at} onPointerLeave={() => setHover(null)}>
      <defs><linearGradient id="wx-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
      {[0, 6, 12, 18, 23].map(h => <text key={h} x={x(h)} y={H - 3} className="wx-ax" textAnchor={h === 0 ? 'start' : h === 23 ? 'end' : 'middle'}>{h === 23 ? '11p' : hourLabel(h)}</text>)}
      <path d={area} fill="url(#wx-fill)" />
      <path d={line} className="wx-ln" />
      {hv !== null && <line x1={x(hv)} x2={x(hv)} y1={PT - 6} y2={H - PB} className="wx-cursor" />}
      {hover === null && <>
        <text x={x(hiI)} y={y(hi) - 8} className="wx-pt" textAnchor="middle">{hi}°</text>
        <text x={x(loI)} y={y(lo) + 15} className="wx-pt" textAnchor="middle">{lo}°</text>
      </>}
      {hv !== null && <>
        <circle cx={x(hv)} cy={y(t[hv])} r="4.5" className="wx-dot" />
        <text x={tipX} y={14} className="wx-pt" textAnchor="middle">{hover === null ? 'Now' : hourLabel(hv)} · {t[hv]}°</text>
      </>}
    </svg>
  )
}

/** Weather for where you are (or a city you pick): the first thing on Today. Open-Meteo, no key needed. */
export default function WeatherCard() {
  const [wx, setWx] = useState<Wx | null>(cached)
  const [msg, setMsg] = useState('')
  const [city, setCity] = useState<City | null>(savedCity)
  const [edit, setEdit] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState(0)

  // settings changed (units or location): drop the cache and fetch again
  useEffect(() => {
    let sig = JSON.stringify([getPrefs().units, localStorage.getItem(CITY)])
    const on = () => { const n = JSON.stringify([getPrefs().units, localStorage.getItem(CITY)]); if (n === sig) return; sig = n; try { localStorage.removeItem(KEY) } catch { /* ignore */ } setCity(savedCity()); setWx(null); setMsg('') }
    window.addEventListener('tm-prefs', on); return () => window.removeEventListener('tm-prefs', on)
  }, [])
  useEffect(() => {
    if (wx) return
    let off = false
    const done = (w: Wx) => { if (off) return; setWx(w); try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), wx: w })) } catch { /* private mode */ } }
    const fail = () => { if (!off) setMsg('Could not load the weather right now.') }
    if (city) { fetchWx(city.lat, city.lon, city.name).then(done, fail); return () => { off = true } }
    if (!('geolocation' in navigator)) { setMsg('Location is not available here. Pick a city instead.'); return }
    navigator.geolocation.getCurrentPosition(p => fetchWx(p.coords.latitude, p.coords.longitude).then(done, fail),
      () => { if (!off) setMsg('Location is blocked. Pick a city to see the weather.') }, { timeout: 10000, maximumAge: 30 * 6e4 })
    return () => { off = true }
  }, [wx, city])

  async function pick(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    setBusy(true); setMsg('')
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=1`).then(x => x.json())
      const hit = r.results?.[0]
      if (!hit) { setMsg(`No place found for "${q.trim()}".`); return }
      const c = { name: [hit.name, hit.admin1].filter(Boolean).join(', '), lat: hit.latitude, lon: hit.longitude }
      try { localStorage.setItem(CITY, JSON.stringify(c)); localStorage.removeItem(KEY) } catch { /* private mode */ }
      setCity(c); setWx(null); setEdit(false); setQ('')
    } catch { setMsg('Could not look that up. Try again.') } finally { setBusy(false) }
  }
  function useMine() {
    try { localStorage.removeItem(CITY); localStorage.removeItem(KEY) } catch { /* private mode */ }
    setCity(null); setWx(null); setEdit(false); setMsg('')
  }

  const picker = edit ? (
    <form className="wx-pick" onSubmit={pick}>
      <input autoFocus placeholder="City, e.g. Chicago" value={q} onChange={e => setQ(e.target.value)} aria-label="City" />
      <button className="wx-set" disabled={busy || !q.trim()}>Set</button>
      <button type="button" className="wx-link" onClick={useMine}>Use my location</button>
    </form>
  ) : null

  if (!wx) return (
    <section className="weather wx-clouds">
      <div className="wx-main"><p className="wx-line" style={{ margin: 0 }}>{msg || 'Getting the weather…'}</p>{picker}</div>
      {!edit && msg && <button className="wx-link" onClick={() => setEdit(true)}>Pick a city</button>}
    </section>
  )
  const [ico, label] = describe(wx.code)
  const tip = advice(wx)
  const m = mood(wx.code, wx.day) + (!wx.day && mood(wx.code, wx.day) !== 'storm' ? ' is-night' : '')
  return (
    <section className={`weather wx-${m}`} aria-label="Current weather">
      <div className="wx-left">
        <div className="wx-now">
          <span className="wx-ico" aria-hidden><Icon name={ico} size={52} /></span>
          <div>
            <div className="wx-temp">{wx.temp}°</div>
            <div className="wx-cond">{label} · {wx.place} <button type="button" className="wx-edit" aria-label="Change location" title="Change location" onClick={() => setEdit(e => !e)}><Icon name="pen" size={13} /></button></div>
          </div>
        </div>
        <div className="wx-chips"><span><Icon name="up" size={12} /> {wx.hi}°</span><span><Icon name="down" size={12} /> {wx.lo}°</span><span><Icon name="wind" size={12} /> {wx.wind}</span><span><Icon name="drop" size={12} /> {wx.rain}%</span></div>
        {tip && <p className="wx-tip">{tip}</p>}
        {picker}
        {msg && <span className="wx-err">{msg}</span>}
      </div>
      <div className="wx-days">
        {wx.days.map((d, i) => (
          <button type="button" className={`wx-d ${i === sel ? 'on' : ''}`} key={d.d} aria-pressed={i === sel} onClick={() => setSel(i)} title={`${describe(d.code)[1]}, ${d.hi}° / ${d.lo}°`}>
            <span>{d.d}</span><Icon name={describe(d.code)[0]} size={24} /><b>{d.hi}°</b><small>{d.lo}°</small>
          </button>
        ))}
      </div>
      <div className="wx-detail">
        <div className="wx-detail-head">
          <b>{sel === 0 ? 'Today' : wx.days[sel].d}</b>
          <span>{describe(wx.days[sel].code)[1]}</span>
          <span><Icon name="drop" size={12} /> {wx.days[sel].rain}%</span>
          <span><Icon name="wind" size={12} /> {wx.days[sel].wind}</span>
        </div>
        <TempLine day={wx.days[sel]} nowHour={sel === 0 ? wx.hour : null} />
      </div>
    </section>
  )
}
