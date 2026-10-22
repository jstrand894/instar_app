import { useState } from 'react'
import RichTextarea from './RichText'
import { fromLocalInput, toLocalInput } from '../lib/util'
import { isAllDay } from '../lib/sites'
import type { SiteVisit } from '../types'

export interface VisitDraft { visited_at: string; minutes: number | null; purpose: string; notes: string; conditions: string }

/** The fields of one visit: when, how long, why, what you did, and conditions. Used to log, to plan and to edit. */
export default function VisitForm({ initial, planning = false, submitLabel, onSubmit, onCancel }: {
  initial?: Partial<SiteVisit>; planning?: boolean; submitLabel: string
  onSubmit: (d: VisitDraft) => Promise<void> | void; onCancel: () => void
}) {
  const [when, setWhen] = useState(() => toLocalInput(initial?.visited_at ?? new Date().toISOString()))
  const [mins, setMins] = useState(initial?.minutes ? String(initial.minutes) : '')
  const [purpose, setPurpose] = useState(initial?.purpose ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [cond, setCond] = useState(initial?.conditions ?? '')
  const [busy, setBusy] = useState(false)
  // planning a revisit needs only a day (field days are usually all day); a start time is optional
  const [day, setDay] = useState(() => toLocalInput(initial?.visited_at ?? new Date().toISOString()).slice(0, 10))
  const [time, setTime] = useState(() => initial?.visited_at && !isAllDay(initial.visited_at) ? toLocalInput(initial.visited_at).slice(11) : '')
  const at = planning ? fromLocalInput(`${day}T${time || '00:00'}`) : fromLocalInput(when)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!at || busy) return
    setBusy(true)
    try { await onSubmit({ visited_at: at, minutes: mins ? Math.max(1, Math.round(+mins)) : null, purpose: purpose.trim(), notes: notes.trim(), conditions: cond.trim() }) } finally { setBusy(false) }
  }
  return (
    <form className="card form visit-form" onSubmit={submit}>
      <div className="visit-grid">
        {planning
          ? <>
              <label>Planned for<input type="date" value={day} onChange={e => setDay(e.target.value)} required /></label>
              <label>Start time<input type="time" value={time} onChange={e => setTime(e.target.value)} /><span className="muted small">Leave blank for all day</span></label>
            </>
          : <label>When<input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} required /></label>}
        {!planning && <label>Time on site (min)<input type="number" min="1" inputMode="numeric" placeholder="optional" value={mins} onChange={e => setMins(e.target.value)} /></label>}
      </div>
      <label>Purpose<input placeholder={planning ? 'What you need to do there' : 'Why you went (optional)'} value={purpose} onChange={e => setPurpose(e.target.value)} /></label>
      {!planning && (
        <>
          <label>What you did<RichTextarea rows={5} placeholder="Samples taken, measurements, what you saw…" value={notes} onChange={setNotes} /></label>
          <label>Conditions<input placeholder="Weather, crew, access (optional)" value={cond} onChange={e => setCond(e.target.value)} /></label>
        </>
      )}
      <div className="row">
        <button className="primary" disabled={!at || busy}>{submitLabel}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
