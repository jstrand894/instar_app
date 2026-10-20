import { useEffect, useState } from 'react'
import { guest, supabase } from '../lib/supabase'
import { ACCENTS, getPrefs, setPrefs, type Theme, type Units } from '../lib/prefs'
import { isDesktop } from '../lib/util'
import Logo from './Logo'

const PersonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
)

export default function Account({ signOut }: { signOut: (() => void) | null }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { const on = () => setOpen(true); window.addEventListener('tm-open-account', on); return () => window.removeEventListener('tm-open-account', on) }, [])
  return (
    <>
      <button className="account-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <PersonIcon /><span>Account</span>
      </button>
      {open && <AccountDialog signOut={signOut} onClose={() => setOpen(false)} />}
    </>
  )
}

type Tab = 'profile' | 'appearance' | 'today' | 'weather' | 'timer' | 'about'

function AccountDialog({ signOut, onClose }: { signOut: (() => void) | null; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('profile')
  const [email, setEmail] = useState<string | null>(null)
  const [prefs, setLocal] = useState(getPrefs)

  useEffect(() => { supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null)) }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const saveName = async (v: string) => {
    const name = v.trim(); setPrefs({ name }); setLocal(getPrefs())
    if (supabase) await supabase.auth.updateUser({ data: { display_name: name } }).catch(() => {})
  }
  const update = (patch: Parameters<typeof setPrefs>[0]) => { setPrefs(patch); setLocal(getPrefs()) }
  const pomo = (k: 'focus' | 'short' | 'long', v: string) => {
    const n = Math.min(180, Math.max(1, Math.round(Number(v) || 1))); update({ pomo: { ...prefs.pomo, [k]: n } })
  }

  const tabs = [
    ['profile', 'Profile'], ['appearance', 'Appearance'], ['today', 'Today'], ['weather', 'Weather & dates'],
    ...(isDesktop() ? [['timer', 'Timer']] : []), ['about', 'About'],
  ] as [Tab, string][]

  return (
    <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal settings" role="dialog" aria-modal="true" aria-label="Account">
        <nav className="set-nav" aria-label="Settings sections">
          <h2>Account</h2>
          <div className="set-tabs">
            {tabs.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
          </div>
          <div className="set-nav-foot">
            {signOut && <button className="danger-btn" onClick={signOut}>{guest ? 'Sign in' : 'Sign out'}</button>}
          </div>
        </nav>

        <div className="set-main">
          <button className="close-x" onClick={onClose} aria-label="Close">×</button>

          {tab === 'profile' && (
            <div className="set-pane">
              <div className="who">
                <span className="avatar">{(email ?? '?')[0].toUpperCase()}</span>
                <div><b>{email ?? 'Demo mode'}</b><div className="muted small">{email ? 'Signed in' : 'Data stays in this browser only'}</div></div>
              </div>
              <section>
                <h3>Your name</h3>
                <input key={prefs.name} defaultValue={prefs.name} placeholder="Used in your Today greeting" autoComplete="given-name" onBlur={e => saveName(e.target.value)} />
              </section>
              <section>
                <h3>Help</h3>
                <button onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new Event('tm-tour')), 50) }}>Replay tour</button>
              </section>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="set-pane">
              <section>
                <h3>Theme</h3>
                <div className="seg" role="group" aria-label="Theme">
                  {(['system', 'light', 'dark'] as Theme[]).map(t => (
                    <button key={t} className={prefs.theme === t ? 'on' : ''} onClick={() => update({ theme: t })}>{t[0].toUpperCase() + t.slice(1)}</button>
                  ))}
                </div>
                <div className="swatches" role="group" aria-label="Accent color">
                  {ACCENTS.map(a => (
                    <button key={a.id} className={`swatch ${prefs.accent === a.id ? 'on' : ''}`} style={{ background: a.light }} title={a.label}
                      onClick={() => update({ accent: a.id })} aria-label={a.label} aria-pressed={prefs.accent === a.id} />
                  ))}
                </div>
                <p className="muted small">Saved on this device, so your Mac, iPad and iPhone can each look different.</p>
              </section>
              <section>
                <div className="set-row">
                  <span><b>Density</b><span className="muted small">Compact fits more on screen</span></span>
                  <div className="seg" role="group" aria-label="Density">
                    {(['comfortable', 'compact'] as const).map(d => <button key={d} className={prefs.density === d ? 'on' : ''} onClick={() => update({ density: d })}>{d[0].toUpperCase() + d.slice(1)}</button>)}
                  </div>
                </div>
                <div className="set-row">
                  <span><b>Animations</b><span className="muted small">Turn off to reduce motion</span></span>
                  <div className="seg" role="group" aria-label="Animations">
                    <button className={prefs.motion === 'system' ? 'on' : ''} onClick={() => update({ motion: 'system' })}>On</button>
                    <button className={prefs.motion === 'reduce' ? 'on' : ''} onClick={() => update({ motion: 'reduce' })}>Reduced</button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'today' && (
            <div className="set-pane">
              <section>
                <div className="set-row">
                  <span><b>Today screen</b><span className="muted small">Choose which cards appear{prefs.todayHidden.length ? ` (${prefs.todayHidden.length} hidden)` : ''}</span></span>
                  <button onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new Event('tm-customize-today')), 50) }}>Customize…</button>
                </div>
                <div className="set-row">
                  <span><b>Remember where I was</b><span className="muted small">Returning to Projects or Manuscripts reopens the one you last had open</span></span>
                  <div className="seg" role="group" aria-label="Remember last project">
                    <button className={prefs.resumeLast ? 'on' : ''} onClick={() => update({ resumeLast: true })}>On</button>
                    <button className={!prefs.resumeLast ? 'on' : ''} onClick={() => update({ resumeLast: false })}>Off</button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'weather' && (
            <div className="set-pane">
              <section>
                <div className="set-row">
                  <span><b>Temperature</b></span>
                  <div className="seg" role="group" aria-label="Temperature units">
                    {([['auto', 'Auto'], ['f', '°F'], ['c', '°C']] as [Units, string][]).map(([u, l]) => <button key={u} className={prefs.units === u ? 'on' : ''} onClick={() => update({ units: u })}>{l}</button>)}
                  </div>
                </div>
                <div className="set-row">
                  <span><b>Week starts on</b><span className="muted small">For focus time and the weekly review</span></span>
                  <div className="seg" role="group" aria-label="Week starts on">
                    <button className={prefs.weekStart === 1 ? 'on' : ''} onClick={() => update({ weekStart: 1 })}>Monday</button>
                    <button className={prefs.weekStart === 0 ? 'on' : ''} onClick={() => update({ weekStart: 0 })}>Sunday</button>
                  </div>
                </div>
                <div className="set-row">
                  <span><b>Weather location</b><span className="muted small">Uses your device location unless you pick a city on Today</span></span>
                  <button onClick={() => { try { localStorage.removeItem('tm-weather-city'); localStorage.removeItem('tm-weather2') } catch { /* ignore */ } update({}) }}>Use my location</button>
                </div>
              </section>
            </div>
          )}

          {tab === 'timer' && (
            <div className="set-pane">
              <section>
                <h3>Pomodoro timer</h3>
                <div className="pomo-prefs">
                  <label>Focus<input type="number" min={1} max={180} value={prefs.pomo.focus} onChange={e => pomo('focus', e.target.value)} /></label>
                  <label>Break<input type="number" min={1} max={180} value={prefs.pomo.short} onChange={e => pomo('short', e.target.value)} /></label>
                  <label>Long break<input type="number" min={1} max={180} value={prefs.pomo.long} onChange={e => pomo('long', e.target.value)} /></label>
                </div>
                <p className="muted small">Minutes. A running timer keeps its length until it is reset.</p>
              </section>
            </div>
          )}

          {tab === 'about' && (
            <div className="set-pane about">
              <div className="about-logo"><Logo size={64} /></div>
              <h2>Instar</h2>
              <p className="muted small">Version {__APP_VERSION__}</p>
              <p>A personal research workspace for projects, manuscripts and reading, on a Mac, iPad and iPhone.</p>
              <p className="muted small">An <i>instar</i> is the stage between molts in an insect's growth. Every project and manuscript moves through stages too.</p>
              <p className="creator">Made by <b>Jackson R. Strand</b>
                <a className="info-i" href="https://jackson-strand.com" target="_blank" rel="noopener noreferrer" aria-label="Jackson R. Strand's website" title="jackson-strand.com">i</a>
              </p>
              <p className="muted small">Built with React, Supabase and PDF.js.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
