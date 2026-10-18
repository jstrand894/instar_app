import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function AuthGate({ children }: { children: (signOut: (() => void) | null) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabase) return <>{children(null)}</>
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

  return (
    <div className="center">
      <form className="card auth" onSubmit={submit}>
        <h1>Lab Notebook</h1>
        <p className="muted">{mode === 'in' ? 'Sign in to your workspace' : 'Create your account'}</p>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        <button className="primary" disabled={busy}>{mode === 'in' ? 'Sign in' : 'Sign up'}</button>
        {msg && <p className="error">{msg}</p>}
        <button type="button" className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
