import { useState } from 'react'
import { tagStyle } from '../lib/sites'
import { normalizeTag, useLinks } from '../lib/links'

/** Tag chips you can add (Enter or comma) and remove. */
export default function TagEditor({ tags, onChange, placeholder = 'Add a tag…', suggest, colored }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string; suggest?: string[]; colored?: boolean }) {
  const [v, setV] = useState('')
  const { tags: known } = useLinks()
  const add = (raw: string) => {
    setV('')
    const fresh = raw.split(/[,;\n]+/).map(normalizeTag).filter((t, i, all) => t && !tags.includes(t) && all.indexOf(t) === i)
    if (fresh.length) onChange([...tags, ...fresh])
  }
  const list = `tags-${Math.random().toString(36).slice(2, 7)}`
  return (
    <div className="tag-editor">
      {tags.map(t => (
        <span key={t} className={`tag-chip${colored ? ' colored' : ''}`} style={colored ? tagStyle(t) : undefined}>{colored ? t : `#${t}`}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter(x => x !== t))}>×</button></span>
      ))}
      <input value={v} list={list} placeholder={tags.length ? '' : placeholder} aria-label="Add a tag"
        onChange={e => { const x = e.target.value; if (/[,;]$/.test(x) || /[,;\n]/.test(x.slice(0, -1))) add(x); else setV(x) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); add(v) }
          if (e.key === 'Backspace' && !v && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={() => v && add(v)} />
      <datalist id={list}>{[...new Set([...(suggest ?? []), ...known.map(k => k.tag)])].filter(t => !tags.includes(t)).map(t => <option key={t} value={t} />)}</datalist>
    </div>
  )
}
