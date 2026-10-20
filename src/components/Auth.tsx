import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { guest, setGuest, supabase } from '../lib/supabase'

export default function AuthGate({ children }: { children: (signOut: (() => void) | null) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabase) return <>{children(guest ? () => setGuest(false) : null)}</>
  if (session === undefined) return <div className="center muted">Loading…</div>
  if (!session) return <SignIn />
  return <>{children(() => { supabase!.auth.signOut() })}</>
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg('')
    const auth = supabase!.auth
    const { error } = mode === 'in'
      ? await auth.signInWithPassword({ email, password })
      : await auth.signUp({ email, password })
    if (error) setMsg(error.message)
    else if (mode === 'up') setMsg('Account created. Check your email to confirm if required, then sign in.')
    setBusy(false)
  }

  async function oauth(provider: 'github') {
    setMsg('')
    const { error } = await supabase!.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
    if (error) setMsg(error.message)
  }

  return (
    <div className="center">
      <form className="card auth" onSubmit={submit}>
        <h1>Instar</h1>
        <p className="muted">{mode === 'in' ? 'Sign in to your workspace' : 'Create your account'}</p>
        <button type="button" className="google" onClick={() => oauth('github')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
          </svg>
          Continue with GitHub
        </button>
        <div className="or"><span>or</span></div>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        <button className="primary" disabled={busy}>{mode === 'in' ? 'Sign in' : 'Sign up'}</button>
        {msg && <p className="error">{msg}</p>}
        <button type="button" className="link" onClick={() => setGuest(true)}>Continue without signing in</button>
        <button type="button" className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
