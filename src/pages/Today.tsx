import { useEffect, useState } from 'react'
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
import Todos from '../components/today/Todos'
import FocusTime from '../components/today/FocusTime'
import Reading from '../components/today/Reading'
import Attention from '../components/today/Attention'
import Activity from '../components/today/Activity'
import Completed from '../components/today/Completed'
import Picture from '../components/today/Picture'
import Customize from '../components/today/Customize'

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

  const showFocus = show('focus') && d.focusItems.length > 0
  const showDay = show('day')
  const plan = ['deadlines', 'todos'].filter(show), progress = ['completed', 'time', 'reading'].filter(show), watch = ['attention', 'activity', 'picture'].filter(show)

  return (
    <div className="page today">
      <header className="page-head">
        <div>
          <h1>{greeting(d.now.getHours())}{name ? `, ${name}` : ''}</h1>
          <p className="muted today-date">{d.now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}{d.summary && ` · ${d.summary}`}</p>
          <p className="today-tone">{d.tone}</p>
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
          {show('weather') && <WeatherCard />}
          {show('started') && <GettingStarted projects={d.projects} updates={d.updates} papers={d.papers} />}

          {show('focus') && !showFocus && d.allClear && <p className="all-clear"><Icon name="check" size={14} /> Everything due is handled</p>}
          {(showFocus || showDay) && (
            <div className={`today-top ${showFocus && showDay ? '' : 'solo'}`}>
              {showFocus && <FocusNow d={d} />}
              {showDay && <RoutineCard routines={d.routines} checks={d.checks} projects={d.projects} events={d.upcoming} tasks={d.dueNow} leaving={d.leaving}
                onTask={d.checkOff} onRename={d.rename} onDue={d.setDue} onManage={() => setManage(true)} onChange={d.reload} />}
            </div>
          )}
          {show('add') && <AddBar projects={d.projects} onDone={d.reload} onError={d.setError} />}

          {plan.length > 0 && <>
            <h2 className="group-label">Plan ahead</h2>
            <div className="today-grid">{show('deadlines') && <Deadlines d={d} />}{show('todos') && <Todos d={d} />}</div>
          </>}
          {(show('progress') || progress.length > 0) && <>
            <h2 className="group-label">Progress</h2>
            {show('progress') && <ProgressChart updates={d.updates} projects={d.projects} papers={d.papers} tasks={d.tasks} />}
            {progress.length > 0 && <div className="today-grid">{show('completed') && <Completed d={d} />}{show('time') && <FocusTime d={d} />}{show('reading') && <Reading d={d} />}</div>}
          </>}
          {watch.length > 0 && <>
            <h2 className="group-label">Keep an eye on</h2>
            <div className="today-grid">{show('attention') && <Attention d={d} />}{show('activity') && <Activity d={d} />}{show('picture') && <Picture />}</div>
          </>}
        </>
      )}

      {manage && <RoutineManager routines={d.routines} projects={d.projects} onClose={() => { setManage(false); d.reload() }} />}
      {customize && <Customize onClose={() => setCustomize(false)} />}
    </div>
  )
}
