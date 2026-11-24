import { Cog, Droplet, Fan } from 'lucide-react'
import GlassCard, { Pill } from './GlassCard'

export function actuatorView(on, state) {
  if (state === 'loading' || state === 'offline' || on == null) return { label: 'Unknown', tone: 'unknown' }
  if (state === 'stale') return { label: on ? 'Was running' : 'Was idle', tone: 'warn' }
  return on ? { label: 'Running', tone: 'run' } : { label: 'Ready', tone: 'ok' }
}

function Actuator({ name, icon: Icon, on, state, mode }) {
  const v = actuatorView(on, state)
  return (
    <div className="actuator">
      <span className="act-icon"><Icon size={34} strokeWidth={1.5} className={v.tone === 'run' && name === 'Ventilation Fan' ? 'spin-slow' : ''} /></span>
      <div className="act-text"><b>{name}</b><span>{mode} · {on == null ? '—' : on ? 'ON' : 'OFF'}</span></div>
      <Pill tone={v.tone} className="pill-lg"><i className={`dot dot-${v.tone === 'run' ? 'ok' : v.tone}`} />{v.label}</Pill>
    </div>
  )
}

export default function SystemStatus({ reading, state }) {
  const mode = m => (m ? String(m).toUpperCase() : 'AUTO')
  return (
    <GlassCard className="system" title="System Status" icon={Cog}>
      <div className="actuators">
        <Actuator name="Water Pump" icon={Droplet} on={reading?.pumpState} state={state} mode={mode(reading?.pumpMode)} />
        <Actuator name="Ventilation Fan" icon={Fan} on={reading?.fanState} state={state} mode={mode(reading?.fanMode)} />
      </div>
    </GlassCard>
  )
}
