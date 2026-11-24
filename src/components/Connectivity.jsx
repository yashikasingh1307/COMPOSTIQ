import { BarChart3, Network, Wifi } from 'lucide-react'
import GlassCard from './GlassCard'

const LABEL = { connected: 'Connected', disconnected: 'Disconnected', unknown: 'Unknown' }
const TONE = { connected: 'ok', disconnected: 'bad', unknown: 'unknown' }

export default function Connectivity({ c, className = '', note = false }) {
  const items = [
    { name: 'Wi-Fi', icon: Wifi, s: c.wifi, n: c.wifiNote },
    { name: 'MQTT', icon: Network, s: c.mqtt, n: c.mqttNote },
    { name: 'ThingSpeak', icon: BarChart3, s: c.thingspeak, n: c.thingspeakNote },
  ]
  return (
    <GlassCard className={`connectivity ${className}`} title="Connectivity" icon={Wifi}>
      <div className="conn-row">
        {items.map(({ name, icon: Icon, s, n }) => (
          <div className="conn" key={name} title={n || undefined}>
            <Icon size={28} strokeWidth={1.6} />
            <b>{name}</b>
            <span className="conn-state"><i className={`dot dot-${TONE[s]}`} />{LABEL[s]}</span>
            {note && n && <small>{n}</small>}
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
