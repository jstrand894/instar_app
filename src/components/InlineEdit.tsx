import { useEffect, useState } from 'react'

/** Text you can click to edit in place; Enter or clicking away saves, Escape cancels. */
export default function InlineEdit({ value, onSave, className = '', placeholder = '' }: {
  value: string; onSave: (v: string) => void; className?: string; placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => { setEditing(false); const t = v.trim(); if (!t) setV(value); else if (t !== value) onSave(t) }
  if (editing) {
    return <input autoFocus className={`inline-input ${className}`} value={v} onChange={e => setV(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setV(value); setEditing(false) } }} />
  }
  return (
    <span className={`inline-text ${className}`} role="button" tabIndex={0} title="Click to edit"
      onClick={() => setEditing(true)} onKeyDown={e => { if (e.key === 'Enter') setEditing(true) }}>{value || placeholder}</span>
  )
}
