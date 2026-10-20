import { Suspense, lazy, useEffect, useState } from 'react'
import { NavLink, Route, Routes, HashRouter, useLocation } from 'react-router-dom'
import AuthGate from './components/Auth'
import Pomodoro from './components/Pomodoro'
import Account from './components/Account'
import Logo from './components/Logo'
import PageSkeleton from './components/PageSkeleton'
import Toasts from './components/Toasts'
import SyncStatus from './components/SyncStatus'
import OfflineBar from './components/OfflineBar'
const CommandPalette = lazy(() => import('./components/CommandPalette'))
import QuickCapture from './components/QuickCapture'
const Tour = lazy(() => import('./components/Tour'))
import { LinksProvider } from './lib/links'
import Today from './pages/Today'
const Home = lazy(() => import('./pages/Home'))
const Manuscripts = lazy(() => import('./pages/Manuscripts'))
const Library = lazy(() => import('./pages/Library'))
const Reader = lazy(() => import('./pages/Reader'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Review = lazy(() => import('./pages/Review'))
import { demoMode } from './lib/supabase'
import { isDesktop } from './lib/util'

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)
const ICONS = {
  today: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  manuscripts: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  review: 'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4M8 15l2.5 2.5L16 13',
  papers: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  pin: 'M9 3h6M10 3v6l-4 5h12l-4-5V3M12 14v7',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
}

function Shell({ signOut }: { signOut: (() => void) | null }) {
  const reading = useLocation().pathname.startsWith('/read/')
  const [bannerOff, setBannerOff] = useState(() => sessionStorage.getItem('tm-banner') === '1')
  const desktop = isDesktop()
  // Mouse-and-trackpad devices start with a slim rail that slides open on hover; touch devices start pinned open.
  const [navMode, setNavMode] = useState<'auto' | 'pinned'>(() => {
    try { const v = localStorage.getItem('tm-nav'); if (v === 'auto' || v === 'pinned') return v } catch { /* ignore */ }
    return desktop ? 'auto' : 'pinned'
  })
  useEffect(() => {
    const idle: (cb: () => void) => void = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? (cb => setTimeout(cb, 1800))
    idle(() => { import('./pages/Home'); import('./pages/Manuscripts'); import('./pages/ProjectDetail'); import('./pages/Library'); import('./pages/Review') })
  }, [])
  useEffect(() => {
    const brand = document.querySelector<HTMLElement>('.brand'); const text = document.querySelector<HTMLElement>('.brand-text')
    if (!brand || !text) return
    const measure = () => brand.style.setProperty('--tw', `${text.getBoundingClientRect().width}px`)
    measure(); document.fonts?.ready.then(measure)
  }, [])
  const [railShut, setRailShut] = useState(false)
  const toggleNav = () => setNavMode(m => { const n = m === 'auto' ? 'pinned' : 'auto'; try { localStorage.setItem('tm-nav', n) } catch { /* ignore */ } return n })
  return (
    <div className={`shell nav-${navMode} ${reading ? 'in-reader' : ''} ${railShut ? 'nav-shut' : ''}`}>
      {/* after you click a page, the rail stays slim until the pointer leaves and comes back */}
      <nav className="nav" onClick={e => { if (e.detail > 0 && (e.target as HTMLElement).closest('a')) setRailShut(true) }} onMouseLeave={() => setRailShut(false)}>
        <div className="brand"><Logo size={64} /><span className="brand-text">Instar</span></div>
        <button className="nav-search" onClick={() => window.dispatchEvent(new CustomEvent('tm-search'))} title="Search (⌘K or /)">
          <Icon d={ICONS.search} /><span>Search</span><kbd>⌘K</kbd>
        </button>
        <NavLink to="/" end><Icon d={ICONS.today} /><span>Today</span></NavLink>
        <NavLink to="/projects"><Icon d={ICONS.projects} /><span>Projects</span></NavLink>
        <NavLink to="/manuscripts"><Icon d={ICONS.manuscripts} /><span>Manuscripts</span></NavLink>
        <NavLink to="/library"><Icon d={ICONS.papers} /><span>Reading</span></NavLink>
        <NavLink to="/review"><Icon d={ICONS.review} /><span>Review</span></NavLink>
        <div className="spacer" />
        <SyncStatus />
        {desktop && <Pomodoro />}
        <button className="nav-toggle" onClick={toggleNav} aria-pressed={navMode === 'pinned'}
          title={navMode === 'pinned' ? 'Let the sidebar slide away when not in use' : 'Keep the sidebar open'}>
          <Icon d={ICONS.pin} /><span>{navMode === 'pinned' ? 'Auto-hide sidebar' : 'Pin sidebar open'}</span>
        </button>
        <Account signOut={signOut} />
      </nav>
      <main>
        <OfflineBar />
        {demoMode && !bannerOff && (
          <div className="banner">
            <span>Demo mode: data is saved only in this browser. Add your Supabase keys to <code>.env</code> to sync across devices.</span>
            <button className="link" onClick={() => { sessionStorage.setItem('tm-banner', '1'); setBannerOff(true) }} aria-label="Dismiss">×</button>
          </div>
        )}
        <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/projects" element={<Home />} />
          <Route path="/manuscripts" element={<Manuscripts />} />
          <Route path="/project/:id" element={<ProjectDetail />} />
          <Route path="/library" element={<Library />} />
          <Route path="/read/:id" element={<Reader />} />
          <Route path="/review" element={<Review />} />
        </Routes>
        </Suspense>
      </main>
      <Suspense fallback={null}><Tour /><CommandPalette /></Suspense>
      <QuickCapture />
      <Toasts />
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      {signOut => <HashRouter><LinksProvider><Shell signOut={signOut} /></LinksProvider></HashRouter>}
    </AuthGate>
  )
}
