import { supabase } from './supabase'
import { trackMutation } from './sync'
import { isPendingDelete } from './notify'
import type {
  Deadline, FieldSite, Highlight, InkPage, Paper, PaperInput, PaperLink, ProjectLink, ProjectTask, Routine, RoutineCheck, TimeEntry, Project, ProjectEvent, ProjectImport, ProjectUpdate, Reward, SiteVisit, Stroke,
} from '../types'

const blankPaper = { authors: '', year: '', status: 'to-read', notes: '', doi: '', category: '', priority: '', source: '', why: '' } as const
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export const paperKey = (p: { doi?: string; title: string; year?: string }) =>
  p.doi ? `doi:${p.doi.toLowerCase()}` : `t:${norm(p.title)}|${p.year ?? ''}`
const fresh = (inputs: PaperInput[], existing: Paper[]) => {
  const seen = new Set(existing.map(paperKey)); const out: PaperInput[] = []
  for (const i of inputs) { const k = paperKey(i); if (!seen.has(k)) { seen.add(k); out.push(i) } }
  return out
}

/* One API, two backends: Supabase when configured, otherwise a localStorage
   demo so the UI works before keys are added. */

const sameDay = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10)
const earliest = (p: ProjectImport) => p.entries.map(e => new Date(e.date).toISOString()).sort()[0] ?? new Date().toISOString()
/** Marking a paper read stamps the date; moving it back clears it. */
const withReadAt = <T extends { status?: string; read_at?: string | null }>(patch: T): T =>
  patch.status === undefined ? patch : { ...patch, read_at: patch.status === 'read' ? patch.read_at ?? new Date().toISOString() : null }
/** Checking a task off stamps when; unchecking clears it. */
const taskPatch = <T extends { done?: boolean; done_at?: string | null }>(patch: T): T =>
  patch.done === undefined ? patch : { ...patch, done_at: patch.done ? new Date().toISOString() : null }
const uid = () => crypto.randomUUID()
const pairOf = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a])
const now = () => new Date().toISOString()

// ---------- local demo backend ----------
const LS = 'tm-demo-v1'
interface Db {
  projects: Project[]; updates: ProjectUpdate[]; events: ProjectEvent[]; links: PaperLink[]; projectLinks: ProjectLink[]; deadlines: Deadline[]; tasks: ProjectTask[]; time: TimeEntry[]; routines: Routine[]; checks: RoutineCheck[]; papers: Paper[]
  highlights: Highlight[]; ink: InkPage[]; sites: FieldSite[]; visits: SiteVisit[]; freezes: string[]; rewards: Reward[]
}
function load(): Db {
  try {
    const raw = localStorage.getItem(LS)
    if (raw) { const d = JSON.parse(raw); d.events ??= []; d.links ??= []; d.projectLinks ??= []; d.deadlines ??= []; d.tasks ??= []; d.time ??= []; d.routines ??= []; d.checks ??= []; d.sites ??= []; d.visits ??= []; d.freezes ??= []; d.rewards ??= []; return d }
  } catch { /* ignore */ }
  const d = seed()
  localStorage.setItem(LS, JSON.stringify(d))
  return d
}
function save(d: Db) { try { localStorage.setItem(LS, JSON.stringify(d)) } catch { /* ignore */ } }
function seed(): Db {
  const day = 864e5
  const t = (ago: number) => new Date(Date.now() - ago * day).toISOString()
  const projects: Project[] = [
    { id: 'p1', name: 'Soil carbon manuscript', type: 'manuscript', status: 'active', area: 'work', description: 'Submitted to Ecology Letters', notes: '', created_at: t(40) },
    { id: 'p2', name: 'Transect survey 2026', type: 'field', status: 'active', area: 'work', description: 'Summer field season', notes: '', created_at: t(30) },
    { id: 'p3', name: 'Flux data pipeline', type: 'code', status: 'active', area: 'work', description: 'R + Python cleaning scripts', notes: '', created_at: t(20) },
    { id: 'p4', name: 'Sensor dataset QA', type: 'data', status: 'paused', area: 'work', description: '', notes: '', created_at: t(10) },
  ]
  const updates: ProjectUpdate[] = [
    { id: 'u1', kind: 'update', project_id: 'p1', body: 'Reviewer 2 comments addressed in Discussion', created_at: t(1) },
    { id: 'u2', kind: 'update', project_id: 'p1', body: 'Redrew Figure 3', created_at: t(3) },
    { id: 'u3', kind: 'update', project_id: 'p2', body: 'Plots 12–18 resampled', created_at: t(2) },
    { id: 'u4', kind: 'update', project_id: 'p3', body: 'Added gap-filling step, tests passing', created_at: t(0.2) },
    { id: 'u5', kind: 'update', project_id: 'p4', body: 'Waiting on calibration files', created_at: t(9) },
  ]
  return { projects, updates, events: [], links: [], projectLinks: [], deadlines: [], tasks: [], time: [], routines: [], checks: [], papers: [], highlights: [], ink: [], sites: [], visits: [], freezes: [], rewards: [] }
}
const demoFiles = new Map<string, string>() // path -> blob url (session only)

