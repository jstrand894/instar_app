import Recap from '../Recap'
import { useGame } from '../../lib/game'
import { usePrefs } from '../../lib/prefs'

/** The recap, shown on the last day of the week (this week so far) and the first day of the next (the week just ended). */
export default function WeekRecap() {
  const g = useGame()
  const { weekStart } = usePrefs()
  if (!g) return null
  const dow = new Date().getDay()
  const offset = dow === weekStart ? 1 : dow === (weekStart + 6) % 7 ? 0 : null
  return offset == null ? null : <Recap g={g} offset={offset} />
}
