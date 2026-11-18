import { Thermometer, Droplets, Sprout, Activity } from 'lucide-react'
const icons = { temperature: Thermometer, humidity: Droplets, soilMoisture: Sprout, gasValue: Activity }
export default function MetricCard({ type, label, value, unit, note, tone }) {
  const Icon = icons[type]
  return <article className="metric-card"><div className="metric-top"><span className={`metric-icon ${tone}`}><Icon size={18}/></span><span className="live-tag"><i/> LIVE</span></div><div className="metric-label">{label}</div><div className="metric-value">{value ?? '—'}<small>{unit}</small></div><div className="metric-note">{note}</div></article>
}
