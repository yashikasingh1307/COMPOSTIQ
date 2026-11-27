// Single source of truth for thresholds shown by the dashboard.
// Values follow the CompostIQ project documentation (report) and the alert logic in
// firmware/BioDegradeX_React_Compatible.ino. The dashboard only *reads* these to label
// readings; it never changes what the ESP32 does.
//
export const T = {
  soilDry: 2000, soilWet: 1000,
  gasHigh: 1500, gasFanOff: 1300,
  tempLow: 20, tempHigh: 35, tempFanOff: 33,
  humLow: 40, humHigh: 60,
  pumpBurstMs: 2000, pumpCooldownMs: 60000,
}

export const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v))

// DHT read failures are reported by this firmware as exactly 0 / 0.
export const dhtFailed = r => r && r.temperature === 0 && r.humidity === 0

// Same formula as calculateHealthScore() in the firmware. ThingSpeak does not carry
// the firmware's score, so cloud-derived values must always be labelled "estimated".
export function estimateHealthScore(r) {
  if (!r || [r.temperature, r.humidity, r.soilMoisture, r.gasValue].some(v => v == null)) return null
  const soilDry = r.thresholds?.soilDry ?? T.soilDry
  let t = 100, h = 100, s = 100, g = 100
  if (r.temperature < 20) t = (r.temperature / 20) * 100
  else if (r.temperature > 35) t = Math.max(0, 100 - (r.temperature - 35) * 5)
  if (r.humidity < 40) h = (r.humidity / 40) * 100
  else if (r.humidity > 60) h = Math.max(0, 100 - (r.humidity - 60) * 2)
  if (r.soilMoisture < 1000) s = (r.soilMoisture / 1000) * 100
  else if (r.soilMoisture > soilDry) s = Math.max(0, 100 - (r.soilMoisture - soilDry) * 0.05)
  if (r.gasValue > 1500) g = Math.max(0, 100 - (r.gasValue - 1500) * 0.1)
  return { total: (t + h + s + g) / 4, parts: { temperature: t / 4, humidity: h / 4, soilMoisture: s / 4, gasValue: g / 4 } }
}

// Same bands the ESP32's own web page uses for the top two tiers (>85, >60); lower split is ours.
export function healthBand(score) {
  if (score == null) return { key: 'unknown', label: 'Unavailable', msg: 'Waiting for data from your compost unit.' }
  if (score > 85) return { key: 'ideal', label: 'Ideal', msg: 'Your compost is in excellent condition!' }
  if (score > 60) return { key: 'good', label: 'Good', msg: 'Your compost is in good condition.' }
  if (score > 40) return { key: 'moderate', label: 'Moderate', msg: 'Your compost needs some attention.' }
  return { key: 'poor', label: 'Poor', msg: 'Your compost needs attention soon.' }
}

// Per-sensor status. tone: ok | warn | bad | unknown
export function sensorStatus(kind, r) {
  const v = r?.[kind]
  if (r?.sensorValidity?.[kind] === false) return { label: 'Disconnected', tone: 'bad' }
  if (v == null) return { label: '—', tone: 'unknown' }
  if ((kind === 'temperature' || kind === 'humidity') && dhtFailed(r)) return { label: 'Check sensor', tone: 'warn' }
  switch (kind) {
    case 'temperature':
      if (v < T.tempLow) return { label: 'Low', tone: 'warn' }
      if (v > T.tempHigh) return { label: 'High', tone: 'bad' }
      return { label: 'Normal', tone: 'ok' }
    case 'humidity':
      if (v < T.humLow) return { label: 'Low', tone: 'warn' }
      if (v > T.humHigh) return { label: 'High', tone: 'warn' }
      return { label: 'Normal', tone: 'ok' }
    case 'soilMoisture': // raw ADC: higher = drier
      if (v > (r?.thresholds?.soilDry ?? T.soilDry)) return { label: 'Dry', tone: 'bad' }
      if (v < T.soilWet) return { label: 'Wet', tone: 'warn' }
      return { label: 'Normal', tone: 'ok' }
    case 'gasValue':
      if (v > T.gasHigh) return { label: 'High', tone: 'bad' }
      return { label: 'Normal', tone: 'ok' }
    default: return { label: '—', tone: 'unknown' }
  }
}

