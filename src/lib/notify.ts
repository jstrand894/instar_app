import { friendlyError, technicalDetail } from './errors'

export interface ToastDetail {
  id: number
  kind: 'info' | 'success' | 'error'
  message: string
  detail?: string
  action?: { label: string; run: () => void }
  duration: number
  /** Runs if the toast times out or is dismissed without its action being used. */
  onExpire?: () => void
}

let nextId = 1
const emit = (d: Omit<ToastDetail, 'id'>) => window.dispatchEvent(new CustomEvent<ToastDetail>('tm-toast', { detail: { ...d, id: nextId++ } }))

/** Deletes wait a few seconds so they can be undone; leaving the page commits them right away. */
const pending = new Set<() => void>()
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') [...pending].forEach(f => f()) })
  window.addEventListener('pagehide', () => [...pending].forEach(f => f()))
}

/** Items deleted-with-undo stay hidden from every list until the delete really happens (or is undone). */
const hidden = new Set<string>()
export const isPendingDelete = (id: unknown) => typeof id === 'string' && hidden.has(id)
const refreshPages = () => window.dispatchEvent(new Event('tm-data'))

export const notify = {
  info: (message: string, duration = 3500) => emit({ kind: 'info', message, duration }),
  success: (message: string, duration = 3000) => emit({ kind: 'success', message, duration }),
  error(e: unknown, retry?: () => void) {
    emit({ kind: 'error', message: friendlyError(e), detail: technicalDetail(e), duration: 8000, action: retry ? { label: 'Try again', run: retry } : undefined })
  },
  /** Hide the item now, then really delete after the toast (unless "Undo" is pressed). */
  undoable(message: string, commit: () => Promise<unknown> | void, ids: string[] = [], duration = 6000) {
    let settled = false
    const unhide = () => ids.forEach(i => hidden.delete(i))
    ids.forEach(i => hidden.add(i))
    const run = () => {
      if (settled) return; settled = true; pending.delete(run)
      Promise.resolve(commit()).then(() => { unhide(); refreshPages() }, err => { unhide(); notify.error(err); refreshPages() })
    }
    pending.add(run)
    emit({
      kind: 'info', message, duration,
      action: { label: 'Undo', run: () => { if (settled) return; settled = true; pending.delete(run); unhide(); refreshPages() } },
      onExpire: run,
    })
    refreshPages()
  },
}
