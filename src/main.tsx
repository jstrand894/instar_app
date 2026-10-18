import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/caprasimo/latin-400.css'
import './index.css'
import App from './App.tsx'
import { applyPrefs, watchSystemTheme } from './lib/prefs'
import { notify } from './lib/notify'

applyPrefs(); watchSystemTheme()

// Anything that fails without being handled shows up as a calm message instead of silently doing nothing.
window.addEventListener('unhandledrejection', ev => {
  const msg = String((ev.reason as Error)?.message ?? ev.reason ?? '')
  if (/cancel|abort|destroyed|ResizeObserver/i.test(msg) || /Cancel|Abort/.test(String((ev.reason as Error)?.name ?? ''))) return
  ev.preventDefault(); notify.error(ev.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
