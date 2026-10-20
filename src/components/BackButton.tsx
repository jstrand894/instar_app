import { useLocation, useNavigate } from 'react-router-dom'

/** Steps back to the page you were on before, e.g. from Today to the project you came from. */
export default function BackButton() {
  const navigate = useNavigate()
  useLocation() // re-render on navigation so the disabled state stays current
  // react-router keeps the position in the history stack on history.state, so we know when there is somewhere to go back to
  const canGoBack = (window.history.state?.idx ?? 0) > 0
  return (
    <button className="hist-back" onClick={() => navigate(-1)} disabled={!canGoBack} aria-label="Back" title="Back to the previous page">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
    </button>
  )
}
