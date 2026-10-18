// Supabase Edge Function: calendar-feed
// Reads the signed-in user's saved calendar links (table "calendars", protected by row security),
// downloads each .ics feed on the server (browsers can't, because of CORS), and returns the raw text.
// Deploy: Supabase dashboard -> Edge Functions -> Deploy a new function -> paste this file.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const MAX_BYTES = 8 * 1024 * 1024

/** Only public https hosts: no localhost, internal names or raw IP addresses. */
function allowed(u: URL): boolean {
  if (u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.includes(':')) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false
  return h.includes('.')
}

async function download(raw: string): Promise<string> {
  let url = new URL(raw.trim().replace(/^webcal:\/\//i, 'https://'))
  for (let hop = 0; hop < 4; hop++) {
    if (!allowed(url)) throw new Error('Link not allowed')
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'LabNotebook/1.0', Accept: 'text/calendar, */*' } })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location')!, url); continue }
    if (!res.ok) throw new Error(`Calendar returned HTTP ${res.status}`)
    const text = await res.text()
    if (text.length > MAX_BYTES) throw new Error('Calendar file is too large')
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('That link did not return a calendar feed (.ics)')
    return text
  }
  throw new Error('Too many redirects')
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'Not signed in' }, 401)

  const { data: cals, error } = await sb.from('calendars').select('id,url')
  if (error) return json({ error: error.message }, 500)

  const feeds = await Promise.all((cals ?? []).map(async c => {
    try { return { id: c.id, ics: await download(c.url) } }
    catch (e) { return { id: c.id, error: (e as Error).message } }
  }))
  return json({ feeds })
})
