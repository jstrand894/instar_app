import { useCallback, useEffect, useState } from 'react'
import BackButton from '../components/BackButton'
import Icon from '../components/Icon'
import Recap from '../components/Recap'
import RescueFreeze from '../components/RescueFreeze'
import { useGame, xpFor } from '../lib/game'
import { ACCENTS, setPrefs, usePrefs } from '../lib/prefs'
import { BADGES, RANKS, accentLocked, earnedBadges, nextRank, rankFor, unlocksAt } from '../lib/rewards'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import type { Reward } from '../types'

export default function Rewards() {
  const g = useGame()
  const prefs = usePrefs()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState('')
  const load = useCallback(() => { store.rewards().then(setRewards).catch(() => setRewards([])) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { window.addEventListener('tm-data', load); return () => window.removeEventListener('tm-data', load) }, [load])
  if (!g) return <div className="page"><div className="today-skel"><div className="sk sk-card" /></div></div>

  const rank = rankFor(g.level), next = nextRank(g.level)
  const done = earnedBadges(g), doneIds = new Set(done.map(b => b.id))
  const pct = Math.round((g.into / g.span) * 100)
  const target = +level || g.level + 1
  async function addReward(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || target <= 0) return
    try { await store.addReward({ title: title.trim(), level: target }); setTitle(''); setLevel(''); notify.added(); load() } catch (er) { notify.error(er) }
  }
  const mine = [...rewards].sort((a, b) => a.level - b.level)

  return (
    <div className="page rewards">
      <header className="page-head">
        <div className="title-row"><h1>Rewards</h1><BackButton /></div>
      </header>

      <section className="card rw-hero">
        <span className="rw-ring"><Icon name="bug" size={34} /></span>
        <div className="rw-hero-text">
          <p className="muted small">Level {g.level}</p>
          <h2>{rank.name}</h2>
          <span className="lvl-bar wide" aria-label={`${pct}% of the way to level ${g.level + 1}`}><i style={{ width: `${pct}%` }} /></span>
          <p className="muted small">{g.xp.toLocaleString()} XP · {(g.span - g.into).toLocaleString()} to level {g.level + 1}{next ? ` · ${next.name} at level ${next.level}` : ' · top rank reached'}</p>
          {unlocksAt(g.level + 1).length > 0 && <p className="small">Level {g.level + 1} unlocks: {unlocksAt(g.level + 1).join(', ')}.</p>}
        </div>
      </section>

      <div className="today-grid rw-grid">
        <section className="card">
          <h2><Icon name="snow" size={16} /> Streak freezes <span className="count-pill">{g.freezes}</span></h2>
          <p className="muted small">You earn one for every level you reach. If you miss a day, spend one to keep your streak alive. It can be used on yesterday only, and the streak must already be at least 2 days.</p>
          <RescueFreeze g={g} />
          {!g.rescue && <p className="small">{g.freezes ? `You have ${g.freezes} ready. The offer appears here and on Today the day after a missed day.` : 'None in the bank. Reach the next level to earn one.'}</p>}
        </section>

        <section className="card">
          <h2><Icon name="star" size={16} /> Accent colours</h2>
          <div className="rw-swatches">
            {ACCENTS.map(a => {
              const locked = accentLocked(a, g.level) && prefs.accent !== a.id
              return (
                <button key={a.id} className={`rw-swatch ${prefs.accent === a.id ? 'current' : ''}`} disabled={locked} onClick={() => setPrefs({ accent: a.id })} aria-pressed={prefs.accent === a.id}
                  title={locked ? `Unlocks at level ${a.level}` : a.label}>
                  <i style={{ background: a.light }}>{locked && <Icon name="lock" size={14} />}</i>
                  <span>{a.label}</span><small>{locked ? `Level ${a.level}` : prefs.accent === a.id ? 'In use' : 'Unlocked'}</small>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <Recap g={g} />

      <section className="card">
        <h2><Icon name="bug" size={16} /> Ranks</h2>
        <ol className="rw-ranks">
          {RANKS.map(r => (
            <li key={r.name} className={r.level <= g.level ? (r.name === rank.name ? 'now' : 'got') : ''}>
              <b>{r.name}</b><span className="muted small">{r.level <= g.level ? (r.name === rank.name ? 'You are here' : `Level ${r.level}`) : `Level ${r.level} · ${(xpFor(r.level) - g.xp).toLocaleString()} XP to go`}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2><Icon name="trophy" size={16} /> Badges <span className="count-pill">{done.length}/{BADGES.length}</span></h2>
        <div className="rw-badges">
          {BADGES.map(b => {
            const have = Math.min(b.need, b.have(g.totals, g)), got = doneIds.has(b.id)
            const shown = b.id.startsWith('focus') ? `${Math.floor(have / 60)}/${b.need / 60} h` : `${have}/${b.need}`
            return (
              <div key={b.id} className={`rw-badge ${got ? 'got' : ''}`} title={b.hint}>
                <span className="rw-badge-ico"><Icon name={got ? b.icon : 'lock'} size={20} /></span>
                <b>{b.label}</b>
                <span className="muted small">{b.hint}</span>
                {!got && <span className="rw-bar" aria-hidden><i style={{ width: `${(have / b.need) * 100}%` }} /></span>}
                <small className="muted">{got ? 'Earned' : shown}</small>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card">
        <h2><Icon name="gift" size={16} /> Your rewards</h2>
        <p className="muted small">Name a treat and the level that earns it. When you reach that level the app tells you to claim it.</p>
        <form className="row wrap rw-form" onSubmit={addReward}>
          <input placeholder="e.g. Coffee at the good place" value={title} onChange={e => setTitle(e.target.value)} />
          <label className="rw-level">at level <input type="number" min={1} inputMode="numeric" placeholder={String(g.level + 1)} value={level} onChange={e => setLevel(e.target.value)} /></label>
          <button className="primary" disabled={!title.trim()}>Add</button>
        </form>
        <ul className="rw-list">
          {mine.map(r => {
            const open = r.level <= g.level
            return (
              <li key={r.id} className={r.claimed_at ? 'claimed' : open ? 'ready' : ''}>
                <span className="pill">Level {r.level}</span>
                <span className="rw-title">{r.title}</span>
                {r.claimed_at ? <span className="muted small">Claimed</span>
                  : open ? <button className="primary" onClick={() => store.patchReward(r.id, { claimed_at: new Date().toISOString() }).then(load, e => notify.error(e))}>Claim</button>
                  : <span className="muted small">{(xpFor(r.level) - g.xp).toLocaleString()} XP to go</span>}
                <button className="link small danger" onClick={() => notify.undoable(`Removed "${r.title}"`, () => store.deleteReward(r.id), [r.id])}>Remove</button>
              </li>
            )
          })}
          {!mine.length && <li className="muted">No rewards yet.</li>}
        </ul>
      </section>
    </div>
  )
}
