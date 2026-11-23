import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Activity, AlertCircle, Bell, Check, CheckCircle2, ChevronRight, Clock3,
  Cloud, Droplets, Fan, Leaf, RefreshCw, Sprout, Thermometer, Wifi,
  Wind, Settings as SettingsIcon
} from 'lucide-react'
import { chartOptions } from '../lib/chart'

const sensors = [
  { key: 'temperature', label: 'Temperature', unit: '°C', icon: Thermometer, color: '#268755', min: 0, max: 50 },
  { key: 'humidity', label: 'Humidity', unit: '%', icon: Droplets, color: '#579bdb', min: 0, max: 100 },
  { key: 'soilMoisture', label: 'Soil Moisture', unit: 'ADC', icon: Sprout, color: '#a7bd59', min: 0, max: 3000 },
  { key: 'gasValue', label: 'Gas Level', unit: 'ADC', icon: Wind, color: '#d9aa32', min: 0, max: 3000 }
]
const ranges = { '1h': 1, '6h': 6, '12h': 12, '24h': 24 }

export default function Overview({ data, history = [], connected, health, lastSeen, alert, events = [], setPage, refresh }) {
  const [range, setRange] = useState('24h')
  const score = data?.healthScore == null ? null : Math.round(Number(data.healthScore))
  const scoreTone = score == null ? 'unavailable' : score >= 85 ? 'ideal' : score >= 65 ? 'good' : score >= 45 ? 'watch' : 'attention'
  const filtered = useMemo(() => {
    const cutoff = Date.now() - ranges[range] * 60 * 60 * 1000
    return history.filter(sample => !sample.sourceTimestamp || Number.isNaN(Date.parse(sample.sourceTimestamp)) || Date.parse(sample.sourceTimestamp) >= cutoff)
  }, [history, range])
  const chartData = useMemo(() => ({
    labels: filtered.map(sample => sample.time),
    datasets: sensors.map(sensor => ({
      label: sensor.label,
      data: filtered.map(sample => sample[sensor.key] == null ? null : Math.min(100, Math.max(0, Number(sample[sensor.key]) / sensor.max * 100))),
      rawValues: filtered.map(sample => sample[sensor.key]),
      borderColor: sensor.color,
      backgroundColor: sensor.color,
      borderWidth: 1.5,
      tension: .35,
      pointRadius: 0,
      pointHoverRadius: 3,
      spanGaps: true
    }))
  }), [filtered])
  const options = useMemo(() => ({
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      legend: { display: false },
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: { label: context => {
          const sensor = sensors[context.datasetIndex]
          const raw = context.dataset.rawValues[context.dataIndex]
          return `${sensor.label}: ${raw == null ? '—' : Number(raw).toLocaleString()} ${sensor.unit}`
        } }
      }
    },
    scales: {
      x: { ...chartOptions.scales.x, ticks: { ...chartOptions.scales.x.ticks, maxTicksLimit: 5, font: { size: 8 } } },
      y: { ...chartOptions.scales.y, min: 0, max: 100, ticks: { ...chartOptions.scales.y.ticks, stepSize: 25, font: { size: 8 } } }
    }
  }), [])

  const updated = data?.lastUpdate ? formatTime(data.lastUpdate) : lastSeen ? formatTime(new Date()) : 'Waiting for data'
  const currentMessage = alert || data?.alertMessage
  const alarm = data?.alarmState === true
  const activeAlerts = alarm ? 1 : 0
  const insight = getInsight(data, connected, currentMessage)
  const recentEvents = events.slice().reverse().slice(0, 3)

  return <div className="overview-dashboard">
    <header className="overview-welcome">
      <div className="welcome-leaf"><Sprout size={28}/></div>
      <div className="welcome-copy">
        <h1>Welcome to CompostIQ</h1>
        <p>Monitoring. Maintaining. Sustaining.</p>
      </div>
      <div className="overview-actions">
        <div className="last-update"><span className={`dot ${connected ? 'online' : ''}`}/><span>Last Updated: {updated}</span></div>
        <button className="refresh-round" onClick={refresh} title="Refresh sensor data" aria-label="Refresh sensor data"><RefreshCw size={16}/></button>
      </div>
    </header>

    <div className="overview-top-grid">
      <section className="overview-card health-feature">
        <CardTitle icon={<Leaf size={17}/>} title="Compost Health Score" action={<button className="info-button" title="Score is calculated by the ESP32 firmware">i</button>}/>
        <div className="health-feature-body">
          <div className="health-number-block">
            <div className={`health-number ${scoreTone}`}>{score == null ? '—' : <>{score}<small>%</small></>}</div>
            <span className={`health-badge ${scoreTone}`}><Leaf size={12}/>{score == null ? 'Unavailable' : score >= 85 ? 'Ideal' : score >= 65 ? 'Good' : score >= 45 ? 'Moderate' : 'Needs care'}</span>
          </div>
          <CompostIllustration/>
        </div>
        <p className="health-message">{score == null ? 'Health score is not included in the current cloud feed.' : score >= 85 ? 'Your compost is in excellent condition!' : 'Your compost health needs a closer look.'}</p>
      </section>

      <section className="overview-card sensor-feature">
        <CardTitle icon={<Activity size={16}/>} title="Sensor Readings" action={<button className="card-link" onClick={() => setPage('Sensors')}>View all <ChevronRight size={13}/></button>}/>
        <div className="sensor-mini-grid">{sensors.map(sensor => <SensorMini key={sensor.key} sensor={sensor} value={data?.[sensor.key]} history={history}/>)}</div>
      </section>

      <section className="overview-card system-feature">
        <CardTitle icon={<SettingsIcon size={16}/>} title="System Status" action={null}/>
        <ActuatorRow icon={<Droplets size={23}/>} title="Water Pump" state={data?.pumpState} connected={connected} detail="AUTO ·"/>
        <ActuatorRow icon={<Fan size={23}/>} title="Ventilation Fan" state={data?.fanState} connected={connected} detail="AUTO ·"/>
      </section>
    </div>

    <div className="overview-middle-grid">
      <section className="overview-card trends-feature">
        <div className="trend-head">
          <CardTitle icon={<Activity size={16}/>} title="Sensor Trends" action={null}/>
          <div className="range-switch" aria-label="Sensor trend time range">{Object.keys(ranges).map(option => <button key={option} className={range === option ? 'selected' : ''} onClick={() => setRange(option)}>{option}</button>)}</div>
        </div>
        <div className="trend-chart-wrap">{filtered.length > 1 ? <Line data={chartData} options={options}/> : <div className="chart-empty">Trend lines appear after the feed provides multiple timestamped readings.</div>}</div>
        <div className="trend-legend">{sensors.map(sensor => <span key={sensor.key}><i style={{background:sensor.color}}/>{sensor.label}{sensor.key === 'temperature' ? ' (°C)' : sensor.key === 'humidity' ? ' (%)' : ' (ADC)'}</span>)}</div>
      </section>

      <section className="overview-card alerts-feature">
        <CardTitle icon={<Bell size={17}/>} title="Active Alerts" action={<button className="card-link" onClick={() => setPage('Alerts & logs')}>View All <ChevronRight size={13}/></button>}/>
        <div className={`alert-state-box ${alarm ? 'alerting' : connected ? 'clear' : 'unknown'}`}>
          <span className="alert-check">{alarm ? <AlertCircle size={17}/> : connected ? <Check size={17}/> : <Clock3 size={16}/>}</span>
          <div><b>{alarm ? currentMessage : connected ? 'All parameters are normal!' : 'Waiting for sensor data'}</b><em>{alarm ? 'Check your compost conditions.' : connected ? 'No active alerts at the moment.' : 'Alert status is unavailable offline.'}</em></div>
        </div>
        <div className="alert-foot"><span>{activeAlerts} active</span><span className={`status-text ${alarm ? 'warning' : connected ? 'ok' : ''}`}>{alarm ? 'Attention' : connected ? 'System normal' : 'Unavailable'}</span></div>
      </section>
    </div>

    <div className="overview-bottom-grid">
      <section className="overview-card bottom-feature connectivity-feature">
        <CardTitle icon={<Wifi size={16}/>} title="Connectivity" action={null}/>
        <div className="connectivity-list">
          <Connection icon={<Wifi size={17}/>} label="Device Feed" connected={connected} detail={connected ? 'Available' : 'Unavailable'}/>
          <Connection icon={<Cloud size={17}/>} label="ThingSpeak" connected={connected} detail={connected ? 'Data received' : 'Unavailable'}/>
          <Connection icon={<Activity size={17}/>} label="MQTT" connected={!!health?.mqttConnected} detail={health?.mqttConnected ? 'Connected' : 'Not reported'}/>
        </div>
      </section>
      <section className="overview-card bottom-feature insight-feature">
        <CardTitle icon={<Sprout size={17}/>} title="Quick Insights" action={null}/>
        <div className="insight-content"><Leaf size={36}/><p>{insight}<em>{connected ? 'Keep monitoring for the best results.' : 'Insights will update when data arrives.'}</em></p></div>
      </section>
      <section className="overview-card bottom-feature activity-feature">
        <CardTitle icon={<Clock3 size={16}/>} title="Recent Activity" action={<button className="card-link" onClick={() => setPage('Alerts & logs')}>View Logs <ChevronRight size={13}/></button>}/>
        {recentEvents.length ? <div className="recent-list">{recentEvents.map((event, i) => <div className="recent-item" key={event.signature || `${event.time}-${i}`}><i className={event.alarm ? 'warn' : ''}/><time>{event.time}</time><span>{event.message}</span></div>)}</div> : <div className="activity-empty">Device events appear here as they are observed.</div>}
      </section>
    </div>
  </div>
}

