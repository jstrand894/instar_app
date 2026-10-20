import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Icon from '../Icon'
import InlineEdit from '../InlineEdit'
import { store } from '../../lib/store'
import { notify } from '../../lib/notify'
import { friendlyError } from '../../lib/errors'
import type { TodayData } from '../../lib/useTodayData'
import type { Pin } from '../../types'

function PinRow({ pin, project, onDone, onRename, onDelete }: {
  pin: Pin; project?: { id: string; name: string }; onDone: () => void; onRename: (v: string) => void; onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: pin.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`task-row trow ${isDragging ? 'dragging-card' : ''}`}>
      <button type="button" ref={setActivatorNodeRef} className="grip" {...attributes} {...listeners} aria-label={`Drag to reorder "${pin.title}"`}><Icon name="grip" size={14} /></button>
      <input type="checkbox" className="tick" checked={false} onChange={onDone} aria-label={`Mark "${pin.title}" done`} />
      <InlineEdit value={pin.title} className="task-title" onSave={onRename} />
      {project && <Link to={`/project/${project.id}`} className="muted small task-proj">{project.name}</Link>}
      <span className="task-fill" />
      <button type="button" className="link small danger task-x" aria-label={`Remove "${pin.title}"`} onClick={onDelete}>×</button>
    </li>
  )
}

/** Things to work on that are not to-dos. Stays until you finish it; the top one is your next. */
export default function Pinned({ d }: { d: TodayData }) {
  const [pins, setPins] = useState<Pin[]>([])
  const [title, setTitle] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const load = useCallback(() => { store.pins().then(setPins).catch(() => {}) }, [])
  useEffect(() => { load(); window.addEventListener('tm-data', load); return () => window.removeEventListener('tm-data', load) }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    try { await store.addPin({ title: title.trim(), project_id: null }); setTitle(''); load() } catch (er) { d.setError(friendlyError(er)) }
  }
  function drop(e: DragEndEvent) {
    const from = pins.findIndex(p => p.id === e.active.id), to = pins.findIndex(p => p.id === e.over?.id)
    if (from < 0 || to < 0 || from === to) return
    const next = arrayMove(pins, from, to); setPins(next)
    store.reorderPins(next.map(p => p.id)).catch(er => { d.setError(friendlyError(er)); load() })
  }
  function finish(p: Pin) {
    setPins(ps => ps.filter(x => x.id !== p.id))
    store.patchPin(p.id, { done: true, done_at: new Date().toISOString() }).then(() => {
      notify.action(`Finished "${p.title}"`, 'Undo', async () => { await store.patchPin(p.id, { done: false, done_at: null }); load() })
    }).catch(er => { d.setError(friendlyError(er)); load() })
  }

  return (
    <section className={`card ${pins.length ? '' : 'slim'}`}>
      <h2>Next up {pins.length > 0 && <span className="count-pill">{pins.length}</span>}</h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drop}>
        <SortableContext items={pins.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <ul className="plain">
            {pins.map(p => (
              <PinRow key={p.id} pin={p} project={p.project_id ? d.byId.get(p.project_id) : undefined} onDone={() => finish(p)}
                onRename={v => store.patchPin(p.id, { title: v }).then(load)}
                onDelete={() => notify.undoable(`Removed "${p.title}"`, () => store.deletePin(p.id), [p.id])} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {!pins.length && <p className="muted">Projects you want to tackle that aren't a to-do. Add one below and it stays here until you finish it.</p>}
      <form onSubmit={add} className="row"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Something to work on next…" aria-label="Add to Next up" style={{ flex: 1 }} /></form>
    </section>
  )
}
