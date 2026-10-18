import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ACCENTS, getPrefs, setPrefs, type Theme } from '../lib/prefs'
import { isDesktop } from '../lib/util'

const PersonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
)

export default function Account({ signOut }: { signOut: (() => void) | null }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="account-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <PersonIcon /><span>Account</span>
      </button>
      {open && <AccountDialog signOut={signOut} onClose={() => setOpen(false)} />}
    </>
  )
}

function AccountDialog({ signOut, onClose }: { signOut: (() => void) | null; onClose: () => void }) {
  const [view, setView] = useState<'settings' | 'about'>('settings')
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

  return (
    <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Account">
        <div className="modal-head">
          {view === 'about' ? <button className="link" onClick={() => setView('settings')}>← Account</button> : <h2>Account</h2>}
          <button className="close-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {view === 'settings' ? (
          <div className="modal-body">
            <div className="who">
              <span className="avatar">{(email ?? '?')[0].toUpperCase()}</span>
              <div><b>{email ?? 'Demo mode'}</b><div className="muted small">{email ? 'Signed in' : 'Data stays in this browser only'}</div></div>
            </div>

            <section>
              <h3>Your name</h3>
              <input key={prefs.name} defaultValue={prefs.name} placeholder="Used in your Today greeting" autoComplete="given-name" onBlur={e => saveName(e.target.value)} />
            </section>

            <section>
              <h3>Appearance</h3>
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
              <p className="muted small">These settings are saved on this device, so your Mac, iPad and iPhone can each look different.</p>
            </section>

            {isDesktop() && (
              <section>
                <h3>Pomodoro timer</h3>
                <div className="pomo-prefs">
                  <label>Focus<input type="number" min={1} max={180} value={prefs.pomo.focus} onChange={e => pomo('focus', e.target.value)} /></label>
                  <label>Break<input type="number" min={1} max={180} value={prefs.pomo.short} onChange={e => pomo('short', e.target.value)} /></label>
                  <label>Long break<input type="number" min={1} max={180} value={prefs.pomo.long} onChange={e => pomo('long', e.target.value)} /></label>
                </div>
                <p className="muted small">Minutes. A running timer keeps its length until it is reset.</p>
              </section>
            )}

            <section className="acct-actions">
              <button onClick={() => setView('about')}>About this app</button>
              {signOut && <button className="danger-btn" onClick={signOut}>Sign out</button>}
            </section>
          </div>
        ) : (
          <div className="modal-body about">
            <div className="about-logo"><img className="logo" src="/icon.svg" alt="" width="72" height="72" /></div>
            <h2>Instar</h2>
            <p className="muted small">Version {__APP_VERSION__}</p>
            <p>A personal research workspace for keeping track of projects, manuscripts and reading, in one place that works on a Mac, iPad and iPhone.</p>
            <p className="muted small">An <i>instar</i> is the stage between molts in an insect's growth. Every project and manuscript moves through stages too.</p>
            <ul>
              <li><b>Projects and manuscripts</b> with dated timelines, notes, schedules and deadlines</li>
              <li><b>Reading</b> with a PDF reader, highlights, Apple Pencil notes and a recommended next read</li>
              <li><b>Today</b> view that pulls it all together</li>
            </ul>
            <p className="creator">Made by <b>Jackson Strand</b></p>
            <p className="muted small">Built with React, Supabase and PDF.js.</p>
          </div>
        )}
      </div>
    </div>
  )
}
