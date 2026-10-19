import { useEffect, useState } from 'react'
import Icon, { type IconName } from './Icon'
import { getPrefs } from '../lib/prefs'

interface Wx { place: string; temp: number; code: number; hi: number; lo: number; wind: number; rain: number; day: boolean; days: { d: string; code: number; hi: number }[] }
interface City { name: string; lat: number; lon: number }

const KEY = 'tm-weather2'; const CITY = 'tm-weather-city'
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
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=6${usUnits() ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : ''}`).then(r => r.json()),
    place ? Promise.resolve({ city: place }) : fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`).then(r => r.json()).catch(() => ({})),
  ])
  return {
    place: g.city || g.locality || g.principalSubdivision || 'Your location',
    temp: Math.round(f.current.temperature_2m), code: f.current.weather_code, wind: Math.round(f.current.wind_speed_10m), day: !!f.current.is_day,
    hi: Math.round(f.daily.temperature_2m_max[0]), lo: Math.round(f.daily.temperature_2m_min[0]), rain: Math.round(f.daily.precipitation_probability_max?.[0] ?? 0),
    days: [1, 2, 3, 4, 5].map(i => ({ d: new Date(f.daily.time[i] + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' }), code: f.daily.weather_code[i], hi: Math.round(f.daily.temperature_2m_max[i]) })),
  }
}

/** Weather for where you are (or a city you pick): the first thing on Today. Open-Meteo, no key needed. */
export default function WeatherCard() {
  const [wx, setWx] = useState<Wx | null>(cached)
  const [msg, setMsg] = useState('')
  const [city, setCity] = useState<City | null>(savedCity)
  const [edit, setEdit] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

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
            <div className="wx-cond">{label} · {wx.place}</div>
          </div>
        </div>
        <div className="wx-chips"><span><Icon name="up" size={12} /> {wx.hi}°</span><span><Icon name="down" size={12} /> {wx.lo}°</span><span><Icon name="wind" size={12} /> {wx.wind}</span><span><Icon name="drop" size={12} /> {wx.rain}%</span></div>
        {tip && <p className="wx-tip">{tip}</p>}
        {picker || <button className="wx-link" onClick={() => setEdit(true)}>Change location</button>}
        {msg && <span className="wx-err">{msg}</span>}
      </div>
      <div className="wx-days">
        {wx.days.map(d => <div className="wx-d" key={d.d}><span>{d.d}</span><Icon name={describe(d.code)[0]} size={24} /><b>{d.hi}°</b></div>)}
      </div>
    </section>
  )
}
