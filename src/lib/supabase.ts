import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && key ? createClient(url, key) : null
export const demoMode = !supabase

// Open the connection to Supabase early so the first request does not wait for it.
if (url && typeof document !== 'undefined') {
  const link = document.createElement('link'); link.rel = 'preconnect'; link.href = new URL(url).origin; link.crossOrigin = ''
  document.head.appendChild(link)
}