const local = {
  async projects() { return load().projects },
  async updates() { return load().updates },
  async projectUpdates(project_id: string, limit: number): Promise<ProjectPage> {
    const all = load().updates.filter(u => u.project_id === project_id).sort((a, b) => b.created_at.localeCompare(a.created_at))
    const commits = all.filter(u => u.kind === 'commit')
    return { rows: all.slice(0, limit), total: all.length, commits: commits.length, lastPush: commits[0]?.created_at }
  },
  async mentionsOf(name: string, exceptId: string) {
    return load().updates.filter(u => u.project_id !== exceptId && u.body.toLowerCase().includes(`[[${name.toLowerCase()}]]`)).slice(0, 50)
  },
  async addProject(p: Pick<Project, 'name' | 'type' | 'description'> & Partial<Pick<Project, 'area' | 'stage' | 'journal'>>) {
    const d = load(); const row: Project = { id: uid(), status: 'active', area: 'work', notes: '', created_at: now(), ...p }
    d.projects.push(row); save(d); return row
  },
  async patchProject(id: string, patch: Partial<Project>) {
    const d = load(); d.projects = d.projects.map(p => p.id === id ? { ...p, ...patch } : p); save(d)
  },
  async importProjects(items: ProjectImport[]) {
    const d = load(); let projects = 0, entries = 0
    for (const it of items) {
      let proj = d.projects.find(p => p.name.toLowerCase() === it.name.toLowerCase())
      if (!proj) {
        proj = { id: uid(), name: it.name, type: it.type, status: it.status, area: it.area ?? 'work', description: it.description, notes: '', created_at: earliest(it) }
        d.projects.push(proj); projects++
      }
      for (const e of it.entries) {
        const at = new Date(e.date).toISOString()
        if (d.updates.some(u => u.project_id === proj!.id && u.body === e.body && sameDay(u.created_at, at))) continue
        d.updates.push({ id: uid(), project_id: proj.id, kind: e.kind, body: e.body, created_at: at }); entries++
      }
    }
    save(d); return { projects, entries }
  },
  async deleteProject(id: string) {
    const d = load(); d.projects = d.projects.filter(p => p.id !== id)
    d.updates = d.updates.filter(u => u.project_id !== id)
    d.events = d.events.filter(e => e.project_id !== id)
    d.links = d.links.filter(l => l.project_id !== id)
    d.projectLinks = d.projectLinks.filter(l => l.project_id !== id && l.linked_id !== id)
    d.deadlines = d.deadlines.filter(x => x.project_id !== id)
    d.tasks = d.tasks.filter(x => x.project_id !== id)
    d.time = d.time.map(x => x.project_id === id ? { ...x, project_id: null } : x); save(d)
  },
  async tasks() { return load().tasks },
  async addTask(project_id: string | null, title: string, due_on: string | null) {
    const d = load(); const row: ProjectTask = { id: uid(), project_id, title, done: false, due_on, done_at: null, created_at: now() }
    d.tasks.push(row); save(d); return row
  },
  async patchTask(id: string, patch: Partial<ProjectTask>) {
    const d = load(); d.tasks = d.tasks.map(x => x.id === id ? { ...x, ...taskPatch(patch) } : x); save(d)
  },
  async deleteTask(id: string) { const d = load(); d.tasks = d.tasks.filter(x => x.id !== id); save(d) },
  async sites() { return load().sites },
  async addSite(s: Pick<FieldSite, 'name'> & Partial<Pick<FieldSite, 'address' | 'lat' | 'lng' | 'description' | 'status' | 'tags'>>) {
    const d = load(); const row: FieldSite = { id: uid(), status: 'active', address: '', lat: null, lng: null, description: '', notes: '', project_id: null, cover_path: null, created_at: now(), ...s }
    d.sites.push(row); save(d); return row
  },
  async patchSite(id: string, patch: Partial<FieldSite>) {
    const d = load(); d.sites = d.sites.map(x => x.id === id ? { ...x, ...patch } : x); save(d)
  },
  async deleteSite(id: string) {
    const d = load(); d.sites = d.sites.filter(x => x.id !== id); d.visits = d.visits.filter(v => v.site_id !== id); save(d)
  },
  /** Stores the cover photo; in local mode it is kept as a data URL in the site itself. */
  async saveSiteCover(id: string, photo: Blob | null) {
    const url = photo ? await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(photo) }) : null
    const d = load(); d.sites = d.sites.map(x => x.id === id ? { ...x, cover_path: url } : x); save(d)
  },
  async siteCoverUrls(paths: string[]): Promise<Record<string, string>> { return Object.fromEntries(paths.map(p => [p, p])) },
  async siteVisits() { return load().visits },
  async addSiteVisit(v: Omit<SiteVisit, 'id' | 'created_at'>) {
    const d = load(); const row: SiteVisit = { ...v, id: uid(), created_at: now() }
    d.visits.push(row); save(d); return row
  },
  async patchSiteVisit(id: string, patch: Partial<SiteVisit>) {
    const d = load(); d.visits = d.visits.map(x => x.id === id ? { ...x, ...patch } : x); save(d)
  },
  async deleteSiteVisit(id: string) { const d = load(); d.visits = d.visits.filter(x => x.id !== id); save(d) },
  async freezes() { return load().freezes },
  async addFreeze(on_date: string) { const d = load(); if (!d.freezes.includes(on_date)) d.freezes.push(on_date); save(d) },
  async rewards() { return load().rewards },
  async addReward(r: { title: string; level: number }) {
    const d = load(); const row: Reward = { id: uid(), claimed_at: null, created_at: now(), ...r }
    d.rewards.push(row); save(d); return row
  },
  async patchReward(id: string, patch: Partial<Reward>) { const d = load(); d.rewards = d.rewards.map(x => x.id === id ? { ...x, ...patch } : x); save(d) },
  async deleteReward(id: string) { const d = load(); d.rewards = d.rewards.filter(x => x.id !== id); save(d) },
  async routines() { return load().routines },
  async addRoutine(r: { title: string; weekdays: number[]; project_id: string | null; notes: string }) {
    const d = load(); const row: Routine = { id: uid(), active: true, created_at: now(), ...r }
    d.routines.push(row); save(d); return row
  },
  async patchRoutine(id: string, patch: Partial<Routine>) {
    const d = load(); d.routines = d.routines.map(x => x.id === id ? { ...x, ...patch } : x); save(d)
  },
  async deleteRoutine(id: string) {
    const d = load(); d.routines = d.routines.filter(x => x.id !== id); d.checks = d.checks.filter(c => c.routine_id !== id); save(d)
  },
  async routineChecks() { return load().checks },
  async checkRoutine(routine_id: string, on_date: string) {
    const d = load(); if (!d.checks.some(c => c.routine_id === routine_id && c.on_date === on_date)) d.checks.push({ id: uid(), routine_id, on_date, created_at: now() }); save(d)
  },
  async uncheckRoutine(routine_id: string, on_date: string) {
    const d = load(); d.checks = d.checks.filter(c => !(c.routine_id === routine_id && c.on_date === on_date)); save(d)
  },
  async timeEntries() { return load().time },
  async addTimeEntry(project_id: string | null, minutes: number, started_at: string) {
    const d = load(); const row: TimeEntry = { id: uid(), project_id, minutes, started_at, created_at: now() }
    d.time.push(row); save(d); return row
  },
  async allHighlights() { return load().highlights },
  async deadlines() { return load().deadlines },
  async addDeadline(project_id: string, title: string, due_on: string) {
    const d = load(); const row: Deadline = { id: uid(), project_id, title, due_on, done: false, created_at: now() }
    d.deadlines.push(row); save(d); return row
  },
  async patchDeadline(id: string, patch: Partial<Deadline>) {
    const d = load(); d.deadlines = d.deadlines.map(x => x.id === id ? { ...x, ...patch } : x); save(d)
  },
  async deleteDeadline(id: string) { const d = load(); d.deadlines = d.deadlines.filter(x => x.id !== id); save(d) },
  async projectPapers() { return load().links },
  async linkPaper(project_id: string, paper_id: string) {
    const d = load(); if (!d.links.some(l => l.project_id === project_id && l.paper_id === paper_id)) d.links.push({ project_id, paper_id, created_at: now() }); save(d)
  },
  async unlinkPaper(project_id: string, paper_id: string) {
    const d = load(); d.links = d.links.filter(l => !(l.project_id === project_id && l.paper_id === paper_id)); save(d)
  },
  async projectLinks() { return load().projectLinks },
  async linkProject(a: string, b: string) {
    const [project_id, linked_id] = pairOf(a, b)
    const d = load(); if (!d.projectLinks.some(l => l.project_id === project_id && l.linked_id === linked_id)) d.projectLinks.push({ project_id, linked_id, created_at: now() }); save(d)
  },
  async unlinkProject(a: string, b: string) {
    const [project_id, linked_id] = pairOf(a, b)
    const d = load(); d.projectLinks = d.projectLinks.filter(l => !(l.project_id === project_id && l.linked_id === linked_id)); save(d)
  },
  async reorderProjects(ids: string[], reset = false) {
    const d = load(); d.projects = d.projects.map(p => { const i = ids.indexOf(p.id); return i < 0 ? p : { ...p, sort_order: reset ? null : i } }); save(d)
  },
  async events() { return load().events },
  async addEvent(project_id: string, title: string, starts_at: string, repeat: ProjectEvent['repeat']) {
    const d = load(); const row: ProjectEvent = { id: uid(), project_id, title, starts_at, repeat, created_at: now() }
    d.events.push(row); save(d); return row
  },
  async deleteEvent(id: string) { const d = load(); d.events = d.events.filter(e => e.id !== id); save(d) },
  async addUpdate(project_id: string, body: string, kind: ProjectUpdate['kind'] = 'update', at?: string) {
    const d = load(); const row: ProjectUpdate = { id: uid(), project_id, kind, body, created_at: at ?? now() }
    d.updates.push(row); save(d); return row
  },
  async patchUpdate(id: string, patch: Partial<ProjectUpdate>) {
    const d = load(); d.updates = d.updates.map(u => u.id === id ? { ...u, ...patch } : u); save(d)
  },
  async deleteUpdate(id: string) {
    const d = load(); d.updates = d.updates.filter(u => u.id !== id); save(d)
  },
  async papers() { return load().papers },
  async addPaper(file: File | null, meta: PaperInput) {
    const d = load(); let path: string | null = null
    if (file) { path = `demo/${uid()}.pdf`; demoFiles.set(path, URL.createObjectURL(file)) }
    const row: Paper = { ...blankPaper, id: uid(), file_path: path, created_at: now(), ...meta }
    d.papers.push(row); save(d); return row
  },
  async attachPdf(id: string, file: File) {
    const path = `demo/${uid()}.pdf`; demoFiles.set(path, URL.createObjectURL(file))
    const d = load(); d.papers = d.papers.map(p => p.id === id ? { ...p, file_path: path } : p); save(d)
  },
  async importPapers(items: PaperInput[]) {
    const d = load(); const add = fresh(items, d.papers)
    for (const i of add) d.papers.push({ ...blankPaper, id: uid(), file_path: null, created_at: now(), ...i })
    save(d); return { added: add.length, skipped: items.length - add.length }
  },
  async patchPaper(id: string, patch: Partial<Paper>) {
    const d = load(); d.papers = d.papers.map(p => p.id === id ? { ...p, ...withReadAt(patch) } : p); save(d)
  },
  async deletePaper(id: string) {
    const d = load(); d.papers = d.papers.filter(p => p.id !== id)
    d.highlights = d.highlights.filter(h => h.paper_id !== id)
    d.links = d.links.filter(l => l.paper_id !== id)
    d.ink = d.ink.filter(i => i.paper_id !== id); save(d)
  },
  async fileUrl(path: string | null) { return path ? demoFiles.get(path) ?? null : null },
  async highlights(paper_id: string) { return load().highlights.filter(h => h.paper_id === paper_id) },
  async addHighlight(h: Omit<Highlight, 'id' | 'created_at'>) {
    const d = load(); const row = { ...h, id: uid(), created_at: now() }
    d.highlights.push(row); save(d); return row
  },
  async patchHighlight(id: string, patch: Partial<Highlight>) {
    const d = load(); d.highlights = d.highlights.map(h => h.id === id ? { ...h, ...patch } : h); save(d)
  },
  async deleteHighlight(id: string) {
    const d = load(); d.highlights = d.highlights.filter(h => h.id !== id); save(d)
  },
  async ink(paper_id: string) { return load().ink.filter(i => i.paper_id === paper_id) },
  async saveInk(paper_id: string, page: number, strokes: Stroke[]) {
    const d = load(); d.ink = d.ink.filter(i => !(i.paper_id === paper_id && i.page === page))
    if (strokes.length) d.ink.push({ paper_id, page, strokes }); save(d)
  },
}

