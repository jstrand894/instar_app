import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const GUEST_KEY = 'tm-guest'
const readGuest = () => { try { return localStorage.getItem(GUEST_KEY) === '1' } catch { return false } }
/** Skipped sign-in: the app runs on local, this-browser-only storage instead of Supabase. */
export const guest = !!(url && key) && readGuest()
export function setGuest(on: boolean) {
  try { if (on) localStorage.setItem(GUEST_KEY, '1'); else localStorage.removeItem(GUEST_KEY) } catch { /* ignore */ }
  window.location.reload()
}

export const supabase = url && key && !guest ? createClient(url, key) : null
export const demoMode = !supabase

// Open the connection to Supabase early so the first request does not wait for it.
if (url && !guest && typeof document !== 'undefined') {
  const link = document.createElement('link'); link.rel = 'preconnect'; link.href = new URL(url).origin; link.crossOrigin = ''
  document.head.appendChild(link)
}