function CardTitle({ icon, title, action }) { return <div className="overview-card-title"><span>{icon}</span><h2>{title}</h2>{action}</div> }

function SensorMini({ sensor, value, history }) {
  const Icon = sensor.icon
  const condition = sensorCondition(sensor.key, value)
  const hasTrend = history.filter(sample => sample[sensor.key] != null).length > 1
  const path = sparkline(history, sensor)
  return <div className="sensor-mini-card">
    <div className="sensor-mini-heading"><Icon size={16} style={{color:sensor.color}}/><span>{sensor.label}</span></div>
    <div className="sensor-mini-reading">{value == null ? '—' : formatReading(value)} <small>{sensor.unit}</small><b className={condition.tone}>{condition.label}</b></div>
    <div className={`mini-wave ${hasTrend ? '' : 'no-trend'}`} style={{'--wave-color':sensor.color}}><svg viewBox="0 0 140 18" preserveAspectRatio="none"><path d={path}/></svg></div>
  </div>
}

function ActuatorRow({ icon, title, state, connected, detail }) {
  const running = state === true
  return <div className="actuator-row"><span className={`actuator-round ${title === 'Water Pump' ? 'water' : 'fan'}`}>{icon}</span><div className="actuator-info"><b>{title}</b><small>{detail} {state == null ? '—' : running ? 'ON' : 'OFF'}</small></div><span className={`ready-pill ${!connected ? 'unavailable' : running ? 'running' : ''}`}><i/>{!connected ? 'Offline' : running ? 'Running' : 'Ready'}</span></div>
}

