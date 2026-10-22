// Lists a repo's recent commits (default branch) so the app can offer to load them as timeline entries when a repo is connected.
// Deploy:  supabase functions deploy github-history      (JWT verification stays ON: only signed-in users reach it)
// Secrets: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_OWNER_EMAILS (same as github-repos)
import { createSign } from 'node:crypto'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ownerEmails } from '../_shared/owner.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const b64 = (v: string | Uint8Array) => btoa(typeof v === 'string' ? v : String.fromCharCode(...v)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

function appJwt(appId: string, pem: string): string {
  const now = Math.floor(Date.now() / 1000)
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), body = b64(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }))
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(pem.replace(/\\n/g, '\n'))
  return `${head}.${body}.${b64(new Uint8Array(sig))}`
}
const gh = (path: string, token: string, method = 'GET') => fetch(`https://api.github.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'instar' } }).then(r => r.json())

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data } = await db.auth.getUser((req.headers.get('authorization') ?? '').replace(/^Bearer /i, ''))
  const email = data.user?.email?.toLowerCase()
  if (!email || !ownerEmails().includes(email)) return json({ error: 'not allowed' }, 403)

  const { repo } = await req.json().catch(() => ({}))
  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return json({ error: 'bad repo' }, 400)
  const appId = Deno.env.get('GITHUB_APP_ID'), pem = Deno.env.get('GITHUB_APP_PRIVATE_KEY')
  if (!appId || !pem) return json({ error: 'GitHub App is not configured' }, 501)
  try {
    const jwt = appJwt(appId, pem)
    const inst = await gh(`/repos/${repo}/installation`, jwt)
    if (!inst.id) return json({ error: 'The GitHub App is not installed on this repo' }, 404)
    const t = await gh(`/app/installations/${inst.id}/access_tokens`, jwt, 'POST')
    const list = await gh(`/repos/${repo}/commits?per_page=100`, t.token)
    if (!Array.isArray(list)) return json({ error: list?.message ?? 'Could not read commits' }, 502)
    const commits = list.map((c: { sha: string; html_url: string; commit: { message: string; author?: { date?: string }; committer?: { date?: string } } }) => ({
      sha: c.sha, message: c.commit.message, url: c.html_url, date: c.commit.committer?.date ?? c.commit.author?.date ?? null,
    }))
    return json({ commits })
  } catch (e) { return json({ error: String(e) }, 500) }
})
