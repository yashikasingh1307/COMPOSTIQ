import { BellRing, Clock, ScrollText } from 'lucide-react'
import GlassCard, { Empty, Pill } from '../components/GlassCard'
import { fmtDateTime, fmtTime } from '../lib/format'

const dur = (a, b) => { const m = Math.max(1, Math.round(((b ?? Date.now()) - a) / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} m` }

export default function AlertsLogs({ d }) {
  const { alerts, state, reading, episodes, activity, historyState } = d
  const known = state === 'live' || state === 'cloud'
  const alarmKnown = known && reading?.alarmState != null
  const buzzing = alarmKnown && !!(reading.alarmState || alerts.length)
  return (
    <div className="page-stack">
      <div className="grid-2 wide-left">
        <GlassCard title="Active alerts" icon={BellRing}>
          {!known ? <Empty>Alert status is unavailable until fresh data arrives.</Empty> : alerts.length === 0 ? <p className="ok-line">All parameters are normal — no active alerts.</p> : (
            <ul className="plain">{alerts.map(a => <li key={a.id} className={`sev-${a.severity}`}><b>{a.message}</b><span>{a.sensor} · {a.severity} · since {fmtTime(episodes.find(e => e.id === a.id && !e.end)?.start ?? d.lastUpdated)}</span>{a.action && <em>{a.action}</em>}</li>)}</ul>
          )}
        </GlassCard>
        <GlassCard title="Buzzer" icon={BellRing}>
          <Pill tone={!alarmKnown ? 'unknown' : buzzing ? 'bad' : 'ok'}>{!alarmKnown ? 'Unknown' : buzzing ? 'Sounding' : 'Silent'}</Pill>
          <p className="note">The buzzer follows the device alarm. This API does not report or change a mute setting.</p>
        </GlassCard>
      </div>
      <GlassCard title="Alert history (24 h)" icon={Clock}>
        {historyState === 'error' ? <Empty>History unavailable — ThingSpeak could not be reached.</Empty> : episodes.length === 0 ? <Empty>No alerts in the last 24 hours.</Empty> : (
          <div className="table-wrap"><table><thead><tr><th>Started</th><th>Alert</th><th>Sensor</th><th>Severity</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>{episodes.slice(0, 30).map((e, i) => <tr key={i}><td>{fmtDateTime(e.start)}</td><td>{e.message}</td><td>{e.sensor}</td><td>{e.severity}</td><td>{dur(e.start, e.end)}</td><td><Pill tone={e.end ? 'ok' : 'bad'}>{e.end ? 'Resolved' : 'Active'}</Pill></td></tr>)}</tbody></table></div>
        )}
        <small className="stamp">Reconstructed from ThingSpeak uploads using the alert thresholds.</small>
      </GlassCard>
      <GlassCard title="Activity log" icon={ScrollText}>
        {activity.length === 0 ? <Empty>No activity recorded yet.</Empty> : (
          <div className="table-wrap"><table><thead><tr><th>Time</th><th>Event</th><th>Source</th></tr></thead>
            <tbody>{activity.map((e, i) => <tr key={i}><td>{fmtDateTime(e.t)}</td><td>{e.text}</td><td>{e.origin === 'live' ? 'Seen live in this session' : 'ThingSpeak history'}</td></tr>)}</tbody></table></div>
        )}
      </GlassCard>
    </div>
  )
}
