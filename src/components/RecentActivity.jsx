import { ArrowRight, Clock } from 'lucide-react'
import GlassCard, { Empty } from './GlassCard'
import { fmtTime } from '../lib/format'

const TONE = { alert: 'bad', ok: 'ok', gap: 'warn', pump: 'info', fan: 'info' }

export function eventList(activity, lastUpdated, limit) {
  const head = lastUpdated ? [{ t: lastUpdated, type: 'ok', text: 'Sensor data updated', origin: 'latest' }] : []
  return [...head, ...activity].slice(0, limit)
}

export default function RecentActivity({ activity, lastUpdated, onViewLogs, limit = 4 }) {
  const list = eventList(activity, lastUpdated, limit)
  return (
    <GlassCard className="activity" title="Recent Activity" icon={Clock} action={<button className="link" onClick={onViewLogs}>View Logs <ArrowRight size={16} /></button>}>
      {list.length === 0 ? <Empty>No activity recorded yet.</Empty> : (
        <ol className="timeline">
          {list.map((e, i) => <li key={i} title={e.origin === 'live' ? 'Seen live while this page was open' : e.origin === 'cloud' ? 'Reconstructed from ThingSpeak uploads' : 'Latest reading'}><i className={`dot dot-${TONE[e.type] || 'ok'}`} /><time>{fmtTime(e.t)}</time><span>{e.text}</span></li>)}
        </ol>
      )}
    </GlassCard>
  )
}
