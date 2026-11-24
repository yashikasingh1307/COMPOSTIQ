import { Cog, Droplet, Fan, Info, ShieldCheck } from 'lucide-react'
import GlassCard, { Pill } from '../components/GlassCard'
import { actuatorView } from '../components/SystemStatus'
import { T, fanReason, pumpReason } from '../lib/rules'

function Big({ name, icon: Icon, on, state, mode, reason, gpio, desc }) {
  const v = actuatorView(on, state)
  return (
    <GlassCard className="auto-card" title={name} icon={Icon} action={<Pill tone={v.tone}><i className={`dot dot-${v.tone === 'run' ? 'ok' : v.tone}`} />{v.label}</Pill>}>
      <dl className="kv">
        <div><dt>Mode</dt><dd>{mode}</dd></div>
        <div><dt>State</dt><dd>{on == null ? 'Unknown' : on ? 'ON' : 'OFF'}</dd></div>
        <div><dt>Hardware</dt><dd>{gpio}</dd></div>
        <div><dt>Current reason</dt><dd>{state === 'stale' ? 'Last data is out of date' : reason}</dd></div>
      </dl>
      <p className="note">{desc}</p>
    </GlassCard>
  )
}

export default function Automation({ d }) {
  const { reading, state } = d
  const mode = m => (m ? String(m).toUpperCase() : 'AUTO')
  const rows = [
    ['Pump', `Soil reading above ${T.soilDry} (dry)`, `Burst up to ${T.pumpBurstMs / 1000} s, then ${T.pumpCooldownMs / 1000} s cooldown`],
    ['Fan', `Gas at or above ${T.gasHigh} ADC`, `Stops when gas is at or below ${T.gasFanOff} ADC and temperature is at or below ${T.tempFanOff} °C`],
    ['Fan', `Temperature at or above ${T.tempHigh} °C`, `Stops when temperature is at or below ${T.tempFanOff} °C and gas is at or below ${T.gasFanOff} ADC`],
    ['Alarm', `Gas above ${T.gasHigh}, soil outside ${T.soilWet}–${T.soilDry} ADC, or temperature below ${T.tempLow} °C`, 'ESP32 drives the buzzer and reports its alarm state'],
  ]
  return (
    <div className="page-stack">
      <div className="grid-2">
        <Big name="Water Pump" icon={Droplet} on={reading?.pumpState} state={state} mode={mode(reading?.pumpMode)} reason={pumpReason(reading)} gpio="Relay 1 · GPIO 26" desc="Waters in short bursts when the compost is dry. Soil sensor: higher raw reading = drier." />
        <Big name="Ventilation Fan" icon={Fan} on={reading?.fanState} state={state} mode={mode(reading?.fanMode)} reason={fanReason(reading)} gpio="Relay 2 · GPIO 27" desc="Ventilates when gas or temperature reaches its firmware threshold, using separate stop thresholds." />
      </div>
      <GlassCard title="Automation rules" icon={Cog}>
        <div className="table-wrap"><table><thead><tr><th>Actuator</th><th>Trigger</th><th>Behaviour</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody></table></div>
        <small className="stamp">Rules as documented for CompostIQ. They run on the ESP32 and keep working without Wi-Fi or cloud.</small>
      </GlassCard>
      <div className="grid-2">
        <GlassCard title="Safety" icon={ShieldCheck}><p className="note">Both relays start OFF at power-up. The pump runs a two-second maximum pulse with a 60-second cooldown. The fan uses temperature and gas hysteresis in the ESP32 firmware.</p></GlassCard>
        <GlassCard title="Hardware controls" icon={Info}><p className="note">This dashboard is read-only. The ESP32 reports pump and fan status, but its current <code>/control</code> handler does not implement commands, so this page will not show nonfunctional ON / OFF controls. Automatic control continues locally on the ESP32.</p></GlassCard>
      </div>
    </div>
  )
}
