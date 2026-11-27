import { Leaf, Lightbulb, ListChecks } from 'lucide-react'
import GlassCard, { Pill } from '../components/GlassCard'
import HealthScore from '../components/HealthScore'
import { SENSORS } from '../components/SensorReadings'
import { T, estimateHealthScore, insights, sensorStatus } from '../lib/rules'
import { fmtNum } from '../lib/format'

const OPTIMAL = {
  temperature: `${T.tempLow}–35 °C (score falls outside)`, humidity: `${T.humLow}–${T.humHigh} %`,
  soilMoisture: `${T.soilWet}–${T.soilDry} ADC`, gasValue: `≤ ${T.gasHigh} ADC`,
}
const TIPS = {
  'soil-dry': 'Moisture is low: the pump waters automatically, but check the reservoir and mix the pile.',
  'soil-wet': 'Compost is too wet: turn the pile and add dry browns (leaves, cardboard).',
  'gas-high': 'Gas is elevated: the pile may be going anaerobic — turn it and improve airflow.',
  'temp-high': 'Too hot: turn the pile to release heat and keep ventilation running.',
  'temp-low': 'Too cool: add nitrogen-rich greens or insulate the bin.',
}

export default function CompostHealth({ d }) {
  const { reading, state } = d
  const parts = estimateHealthScore(reading)?.parts
  const stale = state === 'stale'
  const tips = d.alerts.map(a => TIPS[a.id]).filter(Boolean)
  return (
    <div className="page-stack health-page">
      <HealthScore score={d.score} state={state} className="health-hero" />
      <GlassCard title="Factors affecting health" icon={ListChecks}>
        <div className="table-wrap"><table>
          <thead><tr><th>Sensor</th><th>Current</th><th>Preferred range</th><th>Condition</th><th>Score contribution</th></tr></thead>
          <tbody>{SENSORS.map(s => { const st = stale ? { label: 'Stale', tone: 'warn' } : sensorStatus(s.key, reading); return (
            <tr key={s.key}><td>{s.label}</td><td>{fmtNum(reading?.[s.key], s.d)} {reading?.[s.key] != null ? s.unit : ''}</td><td>{OPTIMAL[s.key]}</td><td><Pill tone={st.tone}>{st.label}</Pill></td><td>{parts ? `${parts[s.key].toFixed(1)} / 25` : '—'}</td></tr>) })}</tbody>
        </table></div>
        <small className="stamp">The score is the average of four equal sensor scores (each up to 100). {d.score?.source === 'firmware' ? 'The total comes from the ESP32.' : 'Total estimated from cloud data with the firmware formula.'}</small>
      </GlassCard>
      <div className="grid-2">
        <GlassCard title="Current alerts" icon={Leaf}>
          {d.alerts.length ? <ul className="plain">{d.alerts.map(a => <li key={a.id}><b>{a.message}</b><span>{a.sensor}</span></li>)}</ul> : <p className="note">{state === 'stale' || !reading ? 'Alert status is unavailable until fresh data arrives.' : 'No active alerts.'}</p>}
        </GlassCard>
        <GlassCard title="Recommendations" icon={Lightbulb}>
          {tips.length ? <ul className="plain">{tips.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="note">{insights(reading, d.alerts, state).title} {insights(reading, d.alerts, state).hint}</p>}
        </GlassCard>
      </div>
    </div>
  )
}