function CompostIllustration() { return <div className="compost-illustration" aria-hidden="true"><div className="compost-plant"><Sprout size={35}/></div><div className="compost-pot"><span/><span/><span/><i/><i/></div></div> }

function Connection({ icon, label, connected, detail }) { return <div className="connection-item"><span className="connection-icon">{icon}</span><b>{label}</b><small><i className={connected ? 'up' : ''}/>{detail}</small></div> }

function sensorCondition(key, value) {
  if (value == null) return {label:'No data',tone:'neutral'}
  const n = Number(value)
  if (key === 'temperature') return n < 20 || n > 35 ? {label:'Review',tone:'warn'} : {label:'Normal',tone:'normal'}
  if (key === 'humidity') return n < 40 || n > 60 ? {label:'Review',tone:'warn'} : {label:'Normal',tone:'normal'}
  if (key === 'soilMoisture') return n < 1000 || n > 2000 ? {label:n > 2000 ? 'Dry' : 'Wet',tone:'warn'} : {label:'Normal',tone:'normal'}
  return n > 1500 ? {label:'High',tone:'warn'} : {label:'Normal',tone:'normal'}
}

function getInsight(data, connected, alertMessage) {
  if (!connected) return 'Live compost insights are unavailable while the data feed is disconnected.'
  if (data?.alarmState) return alertMessage || 'The device has an active alert. Check the latest sensor conditions.'
  if (data?.temperature != null && Number(data.temperature) >= 35) return 'The compost is warm; the ventilation fan threshold may be active.'
  if (data?.soilMoisture != null && Number(data.soilMoisture) > 2000) return 'The moisture reading is in the firmware dry zone; automatic watering may run.'
  if (data?.gasValue != null && Number(data.gasValue) >= 1500) return 'Gas is at the ventilation trigger threshold; check the airflow.'
  return 'No active device alert. Sensor values are available for monitoring.'
}

function formatReading(value) { const n = Number(value); return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1) }
function formatTime(value) { const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString([], {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) }
function sparkline(history, sensor) {
  const values = history.map(sample => Number(sample[sensor.key])).filter(Number.isFinite)
  if (values.length < 2) return 'M0 9 L140 9'
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.max(1, Math.abs(max) * .05)
  return values.map((value, index) => `${index ? 'L' : 'M'}${(index / (values.length - 1) * 140).toFixed(1)} ${(15 - ((value - min) / span) * 11).toFixed(1)}`).join(' ')
}
