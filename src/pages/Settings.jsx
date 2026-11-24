import { useState } from 'react'
import { Cloud, Gauge, Save, Server, Wifi } from 'lucide-react'
import GlassCard, { Pill } from '../components/GlassCard'
import Connectivity from '../components/Connectivity'
import { getBaseUrl, saveBaseUrl } from '../lib/api'
import { T } from '../lib/rules'

export default function Settings({ d }) {
  const [url, setUrl] = useState(getBaseUrl())
  const [saved, setSaved] = useState(false)
  const [urlError, setUrlError] = useState('')

  const save = () => {
    try {
      const parsed = new URL(url.trim())
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol')
      saveBaseUrl(url)
      setUrlError('')
      setSaved(true)
      d.refresh()
      window.setTimeout(() => setSaved(false), 2400)
    } catch {
      setUrlError('Enter a complete HTTP or HTTPS URL for the FastAPI backend.')
    }
  }

  const th = [
    ['Pump dry trigger', `Soil > ${T.soilDry} ADC`],
    ['Pump pulse / cooldown', `${T.pumpBurstMs / 1000} s / ${T.pumpCooldownMs / 1000} s`],
    ['Fan on thresholds', `${T.tempHigh} °C / ${T.gasHigh} ADC`],
    ['Fan stop thresholds', `${T.tempFanOff} °C / ${T.gasFanOff} ADC`],
    ['Alarm thresholds', `Soil < ${T.soilWet} or > ${T.soilDry}; gas > ${T.gasHigh}; temp < ${T.tempLow} °C`],
  ]

  return (
    <div className="page-stack">
      <div className="grid-2">
        <GlassCard title="FastAPI connection" icon={Server}>
          <dl className="kv">
            <div><dt>Backend</dt><dd>{d.health?.status === 'online' ? 'Online' : 'Unreachable'}</dd></div>
            <div><dt>ThingSpeak credentials</dt><dd>{d.health?.thingspeakConfigured ? 'Configured on server' : 'Not reported / missing'}</dd></div>
            <div><dt>Live ESP32 feed</dt><dd>{d.health?.esp32Configured ? 'Configured on server' : 'Not configured'}</dd></div>
            <div><dt>Sensor data</dt><dd>{d.source === 'esp32' ? 'Live from ESP32 via FastAPI' : d.source === 'thingspeak' ? 'ThingSpeak via FastAPI' : 'Waiting for data'}</dd></div>
            <div><dt>Historical samples</dt><dd>{d.history.length} real feed rows</dd></div>
          </dl>
          {d.errors.backend && <p className="note">{d.errors.backend}</p>}
          {d.errors.history && <p className="note">History: {d.errors.history}</p>}
        </GlassCard>
        <Connectivity c={d.connectivity} note />
      </div>

      <GlassCard title="Backend URL" icon={Wifi} action={<Pill tone={saved ? 'ok' : 'unknown'}>{saved ? 'Saved' : 'Stored in this browser'}</Pill>}>
        <div className="form">
          <label>FastAPI base URL
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="http://127.0.0.1:8000" />
            <small>The dashboard requests sensor, health and history data from this backend.</small>
          </label>
        </div>
        {urlError && <span className="field-help" role="alert">{urlError}</span>}
        <div className="form-actions"><button className="btn primary" onClick={save}><Save size={16} /> Save &amp; test</button></div>
        <small className="stamp">ThingSpeak credentials stay in the backend environment and are never sent to the browser.</small>
      </GlassCard>

      <div className="grid-2">
        <GlassCard title="Firmware thresholds" icon={Gauge}>
          <dl className="kv">{th.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
          <small className="stamp">Read-only display mirrored from the current ESP32 firmware.</small>
        </GlassCard>
        <GlassCard title="Data endpoints" icon={Cloud}>
          <dl className="kv">
            <div><dt>Latest sample</dt><dd><code>/api/sensors</code></dd></div>
            <div><dt>History</dt><dd><code>/api/history</code></dd></div>
            <div><dt>Backend status</dt><dd><code>/api/health</code></dd></div>
          </dl>
          <p className="note">The ESP32 uploads fields to ThingSpeak. FastAPI reads and normalizes those fields for this UI.</p>
        </GlassCard>
      </div>
    </div>
  )
}
