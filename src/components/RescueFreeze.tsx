import Icon from './Icon'
import { store } from '../lib/store'
import { notify } from '../lib/notify'
import type { Game } from '../lib/game'

/** Offered when yesterday was missed and a streak freeze would keep the streak alive. */
export default function RescueFreeze({ g }: { g: Game }) {
  if (!g.rescue) return null
  const r = g.rescue
  return (
    <div className="rescue" role="status">
      <Icon name="snow" size={16} />
      <span>Yesterday slipped by. Use a freeze to keep your <b>{r.streak}-day</b> streak?</span>
      <button className="primary" onClick={async () => { try { await store.addFreeze(r.date); notify.success('Streak saved') } catch (e) { notify.error(e) } }}>Use a freeze ({g.freezes} left)</button>
    </div>
  )
}
