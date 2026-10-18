import { useState } from 'react'
import { NavLink, Route, Routes, HashRouter, useLocation } from 'react-router-dom'
import AuthGate from './components/Auth'
import Pomodoro from './components/Pomodoro'
import Home from './pages/Home'
import Library from './pages/Library'
import Reader from './pages/Reader'
import { demoMode } from './lib/supabase'
import { isDesktop } from './lib/util'

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)
const ICONS = {
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  papers: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
}

function Shell({ signOut }: { signOut: (() => void) | null }) {
  const reading = useLocation().pathname.startsWith('/read/')
  const [bannerOff, setBannerOff] = useState(() => sessionStorage.getItem('tm-banner') === '1')
  const desktop = isDesktop()
  return (
    <div className={`shell ${reading ? 'in-reader' : ''}`}>
      <nav className="nav">
        <div className="brand"><span className="logo" />Lab Notebook</div>
        <NavLink to="/" end><Icon d={ICONS.projects} /><span>Projects</span></NavLink>
        <NavLink to="/library"><Icon d={ICONS.papers} /><span>Papers</span></NavLink>
        <div className="spacer" />
        {desktop && <Pomodoro />}
        {signOut && <button className="link small" onClick={signOut}>Sign out</button>}
      </nav>
      <main>
        {demoMode && !bannerOff && (
          <div className="banner">
            <span>Demo mode: data is saved only in this browser. Add your Supabase keys to <code>.env</code> to sync across devices.</span>
            <button className="link" onClick={() => { sessionStorage.setItem('tm-banner', '1'); setBannerOff(true) }} aria-label="Dismiss">×</button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/read/:id" element={<Reader />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      {signOut => <HashRouter><Shell signOut={signOut} /></HashRouter>}
    </AuthGate>
  )
}
