// One-way backup: Supabase -> a local folder (put it inside your OneDrive folder).
// Run with: npm run backup
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile, readdir, rename, access } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const TYPE_LABEL = { manuscript: 'Manuscript', data: 'Data', field: 'Field work', code: 'Code', other: 'Other' }

const safe = s => (s || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled'
const day = iso => new Date(iso).toLocaleString('en-CA', { hour12: false, dateStyle: 'short', timeStyle: 'short' })
const tag = id => `[${id.slice(0, 8)}]`

const STAGE_LABEL = { planning: 'Planning', drafting: 'Drafting', internal: 'Internal review', submitted: 'Under review', revision: 'Revision', accepted: 'Accepted / published' }

export function renderProject(p, entries, events = [], papers = [], deadlines = []) {
  const lines = [`# ${p.name}`, '', `- Type: ${TYPE_LABEL[p.type] ?? p.type}`, `- Area: ${p.area ?? 'work'}`, `- Status: ${p.status}`, `- Created: ${day(p.created_at)}`]
  if (p.type === 'manuscript') {
    lines.push(`- Stage: ${STAGE_LABEL[p.stage ?? 'drafting']}`)
    if (p.journal) lines.push(`- Journal: ${p.journal}`)
    if (p.coauthors) lines.push(`- Co-authors: ${p.coauthors}`)
    if (p.deadline) lines.push(`- Deadline: ${p.deadline}`)
  }
  if (p.description) lines.push('', p.description)
  if (papers.length) { lines.push('', '## Reading', ''); for (const x of papers) lines.push(`- ${x.title}${x.authors ? ` (${x.authors}${x.year ? `, ${x.year}` : ''})` : ''}`) }
  if (deadlines.length) {
    lines.push('', '## Deadlines', '')
    for (const d of [...deadlines].sort((a, b) => a.due_on.localeCompare(b.due_on))) lines.push(`- [${d.done ? 'x' : ' '}] ${d.due_on}: ${d.title}`)
  }
  if (events.length) {
    lines.push('', '## Schedule', '')
    for (const e of [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) lines.push(`- ${day(e.starts_at)}${e.repeat === 'weekly' ? ' (repeats weekly)' : ''}: ${e.title}`)
  }
  lines.push('', '## Timeline', '')
  const sorted = [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (!sorted.length) lines.push('_Nothing logged._')
  for (const e of sorted) lines.push(`### ${day(e.created_at)} · ${e.kind === 'note' ? 'Note' : 'Update'}`, '', e.body, '')
  return lines.join('\n') + '\n'
}

export function renderPaper(p, pdfName, highlights) {
  const lines = [`# ${p.title}`, '']
  if (p.authors) lines.push(`- Authors: ${p.authors}`)
  if (p.year) lines.push(`- Year: ${p.year}`)
  if (p.category) lines.push(`- Category: ${p.category}`)
  if (p.priority) lines.push(`- Priority: ${p.priority}`)
  if (p.source) lines.push(`- Source: ${p.source}`)
  if (p.doi) lines.push(`- DOI: https://doi.org/${p.doi}`)
  lines.push(`- Status: ${p.status}${p.read_at ? ` (read ${day(p.read_at)})` : ''}`, `- Added: ${day(p.created_at)}`, pdfName ? `- PDF: [Open PDF](<${pdfName}>)` : '- PDF: not attached', '')
  if (p.why) lines.push('## Why it matters', '', p.why, '')
  if (p.notes) lines.push('## Notes', '', p.notes, '')
  lines.push('## Highlights', '')
  const hs = [...highlights].sort((a, b) => a.page - b.page || (a.rects?.[0]?.y ?? 0) - (b.rects?.[0]?.y ?? 0))
  if (!hs.length) lines.push('_No highlights._')
  for (const h of hs) {
    lines.push(`### Page ${h.page} (${h.color})`, '', `> ${h.text}`, '')
    if (h.note) lines.push(h.note, '')
  }
  return lines.join('\n') + '\n'
}

const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`
export function readingListCsv(papers) {
  const cols = ['status', 'doi', 'category', 'priority', 'authors', 'year', 'title', 'source', 'why', 'has_pdf']
  const rows = [...papers].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.title.localeCompare(b.title))
  return '\ufeff' + [cols.join(','), ...rows.map(p => cols.map(c => csvCell(c === 'has_pdf' ? (p.file_path ? 'yes' : 'no') : p[c])).join(','))].join('\n') + '\n'
}

const exists = f => access(f).then(() => true, () => false)

// Keep one file per record id: if the title changed, rename the old file instead of leaving a stale copy.
async function placeFile(dir, id, name) {
  const target = join(dir, name)
  for (const f of await readdir(dir)) {
    if (f.includes(tag(id)) && f !== name && f.slice(f.lastIndexOf('.')) === name.slice(name.lastIndexOf('.'))) {
      if (!(await exists(target))) await rename(join(dir, f), target)
    }
  }
  return target
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  const out = (process.env.BACKUP_DIR || '').replace(/^~(?=\/|$)/, homedir())
  if (!url || !key || !out) {
    console.error('Missing settings. Create .env.backup (see scripts/backup.env.example) with SUPABASE_SECRET_KEY and BACKUP_DIR.')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const all = async (t, optional = false) => {
    const { data, error } = await sb.from(t).select('*').range(0, 49999)
    if (error) { if (optional) return []; throw new Error(`${t}: ${error.message}`) }
    return data
  }
  const [projects, updates, papers, highlights, ink] = await Promise.all(
    ['projects', 'project_updates', 'papers', 'highlights', 'ink'].map(t => all(t)))
  const events = await all('project_events', true)
  const links = await all('project_papers', true)
  const deadlines = await all('project_deadlines', true)

  const dirs = { projects: join(out, 'Projects'), papers: join(out, 'Papers'), raw: join(out, '_raw-data') }
  await Promise.all(Object.values(dirs).map(d => mkdir(d, { recursive: true })))

  for (const p of projects) {
    const file = await placeFile(dirs.projects, p.id, `${safe(p.name)} ${tag(p.id)}.md`)
    await writeFile(file, renderProject(p, updates.filter(u => u.project_id === p.id), events.filter(e => e.project_id === p.id),
      links.filter(l => l.project_id === p.id).map(l => papers.find(x => x.id === l.paper_id)).filter(Boolean),
      deadlines.filter(d => d.project_id === p.id)))
  }

  let newPdfs = 0
  for (const p of papers) {
    let pdfName = null
    if (p.file_path) {
      pdfName = `${safe(p.title)} ${tag(p.id)}.pdf`
      const pdf = await placeFile(dirs.papers, p.id, pdfName)
      if (!(await exists(pdf))) {
        const { data, error } = await sb.storage.from('papers').download(p.file_path)
        if (error) { console.warn(`  skipped PDF for "${p.title}": ${error.message}`); pdfName = null }
        else { await writeFile(pdf, Buffer.from(await data.arrayBuffer())); newPdfs++ }
      }
    }
    const md = await placeFile(dirs.papers, p.id, `${safe(p.title)} ${tag(p.id)}.md`)
    await writeFile(md, renderPaper(p, pdfName, highlights.filter(h => h.paper_id === p.id)))
  }

  await writeFile(join(out, 'Reading List.csv'), readingListCsv(papers))

  // Full-fidelity copy (includes pen strokes) for restoring or migrating later.
  await writeFile(join(dirs.raw, 'data.json'), JSON.stringify({ exported_at: new Date().toISOString(), projects, project_updates: updates, project_events: events, project_papers: links, project_deadlines: deadlines, papers, highlights, ink }, null, 2))

  console.log(`Backed up ${projects.length} projects, ${updates.length} timeline entries, ${papers.length} papers (${newPdfs} new PDFs), ${highlights.length} highlights.`)
  console.log(`Folder: ${out}`)
}

import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error('Backup failed:', e.message); process.exit(1) })
}
