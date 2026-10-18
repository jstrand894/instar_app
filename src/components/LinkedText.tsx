import { Link } from 'react-router-dom'
import { parsePieces, useLinks } from '../lib/links'

/** Text where [[Name]] becomes a link to that project or paper, and #tag opens a search for the tag. */
export default function LinkedText({ text }: { text: string }) {
  const { resolve } = useLinks()
  return (
    <>
      {parsePieces(text).map((p, i) => {
        if (p.t === 'text') return <span key={i}>{p.s}</span>
        if (p.t === 'tag') {
          return <a key={i} href="#search" className="tag-link" onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('tm-search', { detail: '#' + p.s.toLowerCase() })) }}>#{p.s}</a>
        }
        const t = resolve(p.s)
        return t
          ? <Link key={i} to={t.kind === 'project' ? `/project/${t.id}` : `/read/${t.id}`} className="wiki-link" title={t.label}>{p.s}</Link>
          : <span key={i} className="wiki-link missing" title="No project or paper with that name">{p.s}</span>
      })}
    </>
  )
}
