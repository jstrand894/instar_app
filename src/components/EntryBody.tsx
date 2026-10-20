import { useEffect, useState } from 'react'
import RichTextarea, { RichView } from './RichText'

/** A timeline entry: shows links and tags; click to edit, click away to save, Esc to cancel. */
export default function EntryBody({ body, note, editing, setEditing, onSave }: { body: string; note?: boolean; editing: boolean; setEditing: (e: boolean) => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(body)
  useEffect(() => { if (!editing) setV(body) }, [body, editing])

  if (!editing) {
    return (
      <div className={`entry-view ${note ? 'note' : ''}`} role="button" tabIndex={0} title="Click to edit"
        onClick={e => { if ((e.target as HTMLElement).closest('a')) return; setEditing(true) }}
        onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) setEditing(true) }}>
        <RichView text={body} onToggle={onSave} />
      </div>
    )
  }
  const finish = () => { setEditing(false); const t = v.trim(); if (!t) { setV(body); return } if (t !== body) onSave(t) }
  return (
    <RichTextarea autoFocus className="entry-edit" rows={Math.max(2, v.split('\n').length + (note ? 1 : 0))} value={v} onChange={setV} onBlur={finish}
      onKeyDown={e => { if (e.key === 'Escape') { setV(body); setEditing(false) } }} />
  )
}
