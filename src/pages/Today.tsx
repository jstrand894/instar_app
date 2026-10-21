import { useEffect, useState } from 'react'
import BackButton from '../components/BackButton'
import { greeting } from '../lib/util'
import { firstName } from '../lib/user'
import { usePrefs } from '../lib/prefs'
import { useTodayData } from '../lib/useTodayData'
import Icon from '../components/Icon'
import ProgressChart from '../components/ProgressChart'
import GettingStarted from '../components/GettingStarted'
import WeatherCard from '../components/WeatherCard'
import AddBar from '../components/AddBar'
import RoutineCard from '../components/RoutineCard'
import RoutineManager from '../components/RoutineManager'
import FocusNow from '../components/today/FocusNow'
import Deadlines from '../components/today/Deadlines'
import PinnedProjects from '../components/today/PinnedProjects'
import SiteVisits from '../components/today/SiteVisits'
import Todos from '../components/today/Todos'
import FocusTime from '../components/today/FocusTime'
import Reading from '../components/today/Reading'
import Attention from '../components/today/Attention'
import Activity from '../components/today/Activity'
import Completed from '../components/today/Completed'
import Quests from '../components/today/Quests'
import Picture from '../components/today/Picture'
import Customize from '../components/today/Customize'
import { CARD_META, orderedIds } from '../components/today/layout'

export default function Today() {
  const d = useTodayData()
  const hidden = usePrefs().todayHidden
  const show = (id: string) => !hidden.includes(id)
  const [manage, setManage] = useState(false)
  const [customize, setCustomize] = useState(false)
  const [name, setName] = useState('')
  useEffect(() => { firstName().then(setName).catch(() => {}) }, [])
  useEffect(() => {
    const routines = () => setManage(true), cust = () => setCustomize(true)
    window.addEventListener('tm-routines', routines); window.addEventListener('tm-customize-today', cust)
    return () => { window.removeEventListener('tm-routines', routines); window.removeEventListener('tm-customize-today', cust) }
  }, [])

  const prefs = usePrefs()
  const showFocus = d.focusItems.length > 0
  const nodes: Record<string, React.ReactNode> = {
    weather: <WeatherCard key="weather" />,
    started: <GettingStarted key="started" projects={d.projects} updates={d.updates} papers={d.papers} />,
    focus: showFocus ? <FocusNow key="focus" d={d} /> : d.allClear ? <p key="focus" className="all-clear"><Icon name="check" size={14} /> Everything due is handled</p> : null,
    day: <RoutineCard key="day" routines={d.routines} checks={d.checks} projects={d.projects} events={d.upcoming} tasks={d.dueNow} leaving={d.leaving}
      onTask={d.checkOff} onRename={d.rename} onDue={d.setDue} onManage={() => setManage(true)} onChange={d.reload} />,
    quests: <Quests key="quests" />,
    pinned: <PinnedProjects key="pinned" d={d} />,
    add: <AddBar key="add" projects={d.projects} onDone={d.reload} onError={d.setError} />,
    deadlines: <Deadlines key="deadlines" d={d} />, sites: <SiteVisits key="sites" />, todos: <Todos key="todos" d={d} />,
    progress: <ProgressChart key="progress" updates={d.updates} projects={d.projects} papers={d.papers} tasks={d.tasks} time={d.time} />,
    completed: <Completed key="completed" d={d} />, time: <FocusTime key="time" d={d} />, reading: <Reading key="reading" d={d} />,
    attention: <Attention key="attention" d={d} />, activity: <Activity key="activity" d={d} />, picture: <Picture key="picture" />,
  }
  // lay the cards out in your chosen order: full-width ones alone, the top pair side by side, tiles in grids, with a label when the group changes
  const blocks: React.ReactNode[] = []
  let run: React.ReactNode[] = [], runShape: 'top' | 'grid' | null = null, lastGroup: string | undefined
  const flush = () => {
    if (!run.length) return
    blocks.push(runShape === 'top'
      ? <div key={`r${blocks.length}`} className={`today-top ${run.length > 1 ? '' : 'solo'}`}>{run}</div>
      : <div key={`r${blocks.length}`} className="today-grid">{run}</div>)
    run = []; runShape = null
  }
  for (const id of orderedIds(prefs.todayOrder).filter(show)) {
    const node = nodes[id], meta = CARD_META[id]
    if (!node || !meta) continue
    const group = meta.group
    if (group !== lastGroup) { flush(); if (group) blocks.push(<h2 key={`g${group}${blocks.length}`} className="group-label">{group}</h2>) }
    lastGroup = group
    if (meta.shape === 'full') { flush(); blocks.push(node); continue }
    if (runShape !== meta.shape) flush()
    runShape = meta.shape; run.push(node)
  }
  flush()

  return (
    <div className="page today">
      <header className="page-head">
        <div>
          <div className="title-row"><h1>{greeting(d.now.getHours())}{name ? `, ${name}` : ''}</h1><BackButton /></div>
          <p className="muted today-date">{d.now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {d.tone}</p>
        </div>
        <div className="today-actions">
          <button className="today-search" onClick={() => window.dispatchEvent(new CustomEvent('tm-search'))} aria-label="Search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg> Search <kbd>⌘K</kbd>
          </button>
          <button className="today-edit" onClick={() => setCustomize(true)} aria-label="Customize Today" title="Customize Today"><Icon name="pen" size={16} /></button>
        </div>
      </header>
      {d.error && <div className="errbar" role="alert"><span>{d.error}</span><button onClick={d.reload}>Try again</button></div>}

      {d.loading ? (
        <div className="today-skel" aria-busy="true" aria-label="Loading"><div className="sk sk-row" /><div className="sk sk-card" /><div className="sk-grid"><div className="sk sk-card" /><div className="sk sk-card" /></div></div>
      ) : (
        <>
          {blocks}
        </>
      )}

      {manage && <RoutineManager routines={d.routines} projects={d.projects} onClose={() => { setManage(false); d.reload() }} />}
      {customize && <Customize onClose={() => setCustomize(false)} />}
    </div>
  )
}
