import { useState } from 'react'
import { Line } from 'react-chartjs-2'
import { chartOptions } from '../lib/chart'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Fan,
  Gauge,
  Leaf,
  Save,
  Settings as SettingsIcon,
  Thermometer,
  Wind,
  Droplets
} from 'lucide-react'

// ==============================
// SENSOR PAGE
// ==============================

export function Sensors({ data, history }) {
  const cards = [
    ['Temperature', data?.temperature, '°C', 'DHT22 · GPIO 4'],
    ['Humidity', data?.humidity, '%', 'DHT22 · GPIO 4'],
    ['Soil moisture', data?.soilMoisture, 'ADC', 'Analog input · GPIO 34'],
    ['Gas level', data?.gasValue, 'ADC', 'Analog input · GPIO 35']
  ]

  return (
    <>
      <PageIntro
        eyebrow="SENSOR NETWORK"
        title="Sensor readings"
        desc="Raw values received from the sensors connected to your ESP32."
      />

      <div className="detail-grid">
        {cards.map(([n, v, u, d], i) => (
          <div className="panel sensor-detail" key={n}>
            <span className="sensor-detail-icon">
              {[<Thermometer />, <Droplets />, <Leaf />, <Activity />][i]}
            </span>

            <small>{n}</small>

            <strong>
              {v == null ? '—' : Number(v).toFixed(1)} <i>{u}</i>
            </strong>

            <p>{d}</p>

            <span className="sensor-foot">
              <span className="dot online" /> Reading from device
            </span>
          </div>
        ))}
      </div>

      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h3>Recent sensor samples</h3>
            <p>Samples collected while this dashboard is open</p>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Temperature</th>
                <th>Humidity</th>
                <th>Soil ADC</th>
                <th>Gas ADC</th>
              </tr>
            </thead>

            <tbody>
              {history
                .slice()
                .reverse()
                .slice(0, 12)
                .map((x, i) => (
                  <tr key={i}>
                    <td>{x.time}</td>
                    <td>{x.temperature} °C</td>
                    <td>{x.humidity} %</td>
                    <td>{x.soilMoisture}</td>
                    <td>{x.gasValue}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {!history.length && (
            <div className="empty-state">
              Sensor history will appear here once the ESP32 is connected.
            </div>
          )}
        </div>
      </section>
    </>
  )
}

// ==============================
// COMPOST HEALTH PAGE
// ==============================

export function CompostHealth({ data }) {
  const score = Math.round(Number(data?.healthScore || 0))

  return (
    <>
      <PageIntro
        eyebrow="COMPOST CONDITIONS"
        title="Compost health"
        desc="A quick view of the health score calculated by your existing ESP32 firmware."
      />

      <div className="health-detail-grid">
        <section className="panel health-big">
          <span className="health-leaf">
            <Leaf />
          </span>

          <div className="eyebrow">CURRENT HEALTH SCORE</div>

          <div className="big-score">
            {data?.healthScore == null ? '—' : score}
            <small>/100</small>
          </div>

          <div className="score-track">
            <span
              style={{
                width: `${Math.max(0, Math.min(100, score))}%`
              }}
            />
          </div>

          <h3>
            {data?.healthScore == null
              ? 'Waiting for device'
              : score >= 75
                ? 'Compost is looking healthy'
                : score >= 45
                  ? 'Some conditions need attention'
                  : 'Check compost conditions'}
          </h3>

          <p>
            This score is calculated on the ESP32 from temperature,
            humidity, soil moisture and gas readings. The dashboard
            does not recalculate or override it.
          </p>
        </section>

        <section className="panel health-notes">
          <h3>What the sensors tell you</h3>

          <Info
            icon={<Thermometer />}
            title="Temperature"
            text="The DHT22 monitors compost temperature. The firmware uses it as one input to the health score and fan automation."
          />

          <Info
            icon={<Droplets />}
            title="Humidity"
            text="Humidity is read by the DHT22 and contributes to the firmware health score."
          />

          <Info
            icon={<Leaf />}
            title="Soil moisture"
            text="The analog moisture sensor indicates whether the compost is dry or wet. The ESP32 uses thresholds for alerts and pump timing."
          />

          <Info
            icon={<Activity />}
            title="Gas level"
            text="The gas sensor reading contributes to the health score and can trigger a high-gas alert and ventilation fan."
          />
        </section>
      </div>
    </>
  )
}

// ==============================
// AUTOMATION PAGE
// ==============================

export function Automation({ data }) {
  return (
    <>
      <PageIntro
        eyebrow="AUTOMATIC RESPONSE"
        title="Automation status"
        desc="The ESP32 controls the relays locally. This page is read-only; no dashboard controls can switch hardware."
      />

      <div className="detail-grid">
        <div className="panel automation-card">
          <span className="automation-icon">
            <Droplets />
          </span>

          <div className="eyebrow">RELAY 1 · GPIO 26</div>

          <h2>Water pump</h2>

          <div className="automation-state">
            {data?.pumpState == null
              ? 'Unknown'
              : data.pumpState
                ? 'Running'
                : 'Standby'}
          </div>

          <p>
            Automatic short watering pulse when the soil moisture
            reading crosses the dry threshold, with a cooldown between runs.
          </p>

          <span className={`pill ${data?.pumpState ? 'pill-green' : 'pill-neutral'}`}>
            {data?.pumpState ? 'ON' : 'OFF'}
          </span>
        </div>

        <div className="panel automation-card">
          <span className="automation-icon">
            <Fan />
          </span>

          <div className="eyebrow">RELAY 2 · GPIO 27</div>

          <h2>Ventilation fan</h2>

          <div className="automation-state">
            {data?.fanState == null
              ? 'Unknown'
              : data.fanState
                ? 'Running'
                : 'Standby'}
          </div>

          <p>
            Starts when temperature or gas reaches its ON threshold.
            Uses separate OFF thresholds to prevent rapid relay switching.
          </p>

          <span className={`pill ${data?.fanState ? 'pill-green' : 'pill-neutral'}`}>
            {data?.fanState ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      <section className="panel note-panel">
        <AlertTriangle size={19} />

        <div>
          <b>Hardware safety</b>

          <p>
            Do not use this website to test relay switching. Pump and fan
            behaviour remains governed by the thresholds and timing in
            the ESP32 firmware.
          </p>
        </div>
      </section>
    </>
  )
}

// ==============================
// ALERTS PAGE
// ==============================

export function Alerts({ data, events }) {
  return (
    <>
      <PageIntro
        eyebrow="SYSTEM MESSAGES"
        title="Alerts & activity"
        desc="Messages reported by the ESP32 during this dashboard session."
      />

      <div
        className={`current-alert ${
          data?.alarmState ? 'alert-danger' : 'alert-ok'
        }`}
      >
        <span>
          {data?.alarmState ? <AlertTriangle /> : <CheckCircle2 />}
        </span>

        <div>
          <small>CURRENT DEVICE ALERT</small>
          <b>{data?.alertMessage || 'Waiting for alert information'}</b>
        </div>

        <strong>{data?.alarmState ? 'ACTIVE' : 'NORMAL'}</strong>
      </div>

      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h3>Recent events</h3>
            <p>New readings and alert-state changes</p>
          </div>
        </div>

        {events.length ? (
          <div className="event-list">
            {events
              .slice()
              .reverse()
              .map((e, i) => (
                <div className="event-row" key={i}>
                  <span className={`event-icon ${e.alarm ? 'event-warn' : ''}`}>
                    {e.alarm ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                  </span>

                  <div>
                    <b>{e.message}</b>
                    <small>{e.time}</small>
                  </div>

                  <span className={`pill ${e.alarm ? 'pill-red' : 'pill-green'}`}>
                    {e.alarm ? 'ALERT' : 'INFO'}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <div className="empty-state">
            No events yet. Events will be recorded while this page is open.
          </div>
        )}
      </section>
    </>
  )
}

// ==============================
// SETTINGS PAGE
// ==============================

export function Settings({ connected, onTest }) {
  const [saved, setSaved] = useState(false)

  const [channel, setChannel] = useState(
    localStorage.getItem('bdx-thingspeak-channel') || ''
  )

  const [readKey, setReadKey] = useState(
    localStorage.getItem('bdx-thingspeak-readkey') || ''
  )

  function saveCloudSettings() {
    localStorage.setItem('bdx-thingspeak-channel', channel.trim())
    localStorage.setItem('bdx-thingspeak-readkey', readKey.trim())

    setSaved(true)
    setTimeout(() => setSaved(false), 2400)
  }

  return (
    <>
      <PageIntro
        eyebrow="SYSTEM CONFIGURATION"
        title="Connection settings"
        desc="Manage your backend connection and optional ThingSpeak cloud charts."
      />

      {/* BACKEND CONNECTION */}

      <section className="panel settings-panel">
        <div className="settings-title">
          <span className="settings-icon">
            <Activity />
          </span>

          <div>
            <h3>FastAPI backend</h3>

            <p>
              Sensor readings are retrieved through the COMPOSTIQ
              backend, which fetches the latest data from ThingSpeak.
            </p>
          </div>

          <span className={`pill ${connected ? 'pill-green' : 'pill-red'}`}>
            {connected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        <div className="cloud-row">
          <Cloud />

          <div>
            <b>Backend API</b>
            <small>http://127.0.0.1:8000</small>
          </div>

          <span className={`pill ${connected ? 'pill-green' : 'pill-red'}`}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="cloud-row">
          <Activity />

          <div>
            <b>Sensor endpoint</b>
            <small>/api/sensors</small>
          </div>

          <span className="pill pill-green">API</span>
        </div>

        <div className="cloud-row">
          <CheckCircle2 />

          <div>
            <b>Health endpoint</b>
            <small>/api/health</small>
          </div>

          <span className="pill pill-green">API</span>
        </div>

        <div className="settings-actions">
          <button className="primary-btn" onClick={onTest}>
            <Activity size={15} />
            Refresh connection
          </button>
        </div>

        <div className="cloud-note">
          The ESP32 sends sensor readings to ThingSpeak. FastAPI
          retrieves the latest readings and provides them to this dashboard.
          Keep the backend server running while using COMPOSTIQ.
        </div>
      </section>

      {/* THINGSPEAK SETTINGS */}

      <section className="panel settings-panel">
        <div className="settings-title">
          <span className="settings-icon cloud">
            <Cloud />
          </span>

          <div>
            <h3>ThingSpeak cloud charts</h3>

            <p>
              Configure optional read-only historical charts
              from your ThingSpeak channel.
            </p>
          </div>
        </div>

        <label className="field-label">Channel ID</label>

        <input
          className="text-input"
          value={channel}
          onChange={e => setChannel(e.target.value)}
          placeholder="Enter your ThingSpeak channel ID"
        />

        <label className="field-label field-spaced">
          Read API key <span>(only if the channel is private)</span>
        </label>

        <input
          className="text-input"
          value={readKey}
          onChange={e => setReadKey(e.target.value)}
          placeholder="Read API key (optional)"
        />

        <div className="settings-actions">
          <button className="primary-btn" onClick={saveCloudSettings}>
            <Save size={15} />
            Save cloud settings
          </button>

          {saved && (
            <span className="saved-note">
              Saved in this browser
            </span>
          )}
        </div>

        <div className="cloud-note">
          These settings are used only for the optional embedded cloud charts.
          The main sensor dashboard receives its readings through FastAPI.
        </div>
      </section>

      {/* PIPELINE */}

      <section className="panel settings-panel">
        <h3>Data pipeline</h3>

        <div className="cloud-row">
          <Cloud />

          <div>
            <b>ThingSpeak</b>

            <small>
              Cloud storage for temperature, humidity, soil moisture,
              gas level, pump and fan readings.
            </small>
          </div>

          <span className="pill pill-green">DATA SOURCE</span>
        </div>

        <div className="cloud-row">
          <Activity />

          <div>
            <b>FastAPI</b>

            <small>
              Retrieves cloud readings and serves data to the React dashboard.
            </small>
          </div>

          <span className="pill pill-green">BACKEND</span>
        </div>

        <div className="cloud-row">
          <Wind />

          <div>
            <b>ESP32 automation</b>

            <small>
              The ESP32 controls the pump and ventilation fan
              according to its programmed thresholds.
            </small>
          </div>

          <span className="pill pill-green">HARDWARE</span>
        </div>

        <p className="field-help">
          MQTT is not independently verified by this dashboard connection check.
        </p>
      </section>

      {/* OPTIONAL CLOUD CHARTS */}

      {channel && (
        <section className="panel settings-panel">
          <div className="panel-heading">
            <div>
              <h3>ThingSpeak channel charts</h3>
              <p>Cloud history from your configured channel</p>
            </div>

            <span className="pill pill-green">CLOUD VIEW</span>
          </div>

          <div className="thingspeak-frame">
            <iframe
              title="ThingSpeak temperature chart"
              src={`https://thingspeak.com/channels/${encodeURIComponent(channel)}/charts/1?bgcolor=%23fffefa&color=%2342694b&dynamic=true&results=60${
                readKey
                  ? `&api_key=${encodeURIComponent(readKey)}`
                  : ''
              }`}
              loading="lazy"
            />
          </div>

          <div className="thingspeak-frame">
            <iframe
              title="ThingSpeak humidity chart"
              src={`https://thingspeak.com/channels/${encodeURIComponent(channel)}/charts/2?bgcolor=%23fffefa&color=%23658e91&dynamic=true&results=60${
                readKey
                  ? `&api_key=${encodeURIComponent(readKey)}`
                  : ''
              }`}
              loading="lazy"
            />
          </div>
        </section>
      )}
    </>
  )
}

// ==============================
// SHARED COMPONENTS
// ==============================

function PageIntro({ eyebrow, title, desc }) {
  return (
    <div className="page-intro">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{desc}</p>
    </div>
  )
}

function Info({ icon, title, text }) {
  return (
    <div className="info-row">
      <span>{icon}</span>

      <div>
        <b>{title}</b>
        <p>{text}</p>
      </div>
    </div>
  )
}