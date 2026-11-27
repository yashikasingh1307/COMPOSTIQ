import { useEffect, useState } from 'react'
import { Cog, Droplet, Fan, Info, Save, ShieldCheck } from 'lucide-react'
import GlassCard, { Pill } from '../components/GlassCard'
import { actuatorView } from '../components/SystemStatus'
import { T } from '../lib/rules'

function ActuatorControl({ name, icon: Icon, on, state, mode, disabled, disableOn = false, busy, onSet }) {
  const v = actuatorView(on, state)
  const wantsOn = on !== true
  return (
    <GlassCard className="auto-card actuator-control" title={name} icon={Icon} action={<Pill tone={v.tone}><i className={`dot dot-${v.tone === 'run' ? 'ok' : v.tone}`} />{v.label}</Pill>}>
      <div className="control-current"><span className={`dot dot-${on == null ? 'unknown' : on ? 'ok' : 'unknown'}`} />Current state: <b>{on == null ? 'Unknown' : on ? 'ON' : 'OFF'}</b></div>
      <button className={`btn actuator-command ${on ? 'stop' : 'start'}`} disabled={disabled || busy || (disableOn && wantsOn)} onClick={() => onSet(wantsOn)}>
        {name === 'Water Pump' ? <Droplet size={17} /> : <Fan size={17} />}
        {busy ? 'Sending…' : wantsOn ? 'Turn ON' : 'Turn OFF'}
      </button>
      {mode === 'AUTO' && <small className="stamp">Auto mode is controlling this actuator.</small>}
      {name === 'Water Pump' && <small className="stamp">Manual ON is a safety-limited 2-second pulse with a 60-second cooldown.</small>}
    </GlassCard>
  )
}

