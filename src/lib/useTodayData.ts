import { useCallback, useEffect, useMemo, useState } from 'react'
import { store } from './store'
import { friendlyError } from './errors'
import { notify } from './notify'
import { fmtMinutes, occurrencesBetween } from './util'
import { deadlineInfo } from './manuscript'
import { usePrefs } from './prefs'
import type { Deadline, Paper, Project, ProjectEvent, ProjectTask, ProjectUpdate, Routine, RoutineCheck, TimeEntry } from '../types'

const DAY = 864e5
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** Everything the Today screen shows: loaded data, what is derived from it, and the actions on it. */
export function useTodayData() {
  const prefs = usePrefs()
  const [projects, setProjects] = useState<Project[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [events, setEvents] = useState<ProjectEvent[]>([])
  const [papers, setPapers] = useState<Paper[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [time, setTime] = useState<TimeEntry[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [checks, setChecks] = useState<RoutineCheck[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [leaving, setLeaving] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const [p, u, e, pa, dl, tk, te, ro, rc] = await Promise.all([store.projects(), store.updates(), store.events().catch(() => [] as ProjectEvent[]), store.papers(), store.deadlines().catch(() => [] as Deadline[]), store.tasks().catch(() => [] as ProjectTask[]), store.timeEntries().catch(() => [] as TimeEntry[]), store.routines().catch(() => [] as Routine[]), store.routineChecks().catch(() => [] as RoutineCheck[])])
      setProjects(p); setUpdates(u); setEvents(e); setPapers(pa); setDeadlines(dl); setTasks(tk); setTime(te); setRoutines(ro); setChecks(rc); setError('')
    } catch (er) { setError(friendlyError(er)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { window.addEventListener('tm-data', load); return () => window.removeEventListener('tm-data', load) }, [load])

  const byId = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])
  const live = projects.filter(p => p.status === 'active' && p.stage !== 'accepted')
  const now = new Date(); const today = startOfDay(now); const todayIso = isoDay(today)

  // schedule: today + next 7 days
  const upcoming = useMemo(() => {
    const out: { when: Date; title: string; project: Project }[] = []
    for (const e of events) {
      const pr = byId.get(e.project_id); if (!pr) continue
      for (const d of occurrencesBetween(e, today, addDays(today, 8))) if (d.getTime() >= now.getTime() - 36e5 || d < addDays(today, 1)) out.push({ when: d, title: e.title, project: pr })
    }
    return out.sort((a, b) => a.when.getTime() - b.when.getTime())
  }, [events, byId]) // eslint-disable-line react-hooks/exhaustive-deps
  const todays = upcoming.filter(x => x.when < addDays(today, 1))

  // manuscript "next deadline" fields plus standalone deadlines, soonest first
  const dueItems = [
    ...projects.filter(p => p.type === 'manuscript' && p.stage !== 'accepted' && p.deadline)
      .map(p => ({ key: 'm' + p.id, title: 'Next deadline', project: p, date: p.deadline!, id: null as string | null })),
    ...deadlines.filter(d => !d.done).map(d => ({ key: d.id, title: d.title, project: byId.get(d.project_id), date: d.due_on, id: d.id as string | null })),
  ].map(x => ({ ...x, info: deadlineInfo(x.date)! })).filter(x => x.project && x.info.days <= 21).sort((a, b) => a.info.days - b.info.days)

  const lastTouch = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of updates) { const c = m.get(u.project_id); if (!c || u.created_at > c) m.set(u.project_id, u.created_at) }
    return m
  }, [updates])
  const stale = live.map(p => ({ p, days: Math.floor((now.getTime() - new Date(lastTouch.get(p.id) ?? p.created_at).getTime()) / DAY) }))
    .filter(x => x.days >= 14).sort((a, b) => b.days - a.days).slice(0, 6)

  const reading = papers.filter(p => p.status === 'reading').slice(0, 6)
  const coreLeft = papers.filter(p => p.status === 'to-read' && p.priority === 'Core').length
  const recent = [...updates].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8)

  // open tasks across every project, soonest first; undated ones come last
  const openTasks = tasks.filter(t => !t.done && (!t.project_id || byId.has(t.project_id)))
    .sort((a, b) => (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999') || a.created_at.localeCompare(b.created_at))
  const dueNow = openTasks.filter(t => t.due_on && t.due_on <= todayIso)

  // focus time from the timer: this week (starting on your chosen day), by day and by project
  const weekStartDay = new Date(today); weekStartDay.setDate(weekStartDay.getDate() - ((weekStartDay.getDay() - prefs.weekStart + 7) % 7))
  const weekTime = time.filter(t => new Date(t.started_at) >= weekStartDay)
  const weekMinutes = weekTime.reduce((a, t) => a + t.minutes, 0)
  const perProject = [...weekTime.reduce((m, t) => m.set(t.project_id ?? '', (m.get(t.project_id ?? '') ?? 0) + t.minutes), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStartDay, i)
    return { d, m: time.filter(t => { const x = new Date(t.started_at); return x >= d && x < addDays(d, 1) }).reduce((a, t) => a + t.minutes, 0) }
  })
  const dayMax = Math.max(30, ...perDay.map(x => x.m))

  const dueThisWeek = dueItems.filter(x => x.info.days <= 7).length
  const summary = [
    todays.length ? plural(todays.length, 'event') + ' today' : '',
    dueNow.length ? `${plural(dueNow.length, 'task')} due` : '',
    dueThisWeek ? `${plural(dueThisWeek, 'deadline')} this week` : '',
  ].filter(Boolean).join(' · ')

  // a one-line read on how full the day is
  const routinesToday = routines.filter(r => r.active && r.weekdays.includes(now.getDay()) && todayIso >= isoDay(new Date(r.created_at))).length
  const weight = todays.length * 2 + dueNow.length + routinesToday
  const tone = weight === 0 ? 'A clear day. Good time for deep work.'
    : weight <= 4 ? `Light day${todays.length ? `: ${plural(todays.length, 'event')}` : ''}${dueNow.length ? `, ${dueNow.length} due` : ''}.`
    : weight <= 9 ? `Steady day: ${[todays.length && plural(todays.length, 'event'), dueNow.length && `${dueNow.length} due`, routinesToday && plural(routinesToday, 'routine')].filter(Boolean).join(', ')}.`
    : `Busy day: ${plural(todays.length, 'event')}, ${dueNow.length} due. Protect a focus block.`
  const allClear = projects.length > 0 && dueNow.length === 0 && todays.length === 0 && dueItems.every(x => x.info.days > 3)

  // what you finished today: tasks, routines you ticked, papers you finished reading
  const startMs = today.getTime()
  // removing one takes its XP with it: a to-do is deleted, a routine tick is cleared, a paper goes back to "reading"
  const doneToday = [
    ...tasks.filter(t => t.done && t.done_at && new Date(t.done_at).getTime() >= startMs).map(t => ({ key: 't' + t.id, kind: 'To-do', title: t.title, at: t.done_at!, project: t.project_id ? byId.get(t.project_id) : undefined,
      remove: () => notify.undoable(`Deleted "${t.title}" and its XP`, () => store.deleteTask(t.id), [t.id]) })),
    ...checks.filter(c => c.on_date === todayIso).map(c => ({ c, r: routines.find(x => x.id === c.routine_id) })).filter(x => x.r).map(x => ({ key: 'r' + x.c.id, kind: 'Routine', title: x.r!.title, at: x.c.created_at, project: x.r!.project_id ? byId.get(x.r!.project_id) : undefined,
      remove: () => notify.undoable(`Cleared "${x.r!.title}" and its XP`, () => store.uncheckRoutine(x.c.routine_id, x.c.on_date), [x.c.id]) })),
    ...papers.filter(p => p.read_at && new Date(p.read_at).getTime() >= startMs).map(p => ({ key: 'p' + p.id, kind: 'Read', title: p.title, at: p.read_at!, project: undefined as Project | undefined,
      remove: async () => {
        try {
          await store.patchPaper(p.id, { status: 'reading' }); load()
          notify.action(`Marked "${p.title}" as not finished and removed its XP`, 'Undo', async () => { try { await store.patchPaper(p.id, { status: 'read' }) } finally { load() } })
        } catch (er) { fail(er) }
      } })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  // ----- actions -----
  // checking something off: play the exit animation first, then save and drop the row (with a toast to undo it)
  const withExit = (key: string, fn: () => void) => {
    setLeaving(s => new Set(s).add(key))
    setTimeout(() => { fn(); setLeaving(s => { const n = new Set(s); n.delete(key); return n }) }, 520)
  }
  const fail = (er: unknown) => { setError(friendlyError(er)); load() }
  const checkOff = (id: string) => withExit('t' + id, async () => {
    const t = tasks.find(x => x.id === id)
    setTasks(ts => ts.map(x => x.id === id ? { ...x, done: true, done_at: new Date().toISOString() } : x))
    try {
      await store.patchTask(id, { done: true })
      notify.action(`Completed "${t?.title ?? 'task'}"`, 'Undo', async () => { try { await store.patchTask(id, { done: false }) } finally { load() } })
    } catch (er) { fail(er) }
  })
  const finishDeadline = (id: string) => withExit('d' + id, async () => {
    const d = deadlines.find(x => x.id === id)
    setDeadlines(ds => ds.map(x => x.id === id ? { ...x, done: true } : x))
    try {
      await store.patchDeadline(id, { done: true })
      notify.action(`Completed "${d?.title ?? 'deadline'}"`, 'Undo', async () => { try { await store.patchDeadline(id, { done: false }) } finally { load() } })
    } catch (er) { fail(er) }
  })
  const setDue = async (id: string, due_on: string | null) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, due_on } : t))
    try { await store.patchTask(id, { due_on }) } catch (er) { fail(er) }
  }
  const rename = async (id: string, title: string) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, title } : t))
    try { await store.patchTask(id, { title }) } catch (er) { fail(er) }
  }

  // the few things that matter most right now: sooner (or overdue) first
  const focusItems = [
    ...dueNow.map(t => ({ key: 't' + t.id, kind: 'To-do', title: t.title, score: deadlineInfo(t.due_on)!.days, pill: deadlineInfo(t.due_on)!, project: t.project_id ? byId.get(t.project_id) : undefined, tick: () => checkOff(t.id), when: '' })),
    ...dueItems.filter(x => x.info.days <= 3).map(x => ({ key: 'd' + x.key, kind: 'Deadline', title: x.title, score: x.info.days, pill: x.info, project: x.project, tick: x.id ? () => finishDeadline(x.id!) : null, when: '' })),
    ...todays.filter(x => x.when.getTime() >= now.getTime() - 36e5).slice(0, 1).map((x, i) => ({ key: 'e' + i, kind: 'Next up', title: x.title, score: 0, pill: null, project: x.project, tick: null, when: x.when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) })),
  ].sort((a, b) => a.score - b.score).slice(0, 12)

  return {
    loading, error, setError, reload: load, leaving,
    projects, updates, papers, routines, checks, time, tasks,
    byId, live, now, today, todayIso, upcoming, todays, dueItems, stale, reading, coreLeft, recent, openTasks, dueNow,
    doneToday, weekMinutes, weekSessions: weekTime.length, perProject, perDay, dayMax, summary, tone, allClear, focusItems,
    checkOff, finishDeadline, setDue, rename, fmtMinutes,
  }
}
export type TodayData = ReturnType<typeof useTodayData>
