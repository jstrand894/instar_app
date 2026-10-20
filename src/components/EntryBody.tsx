import { useEffect, useRef, useState } from 'react'
import RichTextarea, { RichView } from './RichText'

const LIMIT = 150

/** A timeline entry: shows links and tags; click to edit, click away to save, Esc to cancel. */
export default function EntryBody({ body, note, editing, setEditing, onSave }: { body: string; note?: boolean; editing: boolean; setEditing: (e: boolean) => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(body)
  useEffect(() => { if (!editing) setV(body) }, [body, editing])

  const inner = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(0)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const el = inner.current
    if (editing || !el) return
    const ro = new ResizeObserver(() => setFull(el.scrollHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [editing])

  if (!editing) {
    const long = !!note && full > LIMIT + 48
    return (
      <div className={`entry-fold ${long && !open ? 'clamped' : ''}`}>
        <div className="entry-fold-clip" style={long ? { maxHeight: open ? full : LIMIT } : undefined}>
          <div ref={inner} className={`entry-view ${note ? 'note' : ''}`} role="button" tabIndex={0} title="Click to edit"
            onClick={e => { if ((e.target as HTMLElement).closest('a')) return; setEditing(true) }}
            onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) setEditing(true) }}>
            <RichView text={body} onToggle={onSave} />
          </div>
        </div>
        {long && <button type="button" className="link small entry-fold-btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Show less' : 'Show all'}</button>}
      </div>
    )
  }
  const finish = () => { setEditing(false); const t = v.trim(); if (!t) { setV(body); return } if (t !== body) onSave(t) }
  return (
    <RichTextarea autoFocus className="entry-edit" rows={Math.max(2, v.split('\n').length + (note ? 1 : 0))} value={v} onChange={setV} onBlur={finish}
      onKeyDown={e => { if (e.key === 'Escape') { setV(body); setEditing(false) } }} />
  )
}
