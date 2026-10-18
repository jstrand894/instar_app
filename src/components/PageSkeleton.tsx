/** Placeholder shown for a moment while a screen's code loads. */
export default function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <div className="sk sk-title" />
      <div className="sk sk-row" />
      <div className="sk-grid"><div className="sk sk-card" /><div className="sk sk-card" /><div className="sk sk-card" /></div>
    </div>
  )
}
