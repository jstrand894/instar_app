import { useRef, type ReactNode, type TextareaHTMLAttributes } from 'react'
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

export function RichView({ text, onToggle }: { text: string; onToggle?: (next: string) => void }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  for (let i = 0; i < lines.length;) {
    const line = lines[i]
    const todo = /^\s*[-*]\s+\[( |x)\]\s+(.*)$/i.exec(line)
    if (todo) {
      const items: { i: number; done: boolean; t: string }[] = []
      while (i < lines.length) { const mm = /^\s*[-*]\s+\[( |x)\]\s+(.*)$/i.exec(lines[i]); if (!mm) break; items.push({ i, done: mm[1] !== ' ', t: mm[2] }); i++ }
      blocks.push(<ul key={blocks.length} className="rt-todos">{items.map(it => (
        <li key={it.i} className={it.done ? 'done' : ''}>
          <input type="checkbox" checked={it.done} onClick={e => e.stopPropagation()} onChange={() => {
            const next = [...lines]; next[it.i] = lines[it.i].replace(/\[( |x)\]/i, it.done ? '[ ]' : '[x]'); onToggle?.(next.join('\n'))
          }} /> <span>{inline(it.t, it.i)}</span>
        </li>))}</ul>)
      continue
    }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line), ol = /^\s*\d+[.)]\s+(.*)$/.exec(line), h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (ul || ol) {
      const re = ul ? /^\s*[-*•]\s+(.*)$/ : /^\s*\d+[.)]\s+(.*)$/
      const items: string[] = []
      while (i < lines.length) { const mm = re.exec(lines[i]); if (!mm) break; items.push(mm[1]); i++ }
      const lis = items.map((t, j) => <li key={j}>{inline(t, j)}</li>)
      blocks.push(ul ? <ul key={blocks.length}>{lis}</ul> : <ol key={blocks.length}>{lis}</ol>)
    } else if (h) {
      blocks.push(<p key={blocks.length} className={`rt-h rt-h${h[1].length}`}>{inline(h[2])}</p>); i++
    } else { blocks.push(<p key={blocks.length}>{line ? inline(line) : <br />}</p>); i++ }
  }
  return <div className="rich">{blocks}</div>
}

type TA = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string; onChange: (v: string) => void }

/** The note editor: a formatting bar over the link-aware textarea, with ⌘B / ⌘I / ⌘U shortcuts and bullet continuation. */
export default function RichTextarea({ value, onChange, onKeyDown, ...rest }: TA) {
  const wrap = useRef<HTMLDivElement>(null)
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
    const next = lines.map((l, i) => all ? l.replace(strip, '') : make(i) + l.replace(/^\s*([-*•]|\d+[.)]|#{1,3})\s+(\[[ x]\]\s+)?/i, '')).join('\n')
    return { v: v.slice(0, start) + next + v.slice(end), a: start, b: start + next.length }
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

  return (
    <div className="fmt-wrap" ref={wrap}>
      <div className="fmt-bar" role="toolbar" aria-label="Formatting">
        {bar.map((b, i) => (
          <button key={i} type="button" title={b.title} aria-label={b.title} onMouseDown={e => e.preventDefault()} onClick={b.run}>{b.label}</button>
        ))}
      </div>
      <LinkTextarea {...rest} value={value} onChange={onChange} onKeyDown={keys} />
    </div>
  )
}