// Every alert that is true for a reading (the firmware only reports the top-priority one).
export function evaluateAlerts(r) {
  if (!r) return []
  const out = []
  const sensorNames = { temperature: 'Temperature sensor', humidity: 'Humidity sensor', soilMoisture: 'Soil moisture sensor', gasValue: 'Gas sensor' }
  Object.entries(r.sensorValidity || {}).forEach(([key, valid]) => {
    if (valid === false) out.push({ id: `sensor-${key}`, sensor: sensorNames[key] || key, severity: 'warning', message: `${sensorNames[key] || key} disconnected or invalid`, action: 'Check the sensor connection and its analog signal.' })
  })
  const ok = !dhtFailed(r)
  if (r.gasValue != null && r.gasValue > T.gasHigh) out.push({ id: 'gas-high', sensor: 'Gas level', severity: 'critical', message: 'High gas spike detected', action: 'Check the compost and let the ventilation fan run.' })
  if (r.soilMoisture != null && r.soilMoisture > (r.thresholds?.soilDry ?? T.soilDry)) out.push({ id: 'soil-dry', sensor: 'Soil moisture', severity: 'warning', message: 'Compost too dry', action: 'Add water. The pump waters automatically after its cooldown.' })
  if (r.soilMoisture != null && r.soilMoisture < T.soilWet) out.push({ id: 'soil-wet', sensor: 'Soil moisture', severity: 'warning', message: 'Compost too wet', action: 'Turn the compost and add dry browns to restore airflow.' })
  // The firmware starts the fan above tempHigh, but does not set alarmState for high heat.
  if (ok && r.temperature != null && r.temperature < T.tempLow) out.push({ id: 'temp-low', sensor: 'Temperature', severity: 'warning', message: 'Temperature low — compost cooling', action: 'Add greens or insulate the bin.' })
  return out
}

// Why an actuator is (or is not) active, from current readings.
export function pumpReason(r) {
  if (!r) return 'No data'
  if (r.sensorValidity?.soilMoisture === false) return 'Blocked — soil sensor is disconnected or invalid'
  if (r.soilMoisture == null) return 'Waiting for a valid soil sensor reading'
  const soilDry = r.thresholds?.soilDry ?? T.soilDry
  if (r.soilMoisture > soilDry) return `Soil reading ${r.soilMoisture} is above the dry limit (${soilDry})`
  return r.pumpState ? 'Watering burst finishing' : 'Soil moisture is within range'
}
export function fanReason(r) {
  if (!r) return 'No data'
  if (r.temperature == null && r.gasValue == null) return 'Waiting for valid temperature and gas readings'
  const why = []
  if (r.gasValue >= T.gasHigh) why.push(`gas ${r.gasValue} ≥ ${T.gasHigh}`)
  const tempHigh = r.thresholds?.temperatureHigh ?? T.tempHigh
  if (!dhtFailed(r) && r.temperature >= tempHigh) why.push(`temperature ${r.temperature.toFixed(1)} °C ≥ ${tempHigh} °C`)
  if (why.length) return `Trigger: ${why.join(', ')}`
  return r.fanState ? `Running — stops when temperature ≤ ${T.tempFanOff} °C and gas ≤ ${T.gasFanOff} ADC` : 'Air quality and temperature are within range'
}

export function insights(r, alerts, state) {
  if (!r) return { title: 'Waiting for sensor data', hint: 'Insights appear once readings arrive.' }
  if (state === 'stale') return { title: 'Showing the last data received.', hint: 'The unit keeps running its automation locally while it is out of reach.' }
  const a = alerts[0]
  if (!a) return { title: 'Your compost conditions are ideal.', hint: 'Keep monitoring for the best results!' }
  const map = {
    'soil-dry': ['Moisture is below the preferred range.', 'The pump will add water automatically.'],
    'soil-wet': ['Compost is wetter than preferred.', 'Ventilation may be required — consider turning the pile.'],
    'gas-high': ['Gas level is elevated.', 'Ventilation may be required.'],
    'temp-low': ['Temperature is lower than expected.', 'Add nitrogen-rich greens or insulate the bin.'],
  }
  const [title, hint] = map[a.id]
  return { title, hint }
}
