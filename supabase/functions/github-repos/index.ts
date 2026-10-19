// Lists the repos your GitHub App is installed on, for the "choose a repo" picker in the app.
// Deploy:  supabase functions deploy github-repos      (JWT verification stays ON: only signed-in users reach it)
// Secrets: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (the .pem GitHub gave you), GITHUB_OWNER_EMAILS
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

  const appId = Deno.env.get('GITHUB_APP_ID'), pem = Deno.env.get('GITHUB_APP_PRIVATE_KEY')
  if (!appId || !pem) return json({ error: 'GitHub App is not configured' }, 501)
  try {
    const jwt = appJwt(appId, pem)
    const [app, installs] = await Promise.all([gh('/app', jwt), gh('/app/installations', jwt)])
    const repos: string[] = []
    for (const i of Array.isArray(installs) ? installs : []) {
      const t = await gh(`/app/installations/${i.id}/access_tokens`, jwt, 'POST')
      const r = await gh('/installation/repositories?per_page=100', t.token)
      for (const x of r.repositories ?? []) repos.push(String(x.full_name).toLowerCase())
    }
    return json({ repos: [...new Set(repos)].sort(), installUrl: app.slug ? `https://github.com/apps/${app.slug}/installations/new` : null })
  } catch (e) { return json({ error: String(e) }, 500) }
})
