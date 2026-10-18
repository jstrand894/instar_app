import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/fredoka/latin-600.css'
import './index.css'
import App from './App.tsx'
import { applyPrefs, watchSystemTheme } from './lib/prefs'

applyPrefs(); watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