export default function Automation({ d }) {
  const { reading, state } = d
  const [soilThreshold, setSoilThreshold] = useState(String(T.soilDry))
  const [soilRemovedAdc, setSoilRemovedAdc] = useState('')
  const [temperatureThreshold, setTemperatureThreshold] = useState(String(T.tempHigh))
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const mode = reading?.operatingMode === 'MANUAL' ? 'MANUAL' : 'AUTO'
  const deviceLive = state === 'live' && reading?.source === 'esp32'
  const controlsReady = deviceLive && d.health?.controlConfigured && d.health?.deviceControlConfigured === true
  const manualDisabled = !controlsReady || busy || mode !== 'MANUAL'

  useEffect(() => {
    if (reading?.thresholds?.soilDry != null) setSoilThreshold(String(reading.thresholds.soilDry))
    setSoilRemovedAdc(reading?.thresholds?.soilRemovedAdc ? String(reading.thresholds.soilRemovedAdc) : '')
    if (reading?.thresholds?.temperatureHigh != null) setTemperatureThreshold(String(reading.thresholds.temperatureHigh))
  }, [reading?.thresholds?.soilDry, reading?.thresholds?.temperatureHigh])

  const send = async (payload, success) => {
    setBusy(true)
    setFeedback(null)
    try {
      const result = await d.control(payload)
      setFeedback({ ok: true, text: result.message || success })
    } catch (error) {
      setFeedback({ ok: false, text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const setMode = next => {
    if (next === mode) return
    if (next === 'MANUAL' && !window.confirm('Switch to MANUAL mode? The ESP32 will stop automatic actuator control until you select AUTO again.')) return
    send({ mode: next }, `Operating mode set to ${next}.`)
  }

  const setActuator = (key, on) => {
    if (key === 'pump' && on && !window.confirm('Run the water pump for one safety-limited 2-second pulse?')) return
    send({ [key]: on }, `${key === 'pump' ? 'Water pump' : 'Ventilation fan'} ${on ? 'ON' : 'OFF'} command accepted.`)
  }

  const saveThresholds = () => {
    const soil = Number(soilThreshold), temp = Number(temperatureThreshold)
    if (!Number.isInteger(soil) || soil < 1001 || soil > 4000) {
      setFeedback({ ok: false, text: 'Soil dry threshold must be 1001–4000 ADC.' }); return
    }
    if (!Number.isFinite(temp) || temp < 34 || temp > 60) {
      setFeedback({ ok: false, text: 'Temperature threshold must be 34–60 °C.' }); return
    }
    const removed = soilRemovedAdc.trim() === '' ? 0 : Number(soilRemovedAdc)
    if (!Number.isInteger(removed) || (removed !== 0 && (removed < 6 || removed > 4089))) {
      setFeedback({ ok: false, text: 'Probe-removed ADC must be blank to disable or 6–4089.' }); return
    }
    send({ soilDryThreshold: soil, temperatureThreshold: temp, soilRemovedAdc: removed }, 'Thresholds and sensor calibration saved to ESP32.')
  }

  const rows = [
    ['Pump', `Valid soil reading above ${reading?.thresholds?.soilDry ?? T.soilDry} ADC`, `Up to ${T.pumpBurstMs / 1000} s per pulse, then ${T.pumpCooldownMs / 1000} s cooldown`],
    ['Fan', `Gas at or above ${T.gasHigh} ADC`, `Stops at ≤ ${T.gasFanOff} ADC when temperature is also below its stop threshold`],
    ['Fan', `Temperature at or above ${reading?.thresholds?.temperatureHigh ?? T.tempHigh} °C`, `Uses a lower stop threshold of ${T.tempFanOff} °C`],
    ['Alert', `Sensor or compost readings outside configured valid ranges`, 'Displayed as a dashboard alert'],
  ]

  return (
    <div className="page-stack automation-page">
      <GlassCard className="mode-card" title="Operating Mode" icon={Cog}>
        <div className="mode-line">
        <div><b>Choose how your system runs</b><p className="note">In Auto mode, ESP32 controls the actuators using saved thresholds.</p></div>
          <div className="mode-switch" role="group" aria-label="Operating mode">
            {['AUTO', 'MANUAL'].map(option => <button key={option} type="button" className={mode === option ? 'selected' : ''} disabled={!controlsReady || busy} onClick={() => setMode(option)}>{option}</button>)}
          </div>
        </div>
        {!controlsReady && <p className="note">Live controls need a reachable ESP32, a matching CONTROL_API_TOKEN in FastAPI and firmware secrets, and the updated firmware.</p>}
      </GlassCard>

      <div className="grid-2">
        <ActuatorControl name="Water Pump" icon={Droplet} on={reading?.pumpState} state={state} mode={mode} disabled={manualDisabled} disableOn={reading?.sensorValidity?.soilMoisture === false} busy={busy} onSet={on => setActuator('pump', on)} />
        <ActuatorControl name="Ventilation Fan" icon={Fan} on={reading?.fanState} state={state} mode={mode} disabled={manualDisabled} busy={busy} onSet={on => setActuator('fan', on)} />
      </div>

      <GlassCard title="Automation thresholds" icon={Save}>
        <div className="form threshold-form">
          <label>Soil dry threshold (ADC; higher is drier)
            <input type="number" min="1001" max="4000" step="1" value={soilThreshold} onChange={e => setSoilThreshold(e.target.value)} />
            <small>Automatic watering is blocked whenever the soil sensor is invalid.</small>
          </label>
          <label>Fan temperature trigger (°C)
            <input type="number" min="34" max="60" step="0.5" value={temperatureThreshold} onChange={e => setTemperatureThreshold(e.target.value)} />
            <small>Saved on the ESP32 and retained after restart.</small>
          </label>
          <label>Soil probe removed reading (ADC)
            <input type="number" min="6" max="4089" step="1" value={soilRemovedAdc} onChange={e => setSoilRemovedAdc(e.target.value)} placeholder="Optional calibration" />
            <small>With MANUAL mode selected, remove the probe, note its raw reading, enter it here, then save. Values within ±80 ADC are marked disconnected and cannot trigger watering. Blank disables this calibration.</small>
          </label>
        </div>
        <div className="form-actions"><button className="btn primary" disabled={!controlsReady || busy} onClick={saveThresholds}><Save size={16} />{busy ? 'Saving…' : 'Save thresholds'}</button></div>
        {feedback && <p className={`control-feedback ${feedback.ok ? 'success' : 'error'}`} role="status">{feedback.text}</p>}
      </GlassCard>

      <GlassCard title="Automation rules" icon={Info}>
        <div className="table-wrap"><table><thead><tr><th>Actuator</th><th>Trigger</th><th>Behaviour</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody></table></div>
      </GlassCard>
      <GlassCard title="Safety" icon={ShieldCheck}><p className="note">Pump commands are interlocked with soil sensor validity, a 2-second maximum pulse, and a 60-second cooldown. Manual mode starts with both outputs OFF when selected. Automatic rules continue locally on the ESP32 when the dashboard or cloud is unavailable.</p></GlassCard>
    </div>
  )
}
