import { useEffect, useState } from 'react'
import { demoMode, supabase } from '../lib/supabase'
import { ago } from '../lib/util'
import Icon from './Icon'

/** "https://github.com/Owner/Repo.git", "git@github.com:Owner/Repo" or "Owner/Repo" -> "owner/repo" (null if it is not one). */
export function parseRepo(v: string): string | null {
  const m = v.trim().replace(/\.git$/i, '').match(/(?:github\.com[/:])?([\w.-]+)\/([\w.-]+)\/?$/i)
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : null
}

const hookUrl = () => `${import.meta.env.VITE_SUPABASE_URL ?? 'https://<your-project>.supabase.co'}/functions/v1/github-webhook`

/** Link a project to a GitHub repo: pushes to it show up in this project's timeline (through the github-webhook function). */
export default function GithubLink({ repo, lastPush, pushes, onChange }: { repo: string | null; lastPush?: string; pushes: number; onChange: (r: string | null) => void }) {
  // repos your GitHub App is installed on; null while loading or when the App is not set up (then it falls back to typing a name + per-repo webhook)
  const [app, setApp] = useState<{ repos: string[]; installUrl: string | null } | null>(null)
  const [checked, setChecked] = useState(!supabase) // the lookup has finished (successfully or not)
  useEffect(() => {
    if (!supabase) return
    let off = false
    supabase.functions.invoke('github-repos').then(({ data, error }) => { if (off) return; if (!error && data?.repos) setApp({ repos: data.repos, installUrl: data.installUrl }); setChecked(true) }, () => { if (!off) setChecked(true) })
    return () => { off = true }
  }, [])
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState('')
  const [bad, setBad] = useState(false)
  const [help, setHelp] = useState(false)

  function save(e: React.FormEvent) {
    e.preventDefault()
    const r = parseRepo(v)
    if (!r) { setBad(true); return }
    onChange(r); setEditing(false); setV(''); setBad(false); setHelp(!app)
  }

  return (
    <div className="gh-link">
      {repo && !editing ? (() => {
        const state = !checked ? 'checking' : app ? (app.repos.includes(repo) ? 'ok' : 'warn') : 'hook'
        return (
          <div className={`gh-card ${state}`}>
            <span className="gh-badge" aria-hidden>{state === 'warn' ? <Icon name="alert" size={18} /> : state === 'checking' ? <Icon name="git" size={18} /> : <Icon name="check" size={18} />}</span>
            <div className="gh-info">
              <div className="gh-title">
                <b>{state === 'ok' ? 'Repository connected' : state === 'warn' ? 'Needs attention' : state === 'hook' ? 'Repository linked' : 'Checking repository…'}</b>
                <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">{repo}</a>
              </div>
              <div className="muted small">
                {state === 'ok' && 'The GitHub App is installed on this repo. '}
                {state === 'hook' && 'Using a repo webhook. '}
                {state === 'warn' && <>The GitHub App isn't installed on this repo, so pushes won't show up. {app?.installUrl && <a href={app.installUrl} target="_blank" rel="noreferrer">Install it</a>}</>}
                {state !== 'warn' && (lastPush ? `Last push ${ago(lastPush)} · ${pushes} logged.` : 'Waiting for the first push.')}
              </div>
            </div>
            <div className="gh-actions">
              {state === 'hook' && <button className="link small" onClick={() => setHelp(!help)}>{help ? 'Hide setup' : 'Webhook setup'}</button>}
              <button className="link small" onClick={() => { setEditing(true); setV(repo) }}>Change</button>
              <button className="link small danger" onClick={() => { onChange(null); setHelp(false) }}>Disconnect</button>
            </div>
          </div>
        )
      })() : editing || !repo ? (
        <form className="gh-row" onSubmit={save}>
          <Icon name="git" size={15} />
          {app && app.repos.length > 0 ? (
            <select value={v} onChange={e => { setV(e.target.value); setBad(false) }} aria-label="GitHub repository">
              <option value="">Choose a repo from GitHub…</option>
              {app.repos.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <input placeholder="Connect a GitHub repo, e.g. owner/name or its URL" value={v} onChange={e => { setV(e.target.value); setBad(false) }} aria-label="GitHub repository" aria-invalid={bad} />
          )}
          <button className="primary" disabled={!v.trim()}>Connect</button>
          {app?.installUrl && <a className="small" href={app.installUrl} target="_blank" rel="noreferrer">Add more repos</a>}
          {editing && <button type="button" onClick={() => { setEditing(false); setBad(false) }}>Cancel</button>}
          {bad && <span className="error small">Use owner/name or a github.com URL.</span>}
        </form>
      ) : null}
      {repo && help && !app && (
        <div className="gh-help small">
          {demoMode && <p className="error">Demo mode keeps data only in this browser, so GitHub can't reach it. Connect Supabase first.</p>}
          <p>One-time setup per repo: on GitHub open <b>Settings → Webhooks → Add webhook</b> and set:</p>
          <ul>
            <li>Payload URL: <code>{hookUrl()}</code></li>
            <li>Content type: <code>application/json</code></li>
            <li>Secret: the value you set as <code>GITHUB_WEBHOOK_SECRET</code></li>
            <li>Events: just the push event</li>
          </ul>
          <p className="muted">The function itself is deployed once (see the README, "Connect GitHub"). After that, every push to a branch adds an entry here.</p>
        </div>
      )}
    </div>
  )
}
