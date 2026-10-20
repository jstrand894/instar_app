// Receives GitHub "push" webhooks and logs them as timeline entries on any project linked to that repo.
// Deploy:  supabase functions deploy github-webhook --no-verify-jwt
// Secrets: GITHUB_WEBHOOK_SECRET (the same string you give GitHub, on the GitHub App or on each repo's webhook)
//          GITHUB_OWNER_EMAILS  (your sign-in email; only your projects receive pushes)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { isOwnerId } from '../_shared/owner.ts'

const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')

async function signatureOk(body: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const want = 'sha256=' + hex(await crypto.subtle.sign('HMAC', key, enc.encode(body)))
  if (want.length !== header.length) return false
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ header.charCodeAt(i) // constant-time compare
  return diff === 0
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })
  const secret = Deno.env.get('GITHUB_WEBHOOK_SECRET')
  if (!secret) return new Response('GITHUB_WEBHOOK_SECRET is not set', { status: 500 })
  const raw = await req.text()
  if (!(await signatureOk(raw, req.headers.get('x-hub-signature-256'), secret))) return new Response('bad signature', { status: 401 })

  const event = req.headers.get('x-github-event')
  if (event === 'ping') return new Response('pong')
  if (event !== 'push') return new Response('ignored')

  const p = JSON.parse(raw)
  if (p.deleted || !String(p.ref ?? '').startsWith('refs/heads/') || !p.commits?.length) return new Response('nothing to log')

  const repo = String(p.repository?.full_name ?? '').toLowerCase()
  const branch = String(p.ref).slice('refs/heads/'.length)
  const n: number = p.commits.length
  // just the commit message(s): one commit is its full message; several are a list, each with its first line.
  let body: string
  if (n === 1) {
    const c = p.commits[0]; const [head, ...rest] = String(c.message).trim().split('\n')
    body = [head.slice(0, 200), rest.join('\n').trim(), `\nPushed to ${branch}`].filter(Boolean).join('\n')
  } else {
    const line = (c: { message: string }) => `• ${c.message.split('\n')[0].slice(0, 120)}`
    body = [`${n} commits pushed to ${branch}`, ...p.commits.slice(0, 10).map(line), ...(n > 10 ? [`…and ${n - 10} more`] : [])].join('\n')
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: projects, error } = await db.from('projects').select('id, user_id').eq('github_repo', repo)
  if (error) return new Response(error.message, { status: 500 })
  const mine = []
  for (const pr of projects ?? []) if (await isOwnerId(db, pr.user_id)) mine.push(pr)
  if (!mine.length) return new Response('no linked project')

  const rows = mine.map(pr => ({
    project_id: pr.id, user_id: pr.user_id, kind: 'commit', body,
    source_url: p.compare ?? p.head_commit?.url ?? null, external_id: `push:${p.after}`,
    created_at: p.head_commit?.timestamp ?? new Date().toISOString(),
  }))
  // a retried delivery has the same external_id, so it is skipped instead of logged twice
  const { error: e2 } = await db.from('project_updates').upsert(rows, { onConflict: 'project_id,external_id', ignoreDuplicates: true })
  return e2 ? new Response(e2.message, { status: 500 }) : new Response('logged')
})
