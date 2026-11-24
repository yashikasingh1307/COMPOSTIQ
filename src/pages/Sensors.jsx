import { useState } from 'react'
import { Activity } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import { SENSORS, SensorTile } from '../components/SensorReadings'
import { RangeTabs, TrendChart } from '../components/SensorTrends'
import { SERIES } from '../lib/chart'
import { T } from '../lib/rules'
import { ago, fmtNum, fmtTime } from '../lib/format'

const NOTES = {
  temperature: `Comfortable range ${T.tempLow}–${T.tempHigh} °C. DHT sensor on GPIO 4.`,
  humidity: `Health score is best between ${T.humLow} and ${T.humHigh} %. DHT sensor on GPIO 4.`,
  soilMoisture: `Raw ADC reading on GPIO 34 — higher means drier. Dry above ${T.soilDry}, wet below ${T.soilWet}.`,
  gasValue: `Indicative MQ-135 air-quality reading on GPIO 35, not a measurement of a specific gas. High above ${T.gasHigh}.`,
}
const KEYS = Object.fromEntries(SENSORS.map(s => [s.key, [s.key]]))

export default function Sensors({ d }) {
  const [range, setRange] = useState('6h')
  const { reading, history, historyState, now, state } = d
  return (
    <div className="page-stack">
      <div className="grid-2x2">
        {SENSORS.map(s => (
          <GlassCard key={s.key} className="sensor-detail" title={s.label} icon={s.icon}>
            <SensorTile s={s} reading={reading} history={history} now={now} stale={state === 'stale'} />
            <p className="note">{NOTES[s.key]}</p>
            <small className="stamp">Last updated {d.lastUpdated ? `${fmtTime(d.lastUpdated)} (${ago(d.lastUpdated, now)})` : '—'}</small>
          </GlassCard>
        ))}
      </div>
      <GlassCard title="Historical trends" icon={Activity} action={<RangeTabs range={range} setRange={setRange} />}>
        <div className="grid-2x2 charts">
          {SENSORS.map(s => (
            <div key={s.key} className="chart-cell"><h3><i style={{ background: SERIES[s.key].color }} />{SERIES[s.key].label}</h3>
              <TrendChart history={history} historyState={historyState} now={now} range={range} keys={KEYS[s.key]} compact /></div>
          ))}
        </div>
      </GlassCard>
      <GlassCard title="Recent samples" icon={Activity}>
        {history.length === 0 ? <div className="empty">No uploads in the last 24 h.</div> : (
          <div className="table-wrap"><table><thead><tr><th>Time</th><th>Temp (°C)</th><th>Humidity (%)</th><th>Soil (ADC)</th><th>Gas (ADC)</th></tr></thead>
            <tbody>{history.slice(-12).reverse().map((r, i) => <tr key={i}><td>{fmtTime(r.t)}</td><td>{fmtNum(r.temperature)}</td><td>{fmtNum(r.humidity, 0)}</td><td>{fmtNum(r.soilMoisture, 0)}</td><td>{fmtNum(r.gasValue, 0)}</td></tr>)}</tbody></table></div>
        )}
        <small className="stamp">Samples are the ThingSpeak uploads (every ~30 s).</small>
      </GlassCard>
    </div>
  )
}
