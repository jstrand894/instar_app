import { ACCENTS } from './prefs'
import { dayKey, levelOf, type Game, type Totals } from './game'
import type { IconName } from '../components/Icon'

/** Your title at each level, climbing the insect world. */
export const RANKS = [
  { level: 1, name: 'Aphid' }, { level: 2, name: 'Gnat' }, { level: 3, name: 'Ant' }, { level: 4, name: 'Cricket' },
  { level: 5, name: 'Ladybug' }, { level: 6, name: 'Honeybee' }, { level: 7, name: 'Firefly' }, { level: 8, name: 'Dragonfly' },
  { level: 10, name: 'Praying Mantis' }, { level: 12, name: 'Monarch' }, { level: 15, name: 'Luna Moth' },
  { level: 18, name: 'Stag Beetle' }, { level: 22, name: 'Hercules Beetle' }, { level: 27, name: 'Queen Bee' },
] as const

export const rankFor = (level: number) => [...RANKS].reverse().find(r => r.level <= level) ?? RANKS[0]
export const nextRank = (level: number) => RANKS.find(r => r.level > level) ?? null

/** What reaching a level gives you, in words. */
export function unlocksAt(level: number): string[] {
  const out: string[] = []
  const r = RANKS.find(x => x.level === level); if (r) out.push(`new rank: ${r.name}`)
  for (const a of ACCENTS) if (a.level === level && level > 1) out.push(`${a.label} accent colour`)
  if (level > 1) out.push('a streak freeze')
  return out
}

export interface BadgeDef { id: string; label: string; hint: string; icon: IconName; need: number; have: (t: Totals, g: Game) => number }
export const BADGES: BadgeDef[] = [
  { id: 'task-1', label: 'First step', hint: 'Finish a to-do', icon: 'task', need: 1, have: t => t.tasks },
  { id: 'task-100', label: 'Century', hint: 'Finish 100 to-dos', icon: 'task', need: 100, have: t => t.tasks },
  { id: 'task-500', label: 'Workhorse', hint: 'Finish 500 to-dos', icon: 'task', need: 500, have: t => t.tasks },
  { id: 'paper-1', label: 'Bookworm', hint: 'Read a paper', icon: 'quote', need: 1, have: t => t.papers },
  { id: 'paper-25', label: 'Well read', hint: 'Read 25 papers', icon: 'quote', need: 25, have: t => t.papers },
  { id: 'paper-100', label: 'Scholar', hint: 'Read 100 papers', icon: 'quote', need: 100, have: t => t.papers },
  { id: 'focus-10', label: 'Ten hours deep', hint: 'Focus for 10 hours in total', icon: 'clock', need: 600, have: t => t.minutes },
  { id: 'focus-50', label: 'Deep diver', hint: 'Focus for 50 hours in total', icon: 'clock', need: 3000, have: t => t.minutes },
  { id: 'focus-100', label: 'Hundred hour club', hint: 'Focus for 100 hours in total', icon: 'clock', need: 6000, have: t => t.minutes },
  { id: 'streak-7', label: 'Week on', hint: 'Reach a 7-day streak', icon: 'flame', need: 7, have: (_, g) => g.best },
  { id: 'streak-14', label: 'Fortnight', hint: 'Reach a 14-day streak', icon: 'flame', need: 14, have: (_, g) => g.best },
  { id: 'streak-30', label: 'Unbroken month', hint: 'Reach a 30-day streak', icon: 'flame', need: 30, have: (_, g) => g.best },
  { id: 'field-1', label: 'Boots on the ground', hint: 'Log a field visit', icon: 'mapPin', need: 1, have: t => t.visits },
  { id: 'field-10', label: 'Regular', hint: 'Log 10 field visits', icon: 'mapPin', need: 10, have: t => t.visits },
  { id: 'sent', label: 'Sent it', hint: 'Submit a manuscript', icon: 'pen', need: 1, have: t => t.submitted },
  { id: 'accepted', label: 'Accepted', hint: 'Get a manuscript accepted', icon: 'star', need: 1, have: t => t.accepted },
  { id: 'quest-1', label: 'Triple threat', hint: 'Finish all three daily goals in a day', icon: 'bolt', need: 1, have: t => t.questDays },
  { id: 'quest-10', label: 'Goal getter', hint: 'Finish all three daily goals on 10 days', icon: 'bolt', need: 10, have: t => t.questDays },
  { id: 'update-50', label: 'Chronicler', hint: 'Log 50 updates and notes', icon: 'list', need: 50, have: t => t.updates },
  { id: 'routine-50', label: 'Creature of habit', hint: 'Tick off 50 routines', icon: 'check', need: 50, have: t => t.routines },
  { id: 'level-5', label: 'Ladybug', hint: 'Reach level 5', icon: 'bug', need: 5, have: (_, g) => g.level },
  { id: 'level-10', label: 'Mantis', hint: 'Reach level 10', icon: 'bug', need: 10, have: (_, g) => g.level },
]
export const earnedBadges = (g: Game) => BADGES.filter(b => b.have(g.totals, g) >= b.need)

export const accentLocked = (a: { level: number }, level: number | undefined) => level != null && a.level > level

/** Totals for the seven days starting at `start`, compared with the seven before. */
export function weekRecap(g: Game, start: Date) {
  const day = (i: number) => g.byDay[dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))]
  const sum = (from: number) => {
    const days = Array.from({ length: 7 }, (_, i) => day(from + i))
    return { xp: days.reduce((a, d) => a + (d?.xp ?? 0), 0), tasks: days.reduce((a, d) => a + (d?.tasks ?? 0), 0), minutes: days.reduce((a, d) => a + (d?.minutes ?? 0), 0), other: days.reduce((a, d) => a + (d?.other ?? 0), 0), active: days.filter(d => d && d.xp > 0).length, days }
  }
  const cur = sum(0), prev = sum(-7)
  let bestIdx = -1; cur.days.forEach((d, i) => { if (d && d.xp > 0 && (bestIdx < 0 || d.xp > cur.days[bestIdx]!.xp)) bestIdx = i })
  const best = bestIdx < 0 ? null : { date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + bestIdx), xp: cur.days[bestIdx]!.xp }
  // levels gained: XP at the start of the week versus XP at its end
  const before = Object.entries(g.byDay).filter(([k]) => k < dayKey(start)).reduce((a, [, d]) => a + d.xp, 0)
  const levelBefore = levelOf(before), levelAfter = levelOf(before + cur.xp)
  return { ...cur, prevXp: prev.xp, best, levelBefore, levelAfter }
}
