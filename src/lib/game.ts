import { useCallback, useEffect, useState } from 'react'
import { store } from './store'
import { getPrefs } from './prefs'
import type { Paper, ProjectTask, ProjectUpdate, RoutineCheck, TimeEntry } from '../types'

/** XP per action. Focus time earns 1 XP a minute, so a 25-minute session is worth 25. */
export const XP = { task: 10, routine: 5, paper: 20, update: 3, quest: 25 } as const

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** XP needed to reach a level: 100 for level 2, 300 for level 3, 600 for level 4, and so on. */
export const xpFor = (level: number) => 50 * level * (level - 1)

export interface Day { xp: number; tasks: number; minutes: number; other: number }
export interface Quest { id: string; label: string; have: number; need: number; done: boolean }
export interface Game {
  xp: number; level: number; into: number; span: number
  streak: number; best: number; frozen: boolean
  today: Day & { questBonus: boolean }; quests: Quest[]
  week: { d: Date; xp: number }[]
}

/** Everything is computed from history, so XP can never drift out of step with the data. */
export function computeGame(
  tasks: ProjectTask[], time: TimeEntry[], checks: RoutineCheck[], papers: Paper[], updates: ProjectUpdate[],
  focusGoal = 25, now = new Date(),
): Game {
  const days = new Map<string, Day>()
  const at = (k: string) => { let d = days.get(k); if (!d) days.set(k, d = { xp: 0, tasks: 0, minutes: 0, other: 0 }); return d }
  for (const t of tasks) if (t.done && t.done_at) { const d = at(dayKey(new Date(t.done_at))); d.xp += XP.task; d.tasks++ }
  for (const c of checks) { const d = at(c.on_date); d.xp += XP.routine; d.other++ }
  for (const p of papers) if (p.read_at) { const d = at(dayKey(new Date(p.read_at))); d.xp += XP.paper; d.other++ }
  for (const u of updates) if (u.kind !== 'commit') { const d = at(dayKey(new Date(u.created_at))); d.xp += XP.update; d.other++ }
  for (const t of time) { const d = at(dayKey(new Date(t.started_at))); d.xp += t.minutes; d.minutes += t.minutes }

  // a day with all three daily quests done earns a bonus
  const allQuests = (d: Day) => d.tasks >= 2 && d.minutes >= focusGoal && d.other >= 1
  for (const d of days.values()) if (allQuests(d)) d.xp += XP.quest

  const xp = [...days.values()].reduce((a, d) => a + d.xp, 0)
  let level = 1
  while (xp >= xpFor(level + 1)) level++
  const into = xp - xpFor(level), span = xpFor(level + 1) - xpFor(level)

  // streak: consecutive active days. One rest day in any seven is forgiven, and today never breaks it.
  const active = (d: Date) => (days.get(dayKey(d))?.xp ?? 0) > 0
  const run = (from: Date, earliest: Date) => {
    let n = 0, lastFreeze = -99, frozen = false
    for (let i = 0; ; i++) {
      const d = addDays(from, -i)
      if (d < earliest) break
      if (active(d)) { n++; continue }
      if (i === 0) continue
      if (i - lastFreeze > 6 && active(addDays(d, -1))) { lastFreeze = i; if (i <= 1) frozen = true; continue }
      break
    }
    return { n, frozen }
  }
  const keys = [...days.keys()].sort()
  const earliest = keys.length ? new Date(keys[0] + 'T00:00:00') : now
  const cur = run(now, earliest)
  let best = cur.n
  for (const k of keys) best = Math.max(best, run(new Date(k + 'T00:00:00'), earliest).n)

  const t = days.get(dayKey(now)) ?? { xp: 0, tasks: 0, minutes: 0, other: 0 }
  const quests: Quest[] = [
    { id: 'tasks', label: 'Finish 2 to-dos', have: Math.min(2, t.tasks), need: 2, done: t.tasks >= 2 },
    { id: 'focus', label: `Focus for ${focusGoal} minutes`, have: Math.min(focusGoal, t.minutes), need: focusGoal, done: t.minutes >= focusGoal },
    { id: 'other', label: 'Read a paper, tick a routine or log an update', have: Math.min(1, t.other), need: 1, done: t.other >= 1 },
  ]
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(now, i - 6); return { d, xp: days.get(dayKey(d))?.xp ?? 0 } })
  return { xp, level, into, span, streak: cur.n, best, frozen: cur.frozen, today: { ...t, questBonus: allQuests(t) }, quests, week }
}

/** Loads the data XP comes from and keeps it fresh whenever anything is saved. */
export function useGame(): Game | null {
  const [g, setG] = useState<Game | null>(null)
  const load = useCallback(async () => {
    try {
      const [tk, te, rc, pa, up] = await Promise.all([store.tasks(), store.timeEntries().catch(() => []), store.routineChecks().catch(() => []), store.papers(), store.updates()])
      setG(computeGame(tk, te, rc, pa, up, getPrefs().pomo.focus))
    } catch { /* leave the last value */ }
  }, [])
  useEffect(() => {
    load()
    window.addEventListener('tm-data', load)
    return () => window.removeEventListener('tm-data', load)
  }, [load])
  return g
}
