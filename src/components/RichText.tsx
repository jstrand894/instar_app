import { useRef, useState, type FocusEvent, type ReactNode, type TextareaHTMLAttributes } from 'react'
import LinkedText from './LinkedText'
import LinkTextarea from './LinkTextarea'

/* Notes are stored as light markdown: **bold**, *italic*, __underline__, ~~strike~~, `code`,
   "- " bullets, "1. " numbers, "## " headings. Existing plain notes stay valid as they are. */

const INLINE = /\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|`([^`]+)`|\*(?!\s)(.+?)\*/

function inline(s: string, k = 0): ReactNode[] {
  const out: ReactNode[] = []
  let rest = s, n = 0
  while (rest) {
    const m = INLINE.exec(rest)
    if (!m) { out.push(<LinkedText key={`${k}-${n++}`} text={rest} />); break }
    if (m.index > 0) out.push(<LinkedText key={`${k}-${n++}`} text={rest.slice(0, m.index)} />)
    const key = `${k}-${n++}`
    if (m[1] !== undefined) out.push(<strong key={key}>{inline(m[1], n)}</strong>)
    else if (m[2] !== undefined) out.push(<u key={key}>{inline(m[2], n)}</u>)
    else if (m[3] !== undefined) out.push(<s key={key}>{inline(m[3], n)}</s>)
    else if (m[4] !== undefined) out.push(<code key={key}>{m[4]}</code>)
    else out.push(<em key={key}>{inline(m[5], n)}</em>)
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}

type LItem = { i: number; indent: number; kind: 'ul' | 'ol' | 'todo'; done: boolean; t: string }
type LNode = LItem & { kids: LNode[] }
const LIST_RE = /^(\s*)(?:([-*•])\s+\[( |x)\]\s+|([-*•])\s+|\d+[.)]\s+)(.*)$/i

function listItems(lines: string[], from: number): LItem[] {
  const out: LItem[] = []
  for (let i = from; i < lines.length; i++) {
    const m = LIST_RE.exec(lines[i]); if (!m) break
    out.push({ i, indent: m[1].replace(/\t/g, '  ').length, kind: m[2] ? 'todo' : m[4] ? 'ul' : 'ol', done: m[3] === 'x' || m[3] === 'X', t: m[5] })
  }
  return out
}

function buildTree(items: LItem[]): LNode[] {
  const root: LNode[] = [], stack: LNode[] = []
  for (const it of items) {
    const node = { ...it, kids: [] }
    while (stack.length && stack[stack.length - 1].indent >= it.indent) stack.pop()
    ;(stack.length ? stack[stack.length - 1].kids : root).push(node)
    stack.push(node)
  }
  return root
}

function renderTree(nodes: LNode[], lines: string[], onToggle: ((next: string) => void) | undefined, key0: number): ReactNode[] {
  const out: ReactNode[] = []
  for (let j = 0; j < nodes.length;) {
    const kind = nodes[j].kind
    const group: LNode[] = []
    while (j < nodes.length && nodes[j].kind === kind) group.push(nodes[j++])
    const lis = group.map(n => (
      <li key={n.i} className={n.done ? 'done' : ''}>
        {kind === 'todo' && <><input type="checkbox" checked={n.done} onClick={e => e.stopPropagation()} onChange={() => {
          const next = [...lines]; next[n.i] = lines[n.i].replace(/\[( |x)\]/i, n.done ? '[ ]' : '[x]'); onToggle?.(next.join('\n'))
        }} /> </>}
        <span>{inline(n.t, n.i)}</span>
        {n.kids.length > 0 && renderTree(n.kids, lines, onToggle, n.i)}
      </li>))
    const k = `${key0}-${out.length}`
    out.push(kind === 'ol' ? <ol key={k}>{lis}</ol> : <ul key={k} className={kind === 'todo' ? 'rt-todos' : undefined}>{lis}</ul>)
  }
  return out
}

export function RichView({ text, onToggle }: { text: string; onToggle?: (next: string) => void }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  for (let i = 0; i < lines.length;) {
    const line = lines[i]
    const items = listItems(lines, i)
    if (items.length) {
      i += items.length
      blocks.push(...renderTree(buildTree(items), lines, onToggle, blocks.length))
      continue
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      blocks.push(<p key={blocks.length} className={`rt-h rt-h${h[1].length}`}>{inline(h[2])}</p>); i++
    } else { blocks.push(<p key={blocks.length}>{line ? inline(line) : <br />}</p>); i++ }
  }
  return <div className="rich">{blocks}</div>
}

type TA = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string; onChange: (v: string) => void }

/** The note editor: a formatting bar over the link-aware textarea, with ⌘B / ⌘I / ⌘U shortcuts and bullet continuation. */
const PRETTY_KEY = 'notes-pretty'
function loadPretty() { try { return localStorage.getItem(PRETTY_KEY) === '1' } catch { return false } }

export default function RichTextarea({ value, onChange, onKeyDown, onBlur, ...rest }: TA) {
  const wrap = useRef<HTMLDivElement>(null)
  const [pretty, setPretty] = useState(loadPretty)
  function setMode(next: boolean) {
    if (next === pretty) return
    try { localStorage.setItem(PRETTY_KEY, next ? '1' : '0') } catch { /* ignore */ }
    if (next) wrap.current?.focus()
    setPretty(next)
    if (!next) setTimeout(() => { const el = wrap.current?.querySelector('textarea'); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length) }, 0)
  }
  const switcher = (
    <div className="seg fmt-switch" role="group" aria-label="Note view">
      <button type="button" className={!pretty ? 'on' : ''} onMouseDown={e => e.preventDefault()} onClick={() => setMode(false)} title="Show the markdown as typed">Raw</button>
      <button type="button" className={pretty ? 'on' : ''} onMouseDown={e => e.preventDefault()} onClick={() => setMode(true)} title="Show bold, italics, lists and headings as formatted">Pretty</button>
    </div>
  )
  const ta = () => wrap.current?.querySelector('textarea') ?? null

  function apply(fn: (v: string, a: number, b: number) => { v: string; a: number; b: number }) {
    const el = ta(); if (!el) return
    const r = fn(value, el.selectionStart, el.selectionEnd)
    onChange(r.v)
    setTimeout(() => { el.focus(); el.setSelectionRange(r.a, r.b) }, 0)
  }
  const wrapSel = (open: string, close = open) => apply((v, a, b) => {
    const sel = v.slice(a, b)
    if (sel.startsWith(open) && sel.endsWith(close) && sel.length >= open.length + close.length) {
      const inner = sel.slice(open.length, sel.length - close.length)
      return { v: v.slice(0, a) + inner + v.slice(b), a, b: a + inner.length }
    }
    if (v.slice(a - open.length, a) === open && v.slice(b, b + close.length) === close)
      return { v: v.slice(0, a - open.length) + sel + v.slice(b + close.length), a: a - open.length, b: b - open.length }
    return { v: v.slice(0, a) + open + sel + close + v.slice(b), a: a + open.length, b: b + open.length }
  })
  const prefixLines = (make: (i: number) => string, strip: RegExp) => apply((v, a, b) => {
    const start = v.lastIndexOf('\n', a - 1) + 1
    let end = v.indexOf('\n', b); if (end < 0) end = v.length
    const lines = v.slice(start, end).split('\n')
    const all = lines.every(l => strip.test(l))
    const next = lines.map((l, i) => all ? l.replace(strip, '') : (/^\s*/.exec(l)?.[0] ?? '') + make(i) + l.replace(/^\s*([-*•]|\d+[.)]|#{1,3})\s+(\[[ x]\]\s+)?/i, '')).join('\n')
    return { v: v.slice(0, start) + next + v.slice(end), a: start, b: start + next.length }
  })

  const indentLines = (dir: 1 | -1) => apply((v, a, b) => {
    const start = v.lastIndexOf('\n', a - 1) + 1
    let end = v.indexOf('\n', b); if (end < 0) end = v.length
    let first = 0, total = 0
    const next = v.slice(start, end).split('\n').map((l, i) => {
      const r = dir > 0 ? '  ' + l : l.replace(/^( {1,2}|\t)/, '')
      if (i === 0) first = r.length - l.length
      total += r.length - l.length
      return r
    }).join('\n')
    return { v: v.slice(0, start) + next + v.slice(end), a: Math.max(start, a + first), b: b + total }
  })

  const bar: { label: ReactNode; title: string; run: () => void }[] = [
    { label: <b>B</b>, title: 'Bold (⌘B)', run: () => wrapSel('**') },
    { label: <i>I</i>, title: 'Italic (⌘I)', run: () => wrapSel('*') },
    { label: <u>U</u>, title: 'Underline (⌘U)', run: () => wrapSel('__') },
    { label: <s>S</s>, title: 'Strikethrough', run: () => wrapSel('~~') },
    { label: 'H', title: 'Heading', run: () => prefixLines(() => '## ', /^##\s+/) },
    { label: '•', title: 'Bulleted list', run: () => prefixLines(() => '- ', /^\s*[-*•]\s+/) },
    { label: '☑', title: 'Checklist', run: () => prefixLines(() => '- [ ] ', /^\s*[-*]\s+\[[ x]\]\s+/i) },
    { label: '1.', title: 'Numbered list', run: () => prefixLines(i => `${i + 1}. `, /^\s*\d+[.)]\s+/) },
    { label: '⇥', title: 'Indent (Tab)', run: () => indentLines(1) },
    { label: '⇤', title: 'Outdent (⇧Tab)', run: () => indentLines(-1) },
    { label: '</>', title: 'Code', run: () => wrapSel('`') },
  ]

  function keys(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.metaKey || e.ctrlKey
    if (mod && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase()
      if (k === 'b') { e.preventDefault(); wrapSel('**'); return }
      if (k === 'i') { e.preventDefault(); wrapSel('*'); return }
      if (k === 'u') { e.preventDefault(); wrapSel('__'); return }
    }
    if (e.key === 'Tab' && !mod && !e.altKey) {
      const el = e.currentTarget, ls = value.lastIndexOf('\n', el.selectionStart - 1) + 1
      if (LIST_RE.test(value.slice(ls).split('\n')[0]) || e.shiftKey && /^( |\t)/.test(value.slice(ls))) { e.preventDefault(); indentLines(e.shiftKey ? -1 : 1); return }
    }
    if (e.key === 'Enter' && !mod && !e.shiftKey) {
      const el = e.currentTarget, pos = el.selectionStart
      if (pos === el.selectionEnd) {
        const start = value.lastIndexOf('\n', pos - 1) + 1
        const line = value.slice(start, pos)
        const m = /^(\s*)([-*•]|\d+[.)])\s(?:\[[ x]\]\s)?(.*)$/.exec(line)
        const isTodo = /^\s*[-*]\s\[[ x]\]\s/i.test(line)
        if (m && value.slice(pos).split('\n')[0] === '') {
          e.preventDefault()
          if (!m[3]) { apply(v => ({ v: v.slice(0, start) + v.slice(pos), a: start, b: start })); return }
          const num = /^\d+/.exec(m[2]); const mark = num ? `${+num[0] + 1}${m[2].slice(-1)}` : m[2]
          const ins = `\n${m[1]}${mark} ${isTodo ? '[ ] ' : ''}`
          apply(v => ({ v: v.slice(0, pos) + ins + v.slice(pos), a: pos + ins.length, b: pos + ins.length }))
          return
        }
      }
    }
    onKeyDown?.(e)
  }

  const leave = (e: FocusEvent<HTMLDivElement>) => {
    if (e.relatedTarget instanceof Node && wrap.current?.contains(e.relatedTarget)) return
    onBlur?.(e as unknown as FocusEvent<HTMLTextAreaElement>)
  }
  const esc = (e: React.KeyboardEvent<HTMLDivElement>) => { if (pretty && e.target === e.currentTarget) onKeyDown?.(e as unknown as React.KeyboardEvent<HTMLTextAreaElement>) }

  return (
    <div className="fmt-wrap" ref={wrap} tabIndex={-1} onBlur={leave} onKeyDown={esc}>
      <div className="fmt-bar" role="toolbar" aria-label="Formatting">
        {!pretty && bar.map((b, i) => (
          <button key={i} type="button" title={b.title} aria-label={b.title} onMouseDown={e => e.preventDefault()} onClick={b.run}>{b.label}</button>
        ))}
        {switcher}
      </div>
      {pretty
        ? <div className="fmt-preview" title="Click to edit" onClick={e => { if (!(e.target as HTMLElement).closest('a, input')) setMode(false) }}>
            {value.trim() ? <RichView text={value} onToggle={onChange} /> : <span className="muted">Nothing here yet.</span>}
          </div>
        : <LinkTextarea {...rest} value={value} onChange={onChange} onKeyDown={keys} />}
    </div>
  )
}
