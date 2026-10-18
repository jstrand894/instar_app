import { supabase } from './supabase'
import { getPrefs } from './prefs'

/** First name for greetings: the name set in Account, else the sign-in profile (e.g. GitHub), else none. */
export async function firstName(): Promise<string> {
  const saved = getPrefs().name.trim()
  if (saved) return saved.split(/\s+/)[0]
  if (!supabase) return ''
  const { data } = await supabase.auth.getUser()
  const m = data.user?.user_metadata ?? {}
  const full = String(m.display_name ?? m.full_name ?? m.name ?? '').trim()
  return full ? full.split(/\s+/)[0] : ''
}
