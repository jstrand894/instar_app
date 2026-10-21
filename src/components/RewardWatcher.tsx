import { useEffect, useRef } from 'react'
import { useGame } from '../lib/game'
import { ACCENTS } from '../lib/prefs'
import { earnedBadges, rankFor } from '../lib/rewards'
import { store } from '../lib/store'
import { notify } from '../lib/notify'

const KEY = 'tm-seen-rewards-v1'
interface Seen { level: number; badges: string[]; rewards: string[] }
const read = (): Seen | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null } }
const write = (s: Seen) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ } }

/** Announces a new level (and what it unlocks), new badges, and your own rewards coming due. Quiet the first time, so history is not announced. */
export default function RewardWatcher() {
  const g = useGame()
  const busy = useRef(false)
  useEffect(() => {
    if (!g || busy.current) return
    busy.current = true
    ;(async () => {
      try {
        const rewards = await store.rewards().catch(() => [])
        const badges = earnedBadges(g)
        const due = rewards.filter(r => r.level <= g.level && !r.claimed_at)
        const seen = read()
        if (!seen) { write({ level: g.level, badges: badges.map(b => b.id), rewards: due.map(r => r.id) }); return }
        if (g.level > seen.level) {
          const gained = g.level - seen.level
          const colours = ACCENTS.filter(a => a.level > seen.level && a.level <= g.level).map(a => a.label)
          const ups = [...colours.length ? [`${colours.join(', ')} accent colour${colours.length > 1 ? 's' : ''}`] : [], `${gained} streak freeze${gained > 1 ? 's' : ''}`]
          notify.success(`Level ${g.level}, ${rankFor(g.level).name}${rankFor(g.level).name !== rankFor(seen.level).name ? ' (new rank)' : ''}. Unlocked: ${ups.join(' and ')}.`, 9000)
        }
        const fresh = badges.filter(b => !seen.badges.includes(b.id))
        if (fresh.length) notify.success(`Badge${fresh.length > 1 ? 's' : ''} earned: ${fresh.map(b => b.label).join(', ')}`, 7000)
        for (const r of due.filter(x => !seen.rewards.includes(x.id)))
          notify.action(`Reward unlocked: ${r.title}`, 'Claim', () => { store.patchReward(r.id, { claimed_at: new Date().toISOString() }).catch(e => notify.error(e)) }, 12000)
        write({ level: Math.max(seen.level, g.level), badges: [...new Set([...seen.badges, ...badges.map(b => b.id)])], rewards: [...new Set([...seen.rewards, ...due.map(r => r.id)])] })
      } finally { busy.current = false }
    })()
  }, [g])
  return null
}
