import { Info, Leaf } from 'lucide-react'
import GlassCard from './GlassCard'
import { CompostBin } from './Botanical'
import { healthBand } from '../lib/rules'

export function Ring({ pct, tone }) {
  const r = 46, c = 2 * Math.PI * r, v = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  return (
    <div className="ring" role="img" aria-label={pct == null ? 'Health score unavailable' : `Health score ${Math.round(v)} percent`}>
      <svg viewBox="0 0 110 110"><circle cx="55" cy="55" r={r} className="ring-track" /><circle cx="55" cy="55" r={r} className={`ring-val ring-${tone}`} strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 55 55)" /></svg>
      <div className="ring-art"><CompostBin /></div>
    </div>
  )
}

export default function HealthScore({ score, state, className = '' }) {
  const value = state === 'stale' ? score?.value : score?.value
  const band = healthBand(value ?? null)
  const est = score?.source === 'estimated'
  return (
    <GlassCard className={`health ${className}`} title="Compost Health Score" icon={Leaf}
      action={<span className="info" tabIndex={0} title={est ? 'Estimated with the firmware formula from cloud data (ESP32 not reachable locally).' : 'Calculated on the ESP32 from temperature, humidity, soil moisture and gas.'}><Info size={17} /></span>}>
      <div className="health-body">
        <div className="health-left">
          <div className="big-score">{value == null ? '—' : Math.round(value)}{value != null && <small>%</small>}</div>
          <span className={`band band-${band.key}`}><Leaf size={17} /> {band.label}</span>
          <p className="health-msg">{band.msg}{est && value != null && <em> (estimated)</em>}</p>
        </div>
        <Ring pct={value} tone={band.key} />
      </div>
    </GlassCard>
  )
}
