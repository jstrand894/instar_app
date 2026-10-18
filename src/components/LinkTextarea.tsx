import { useRef, useState, type TextareaHTMLAttributes } from 'react'
import { useLinks, type LinkTarget } from '../lib/links'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string; onChange: (v: string) => void }

/** A text box that suggests projects and papers when you type [[ and inserts the link for you. */
export default function LinkTextarea({ value, onChange, onKeyDown, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const { options } = useLinks()
  const [caret, setCaret] = useState(0)
  const [idx, setIdx] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const m = /\[\[([^\]\n]*)$/.exec(value.slice(0, caret))
  const matches: LinkTarget[] = m && !dismissed ? options(m[1]).slice(0, 6) : []

  function pick(t: LinkTarget) {
    if (!m) return
    const start = caret - m[0].length
    const after = value.slice(caret).replace(/^\]\]/, '')
    const ins = `[[${t.label}]]`
    onChange(value.slice(0, start) + ins + after)
    const pos = start + ins.length
    setTimeout(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos); setCaret(pos) }, 0)
  }

  return (
    <div className="lt-wrap">
      <textarea ref={ref} {...rest} value={value}
        onChange={e => { onChange(e.target.value); setCaret(e.target.selectionStart); setIdx(0); setDismissed(false) }}
        onKeyUp={e => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
        onClick={e => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
        onKeyDown={e => {
          if (matches.length) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => (i + 1) % matches.length); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => (i + matches.length - 1) % matches.length); return }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); pick(matches[idx] ?? matches[0]); return }
            if (e.key === 'Escape') { e.stopPropagation(); setDismissed(true); return }
          }
          onKeyDown?.(e)
        }} />
      {matches.length > 0 && (
        <ul className="lt-menu" role="listbox">
          {matches.map((t, i) => (
            <li key={t.kind + t.id} role="option" aria-selected={i === idx} className={i === idx ? 'sel' : ''}
              onMouseDown={e => { e.preventDefault(); pick(t) }} onMouseEnter={() => setIdx(i)}>
              <span>{t.label}</span><small className="muted">{t.kind === 'paper' ? 'Paper' : t.sub}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
