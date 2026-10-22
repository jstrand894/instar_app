import { useState } from 'react'
import { cleanTag, tagStyle } from '../lib/sites'

const NEW = '__new__'

/** A field site's projects: coloured chips, a drop-down of the ones already in use, and an "Add new" option. */
export default function ProjectPicker({ tags, onChange, known }: { tags: string[]; onChange: (t: string[]) => void; known: string[] }) {
  const [adding, setAdding] = useState(false)
  const [v, setV] = useState('')
  const has = (t: string) => tags.some(x => x.toLowerCase() === t.toLowerCase())
  const options = known.filter(t => !has(t)).sort((a, b) => a.localeCompare(b))
  function add(raw: string) {
    const t = cleanTag(raw)
    if (t && !has(t)) onChange([...tags, known.find(k => k.toLowerCase() === t.toLowerCase()) ?? t])
    setV(''); setAdding(false)
  }
  return (
    <div className="tag-editor">
      {tags.map(t => (
        <span key={t} className="tag-chip colored" style={tagStyle(t)}>{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter(x => x !== t))}>×</button></span>
      ))}
      {adding ? (
        <>
          <input autoFocus value={v} placeholder="New project name" aria-label="New project name" onChange={e => setV(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(v) } else if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); setV('') } }} />
          <button type="button" className="link small" onClick={() => add(v)} disabled={!cleanTag(v)}>Add</button>
          <button type="button" className="link small" onClick={() => { setAdding(false); setV('') }}>Cancel</button>
        </>
      ) : (
        <select className="project-select" value="" aria-label="Add a project" onChange={e => { if (e.target.value === NEW) setAdding(true); else if (e.target.value) add(e.target.value) }}>
          <option value="">{tags.length ? 'Add another…' : 'Add a project…'}</option>
          {options.map(t => <option key={t} value={t}>{t}</option>)}
          <option value={NEW}>+ Add new project…</option>
        </select>
      )}
    </div>
  )
}
