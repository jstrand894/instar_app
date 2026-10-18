import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Step { target?: string[]; title: string; body: string; route?: string }
const KEY = 'tm-tour'

const STEPS: Step[] = [
  { title: 'Welcome to Instar', body: 'A calm home for your projects, manuscripts and reading. This 30-second tour shows where things are. You can skip it any time.', route: '/' },
  { target: ['.nav'], title: 'Your sections', body: 'Today, Projects, Manuscripts and Reading live here. On a Mac the sidebar tucks into a slim strip and slides open when you hover over it.' },
  { target: ['.quick'], title: 'Log in a few seconds', body: 'Pick a project, write what you did, press Log. Every project builds a dated timeline you can look back on.' },
  { target: ['.fab'], title: 'Add anything, anywhere', body: 'The + button adds an update, note, task, deadline or paper from any screen. Keyboard shortcut: N.' },
  { target: ['.nav-search', '.today-search'], title: 'Search and jump', body: 'Find any project, paper, note or task, or run a command. Press ⌘K (or /) anywhere.' },
  { target: ['.progress'], title: 'See your progress', body: 'Weekly activity for reading, projects and manuscripts, with meters underneath.' },
  { title: 'Link your notes', body: 'In any note, type [[ to link a project or paper, and # to add a tag. Linked items show where they are mentioned.' },
  { target: ['.account-btn'], title: 'Make it yours', body: 'Dark mode, accent color, your name and the timer lengths are in Account. You can replay this tour from there.' },
  { title: "You're all set", body: 'Start by adding a project or a manuscript, or import your reading list on the Reading page.' },
]

const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).getBoundingClientRect().width > 0 && getComputedStyle(el).display !== 'none'

/** A short guided tour: dims the page, rings the real element, and explains it. */
export default function Tour() {
  const [step, setStep] = useState<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const nav = useNavigate()

  const start = useCallback(() => { setStep(0); nav('/') }, [nav])
  const finish = useCallback(() => { setStep(null); try { localStorage.setItem(KEY, 'done') } catch { /* ignore */ } }, [])

  // first visit starts it; Account and the search palette can replay it
  useEffect(() => {
    let seen = false; try { seen = localStorage.getItem(KEY) === 'done' } catch { /* ignore */ }
    const t = seen ? undefined : setTimeout(start, 1200)
    window.addEventListener('tm-tour', start)
    return () => { clearTimeout(t); window.removeEventListener('tm-tour', start) }
  }, [start])

  const s = step === null ? null : STEPS[step]
  const find = useCallback((): HTMLElement | null => {
    if (!s?.target) return null
    for (const sel of s.target) { const el = document.querySelector(sel); if (visible(el)) return el }
    return null
  }, [s])

  // follow the target as the page moves or resizes
  useLayoutEffect(() => {
    if (step === null) return
    const el = find()
    el?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    const measure = () => setRect(find()?.getBoundingClientRect() ?? null)
    measure(); const raf = requestAnimationFrame(measure); const t = setTimeout(measure, 250)
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true)
    return () => { cancelAnimationFrame(raf); clearTimeout(t); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [step, find])

  useEffect(() => {
    if (step === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); step < STEPS.length - 1 ? setStep(step + 1) : finish() }
      if (e.key === 'ArrowLeft' && step > 0) setStep(step - 1)
    }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [step, finish])

  if (step === null || !s) return null
  const last = step === STEPS.length - 1
  const pad = 8, W = window.innerWidth, H = window.innerHeight
  const cardW = Math.min(340, W - 24)

  // card position: beside the highlighted element when there is room, otherwise centered
  let style: React.CSSProperties = { left: (W - cardW) / 2, top: Math.max(24, H / 2 - 120), width: cardW }
  if (rect) {
    const roomRight = W - rect.right, roomLeft = rect.left, roomBelow = H - rect.bottom
    if (rect.width < W * 0.5 && roomRight > cardW + 24) style = { left: rect.right + pad + 12, top: Math.min(Math.max(12, rect.top), H - 230), width: cardW }
    else if (rect.width < W * 0.5 && roomLeft > cardW + 24) style = { left: rect.left - cardW - pad - 12, top: Math.min(Math.max(12, rect.top), H - 230), width: cardW }
    else if (roomBelow > 230) style = { left: Math.min(Math.max(12, rect.left), W - cardW - 12), top: rect.bottom + pad + 12, width: cardW }
    else style = { left: Math.min(Math.max(12, rect.left), W - cardW - 12), top: Math.max(12, rect.top - 200), width: cardW }
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Welcome tour">
      <div className="tour-block" onMouseDown={e => e.preventDefault()} />
      {rect
        ? <div className="tour-ring" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
        : <div className="tour-dim" />}
      <div className="tour-card" style={style}>
        <div className="tour-step">{step + 1} of {STEPS.length}</div>
        <h3>{s.title}</h3>
        <p>{s.body}</p>
        <div className="tour-dots" aria-hidden>{STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
        <div className="row between">
          <button className="link small" onClick={finish}>{last ? 'Close' : 'Skip tour'}</button>
          <span className="row">
            {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
            <button className="primary" onClick={() => (last ? finish() : setStep(step + 1))}>{last ? 'Get started' : step === 0 ? 'Start tour' : 'Next'}</button>
          </span>
        </div>
      </div>
    </div>
  )
}