// ---------- supabase backend ----------
const sb = () => supabase!
export interface ProjectPage { rows: ProjectUpdate[]; total: number; commits: number; lastPush?: string }
function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}
async function uploadPdf(file: File) {
  const { data: { user } } = await sb().auth.getUser()
  const path = `${user!.id}/${uid()}.pdf`
  const up = await sb().storage.from('papers').upload(path, file, { contentType: 'application/pdf' })
  if (up.error) throw new Error(up.error.message)
  return path
}
const remote: typeof local = {
  async projects() { return ok(await sb().from('projects').select('*').order('created_at')) },
  async updates() { return ok(await sb().from('project_updates').select('*').order('created_at', { ascending: false }).limit(500)) },
  async projectUpdates(project_id, limit) {
    const q = () => sb().from('project_updates')
    const [rows, total, commits, last] = await Promise.all([
      q().select('*').eq('project_id', project_id).order('created_at', { ascending: false }).limit(limit),
      q().select('id', { count: 'exact', head: true }).eq('project_id', project_id),
      q().select('id', { count: 'exact', head: true }).eq('project_id', project_id).eq('kind', 'commit'),
      q().select('created_at').eq('project_id', project_id).eq('kind', 'commit').order('created_at', { ascending: false }).limit(1),
    ])
    if (total.error) throw new Error(total.error.message)
    return { rows: ok(rows) as ProjectUpdate[], total: total.count ?? 0, commits: commits.count ?? 0, lastPush: (ok(last) as { created_at: string }[])[0]?.created_at }
  },
  async mentionsOf(name, exceptId) {
    const esc = name.replace(/[\\%_]/g, m => '\\' + m)
    return ok(await sb().from('project_updates').select('*').neq('project_id', exceptId).ilike('body', `%[[${esc}]]%`).order('created_at', { ascending: false }).limit(50)) as ProjectUpdate[]
  },
  async addProject(p) { return ok(await sb().from('projects').insert(p).select().single()) },
  async patchProject(id, patch) { ok(await sb().from('projects').update(patch).eq('id', id)) },
  async importProjects(items) {
    const existing = ok(await sb().from('projects').select('id,name')) as Pick<Project, 'id' | 'name'>[]
    const entries0 = ok(await sb().from('project_updates').select('project_id,body,created_at')) as ProjectUpdate[]
    let projects = 0, entries = 0
    for (const it of items) {
      let id = existing.find(p => p.name.toLowerCase() === it.name.toLowerCase())?.id
      if (!id) {
        const row = ok(await sb().from('projects').insert({ name: it.name, type: it.type, status: it.status, area: it.area ?? 'work', description: it.description, created_at: earliest(it) }).select('id').single()) as { id: string }
        id = row.id; projects++
      }
      const rows = it.entries
        .map(e => ({ project_id: id!, kind: e.kind, body: e.body, created_at: new Date(e.date).toISOString() }))
        .filter(r => !entries0.some(u => u.project_id === id && u.body === r.body && sameDay(u.created_at, r.created_at)))
      if (rows.length) { ok(await sb().from('project_updates').insert(rows)); entries += rows.length }
    }
    return { projects, entries }
  },
  async deleteProject(id) { ok(await sb().from('projects').delete().eq('id', id)) },
  async projectLinks() { return ok(await sb().from('project_links').select('*')) },
  async linkProject(a, b) { const [project_id, linked_id] = pairOf(a, b); ok(await sb().from('project_links').upsert({ project_id, linked_id }, { onConflict: 'project_id,linked_id' })) },
  async unlinkProject(a, b) { const [project_id, linked_id] = pairOf(a, b); ok(await sb().from('project_links').delete().eq('project_id', project_id).eq('linked_id', linked_id)) },
  async reorderProjects(ids, reset = false) {
    await Promise.all(ids.map(async (id, i) => ok(await sb().from('projects').update({ sort_order: reset ? null : i }).eq('id', id))))
  },
  async deadlines() { return ok(await sb().from('project_deadlines').select('*').order('due_on')) },
  async addDeadline(project_id, title, due_on) { return ok(await sb().from('project_deadlines').insert({ project_id, title, due_on }).select().single()) },
  async patchDeadline(id, patch) { ok(await sb().from('project_deadlines').update(patch).eq('id', id)) },
  async deleteDeadline(id) { ok(await sb().from('project_deadlines').delete().eq('id', id)) },
  async tasks() { return ok(await sb().from('project_tasks').select('*').order('created_at')) },
  async addTask(project_id, title, due_on) { return ok(await sb().from('project_tasks').insert({ project_id, title, due_on }).select().single()) },
  async patchTask(id, patch) { ok(await sb().from('project_tasks').update(taskPatch(patch)).eq('id', id)) },
  async deleteTask(id) { ok(await sb().from('project_tasks').delete().eq('id', id)) },
  async sites() { return ok(await sb().from('field_sites').select('*').order('created_at')) },
  async addSite(s) { return ok(await sb().from('field_sites').insert(s).select().single()) },
  async patchSite(id, patch) { ok(await sb().from('field_sites').update(patch).eq('id', id)) },
  async deleteSite(id) {
    const { data } = await sb().from('field_sites').select('cover_path').eq('id', id).single()
    if (data?.cover_path) await sb().storage.from('sites').remove([data.cover_path])
    ok(await sb().from('field_sites').delete().eq('id', id))
  },
  async saveSiteCover(id, photo) {
    const { data: old } = await sb().from('field_sites').select('cover_path').eq('id', id).single()
    let path: string | null = null
    if (photo) {
      const { data: { user } } = await sb().auth.getUser()
      path = `${user!.id}/${uid()}.jpg`
      const up = await sb().storage.from('sites').upload(path, photo, { contentType: 'image/jpeg' })
      if (up.error) throw new Error(up.error.message)
    }
    ok(await sb().from('field_sites').update({ cover_path: path }).eq('id', id))
    if (old?.cover_path) await sb().storage.from('sites').remove([old.cover_path]) // the old photo goes, so nothing piles up
  },
  async siteCoverUrls(paths) {
    if (!paths.length) return {}
    const r = await sb().storage.from('sites').createSignedUrls(paths, 3600)
    return Object.fromEntries((r.data ?? []).flatMap(x => x.signedUrl && x.path ? [[x.path, x.signedUrl] as const] : []))
  },
  async siteVisits() { return ok(await sb().from('site_visits').select('*').order('visited_at', { ascending: false })) },
  async addSiteVisit(v) { return ok(await sb().from('site_visits').insert(v).select().single()) },
  async patchSiteVisit(id, patch) { ok(await sb().from('site_visits').update(patch).eq('id', id)) },
  async deleteSiteVisit(id) { ok(await sb().from('site_visits').delete().eq('id', id)) },
  async freezes() { return (ok(await sb().from('streak_freezes').select('on_date')) as { on_date: string }[]).map(r => r.on_date) },
  async addFreeze(on_date) { ok(await sb().from('streak_freezes').insert({ on_date })) },
  async rewards() { return ok(await sb().from('rewards').select('*').order('level')) },
  async addReward(r) { return ok(await sb().from('rewards').insert(r).select().single()) },
  async patchReward(id, patch) { ok(await sb().from('rewards').update(patch).eq('id', id)) },
  async deleteReward(id) { ok(await sb().from('rewards').delete().eq('id', id)) },
  async routines() { return ok(await sb().from('routines').select('*').order('created_at')) },
  async addRoutine(r) { return ok(await sb().from('routines').insert(r).select().single()) },
  async patchRoutine(id, patch) { ok(await sb().from('routines').update(patch).eq('id', id)) },
  async deleteRoutine(id) { ok(await sb().from('routines').delete().eq('id', id)) },
  async routineChecks() { return ok(await sb().from('routine_checks').select('*').gte('on_date', new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10))) },
  async checkRoutine(routine_id, on_date) { ok(await sb().from('routine_checks').upsert({ routine_id, on_date }, { onConflict: 'routine_id,on_date' })) },
  async uncheckRoutine(routine_id, on_date) { ok(await sb().from('routine_checks').delete().eq('routine_id', routine_id).eq('on_date', on_date)) },
  async timeEntries() { return ok(await sb().from('time_entries').select('*').order('started_at', { ascending: false }).limit(2000)) },
  async addTimeEntry(project_id, minutes, started_at) { return ok(await sb().from('time_entries').insert({ project_id, minutes, started_at }).select().single()) },
  async allHighlights() { return ok(await sb().from('highlights').select('*').limit(5000)) },
  async projectPapers() { return ok(await sb().from('project_papers').select('*')) },
  async linkPaper(project_id, paper_id) { ok(await sb().from('project_papers').upsert({ project_id, paper_id }, { onConflict: 'project_id,paper_id' })) },
  async unlinkPaper(project_id, paper_id) { ok(await sb().from('project_papers').delete().eq('project_id', project_id).eq('paper_id', paper_id)) },
  async events() { return ok(await sb().from('project_events').select('*').order('starts_at')) },
  async addEvent(project_id, title, starts_at, repeat) { return ok(await sb().from('project_events').insert({ project_id, title, starts_at, repeat }).select().single()) },
  async deleteEvent(id) { ok(await sb().from('project_events').delete().eq('id', id)) },
  async addUpdate(project_id, body, kind = 'update', at) { return ok(await sb().from('project_updates').insert({ project_id, body, kind, ...(at ? { created_at: at } : {}) }).select().single()) },
  async patchUpdate(id, patch) { ok(await sb().from('project_updates').update(patch).eq('id', id)) },
  async deleteUpdate(id) { ok(await sb().from('project_updates').delete().eq('id', id)) },
  async papers() { return ok(await sb().from('papers').select('*').order('created_at', { ascending: false })) },
  async addPaper(file, meta) {
    const path = file ? await uploadPdf(file) : null
    return ok(await sb().from('papers').insert({ ...meta, file_path: path }).select().single())
  },
  async attachPdf(id, file) {
    const path = await uploadPdf(file)
    ok(await sb().from('papers').update({ file_path: path }).eq('id', id))
  },
  async importPapers(items) {
    const existing = ok(await sb().from('papers').select('doi,title,year')) as Paper[]
    const add = fresh(items, existing)
    for (let i = 0; i < add.length; i += 100) ok(await sb().from('papers').insert(add.slice(i, i + 100)))
    return { added: add.length, skipped: items.length - add.length }
  },
  async patchPaper(id, patch) {
    const full = withReadAt(patch)
    const r = await sb().from('papers').update(full).eq('id', id)
    if (r.error && /read_at/.test(r.error.message)) { // column not added yet: still save the rest
      const { read_at: _ignored, ...rest } = full; void _ignored
      ok(await sb().from('papers').update(rest).eq('id', id)); return
    }
    ok(r)
  },
  async deletePaper(id) {
    const { data } = await sb().from('papers').select('file_path').eq('id', id).single()
    if (data?.file_path) await sb().storage.from('papers').remove([data.file_path])
    ok(await sb().from('papers').delete().eq('id', id))
  },
  async fileUrl(path) {
    if (!path) return null
    const r = await sb().storage.from('papers').createSignedUrl(path, 3600)
    return r.data?.signedUrl ?? null
  },
  async highlights(paper_id) { return ok(await sb().from('highlights').select('*').eq('paper_id', paper_id).order('created_at')) },
  async addHighlight(h) { return ok(await sb().from('highlights').insert(h).select().single()) },
  async patchHighlight(id, patch) { ok(await sb().from('highlights').update(patch).eq('id', id)) },
  async deleteHighlight(id) { ok(await sb().from('highlights').delete().eq('id', id)) },
  async ink(paper_id) { return ok(await sb().from('ink').select('paper_id,page,strokes').eq('paper_id', paper_id)) },
  async saveInk(paper_id, page, strokes) {
    if (!strokes.length) { ok(await sb().from('ink').delete().eq('paper_id', paper_id).eq('page', page)); return }
    ok(await sb().from('ink').upsert({ paper_id, page, strokes }, { onConflict: 'paper_id,page' }))
  },
}

const base: typeof local = supabase ? remote : local
const MUTATOR = /^(add|patch|delete|link|unlink|reorder|save|import|attach|check|uncheck)/

/** Same API, but every save is tracked for the sync indicator and tells pages to refresh. */
export const store = new Proxy(base, {
  get(target, prop, receiver) {
    const v = Reflect.get(target, prop, receiver)
    if (typeof v === 'function' && typeof prop === 'string' && MUTATOR.test(prop)) {
      return (...args: unknown[]) => trackMutation(Promise.resolve((v as (...a: unknown[]) => unknown).apply(target, args)))
    }
    if (typeof v === 'function' && typeof prop === 'string') {
      return (...args: unknown[]) => {
        const out = (v as (...a: unknown[]) => unknown).apply(target, args)
        return out instanceof Promise
          ? out.then(r => (Array.isArray(r) ? r.filter(x => !isPendingDelete((x as { id?: unknown })?.id)) : r))
          : out
      }
    }
    return v
  },
})
