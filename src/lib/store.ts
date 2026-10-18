import { supabase } from './supabase'
import type {
  Highlight, InkPage, Paper, PaperInput, Project, ProjectImport, ProjectUpdate, Stroke,
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
const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

// ---------- local demo backend ----------
const LS = 'tm-demo-v1'
interface Db {
  projects: Project[]; updates: ProjectUpdate[]; papers: Paper[]
  highlights: Highlight[]; ink: InkPage[]
}
function load(): Db {
  try {
    const raw = localStorage.getItem(LS)
    if (raw) return JSON.parse(raw)
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
    { id: 'p1', name: 'Soil carbon manuscript', type: 'manuscript', status: 'active', description: 'Submitted to Ecology Letters', notes: '', created_at: t(40) },
    { id: 'p2', name: 'Transect survey 2026', type: 'field', status: 'active', description: 'Summer field season', notes: '', created_at: t(30) },
    { id: 'p3', name: 'Flux data pipeline', type: 'code', status: 'active', description: 'R + Python cleaning scripts', notes: '', created_at: t(20) },
    { id: 'p4', name: 'Sensor dataset QA', type: 'data', status: 'paused', description: '', notes: '', created_at: t(10) },
  ]
  const updates: ProjectUpdate[] = [
    { id: 'u1', kind: 'update', project_id: 'p1', body: 'Reviewer 2 comments addressed in Discussion', created_at: t(1) },
    { id: 'u2', kind: 'update', project_id: 'p1', body: 'Redrew Figure 3', created_at: t(3) },
    { id: 'u3', kind: 'update', project_id: 'p2', body: 'Plots 12–18 resampled', created_at: t(2) },
    { id: 'u4', kind: 'update', project_id: 'p3', body: 'Added gap-filling step, tests passing', created_at: t(0.2) },
    { id: 'u5', kind: 'update', project_id: 'p4', body: 'Waiting on calibration files', created_at: t(9) },
  ]
  return { projects, updates, papers: [], highlights: [], ink: [] }
}
const demoFiles = new Map<string, string>() // path -> blob url (session only)

const local = {
  async projects() { return load().projects },
  async updates() { return load().updates },
  async addProject(p: Pick<Project, 'name' | 'type' | 'description'>) {
    const d = load(); const row: Project = { id: uid(), status: 'active', notes: '', created_at: now(), ...p }
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
        proj = { id: uid(), name: it.name, type: it.type, status: it.status, description: it.description, notes: '', created_at: earliest(it) }
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
    d.updates = d.updates.filter(u => u.project_id !== id); save(d)
  },
  async addUpdate(project_id: string, body: string, kind: ProjectUpdate['kind'] = 'update') {
    const d = load(); const row: ProjectUpdate = { id: uid(), project_id, kind, body, created_at: now() }
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
    const d = load(); d.papers = d.papers.map(p => p.id === id ? { ...p, ...patch } : p); save(d)
  },
  async deletePaper(id: string) {
    const d = load(); d.papers = d.papers.filter(p => p.id !== id)
    d.highlights = d.highlights.filter(h => h.paper_id !== id)
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
  async addProject(p) { return ok(await sb().from('projects').insert(p).select().single()) },
  async patchProject(id, patch) { ok(await sb().from('projects').update(patch).eq('id', id)) },
  async importProjects(items) {
    const existing = ok(await sb().from('projects').select('id,name')) as Pick<Project, 'id' | 'name'>[]
    const entries0 = ok(await sb().from('project_updates').select('project_id,body,created_at')) as ProjectUpdate[]
    let projects = 0, entries = 0
    for (const it of items) {
      let id = existing.find(p => p.name.toLowerCase() === it.name.toLowerCase())?.id
      if (!id) {
        const row = ok(await sb().from('projects').insert({ name: it.name, type: it.type, status: it.status, description: it.description, created_at: earliest(it) }).select('id').single()) as { id: string }
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
  async addUpdate(project_id, body, kind = 'update') { return ok(await sb().from('project_updates').insert({ project_id, body, kind }).select().single()) },
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
  async patchPaper(id, patch) { ok(await sb().from('papers').update(patch).eq('id', id)) },
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

export const store = supabase ? remote : local
