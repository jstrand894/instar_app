import type { ReactNode } from 'react'

const PATHS: Record<string, string> = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  pen: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  book: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  check: 'M5 12l4 4 10-10',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
}

/** A friendly "nothing here yet": an icon, a sentence on what it is for, and what to do next. */
export default function Empty({ icon = 'folder', title, children, actions, dashed = false }: { icon?: keyof typeof PATHS; title: string; children?: ReactNode; actions?: ReactNode; dashed?: boolean }) {
  return (
    <div className={`empty-box ${dashed ? 'dashed' : ''}`}>
      <span className="empty-ico" aria-hidden>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={PATHS[icon]} /></svg>
      </span>
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
      {actions && <div className="row wrap empty-actions">{actions}</div>}
    </div>
  )
}
