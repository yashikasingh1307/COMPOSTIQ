import { BarChart3, Droplet, Sprout, Thermometer, Wind } from 'lucide-react'
import GlassCard, { Pill } from './GlassCard'
import Spark, { recent } from './Spark'
import { sensorStatus } from '../lib/rules'
import { fmtNum } from '../lib/format'

export const SENSORS = [
  { key: 'temperature', label: 'Temperature', unit: '°C', icon: Thermometer, d: 1, cls: 'ic-temp' },
  { key: 'humidity', label: 'Humidity', unit: '%', icon: Droplet, d: 0, cls: 'ic-hum' },
  { key: 'soilMoisture', label: 'Soil Moisture', unit: 'ADC', icon: Sprout, d: 0, cls: 'ic-soil' },
  { key: 'gasValue', label: 'Gas Level', unit: 'ADC', icon: Wind, d: 0, cls: 'ic-gas' },
]

export function SensorTile({ s, reading, history, now, stale }) {
  const st = reading?.sensorValidity?.[s.key] === false
    ? sensorStatus(s.key, reading)
    : stale ? { label: 'Stale', tone: 'warn' } : sensorStatus(s.key, reading)
  const Icon = s.icon
  return (
    <div className="tile">
      <Icon className={`tile-icon ${s.cls}`} size={34} strokeWidth={1.5} />
      <div className="tile-main">
        <span className="tile-label">{s.label}</span>
        <b className="tile-value">{fmtNum(reading?.[s.key], s.d)}{reading?.[s.key] != null && <small> {s.unit}</small>}</b>
      </div>
      <Pill tone={st.tone}>{st.label}</Pill>
      <Spark values={recent(history, s.key, now)} />
    </div>
  )
}

export default function SensorReadings({ reading, history, now, stale }) {
  return (
    <GlassCard className="sensors" title="Sensor Readings" icon={BarChart3}>
      <div className="tiles">{SENSORS.map(s => <SensorTile key={s.key} s={s} reading={reading} history={history} now={now} stale={stale} />)}</div>
    </GlassCard>
  )
}
