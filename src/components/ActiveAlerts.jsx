import { ArrowRight, Bell, Check, TriangleAlert } from 'lucide-react'
import GlassCard from './GlassCard'
import { LeafBranch } from './Botanical'
import { fmtTime } from '../lib/format'

export default function ActiveAlerts({ alerts, state, since, onViewAll }) {
  const unknown = state === 'loading' || state === 'offline'
  return (
    <GlassCard className="alerts" title="Active Alerts" icon={Bell} action={<button className="link" onClick={onViewAll}>View All <ArrowRight size={16} /></button>}>
      {unknown ? (
        <div className="alert-ok muted"><span className="big-icon off"><Bell size={26} /></span><div><b>Alert status unavailable</b><span>Waiting for data from the compost unit.</span></div></div>
      ) : state === 'stale' ? (
        <div className="alert-ok muted"><span className="big-icon off"><Bell size={26} /></span><div><b>Alert status is out of date</b><span>Last data was received at {fmtTime(since)}.</span></div></div>
      ) : alerts.length === 0 ? (
        <div className="alert-ok"><span className="big-icon"><Check size={28} strokeWidth={2.6} /></span><div><b>All parameters are normal!</b><span>No active alerts at the moment.</span></div><LeafBranch className="alert-leaf" /></div>
      ) : (
        <ul className="alert-list">
          <li className="alert-count"><TriangleAlert size={18} /> {alerts.length} active alert{alerts.length > 1 ? 's' : ''}</li>
          {alerts.slice(0, 3).map(a => <li key={a.id} className={`alert-row sev-${a.severity}`}><b>{a.message}</b><span>{a.sensor} · {a.severity} · {fmtTime(since)}</span></li>)}
        </ul>
      )}
    </GlassCard>
  )
}
