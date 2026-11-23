
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Sprout, Wifi, WifiOff } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import { Sensors, CompostHealth, Automation, Alerts, Settings } from './pages/DetailPages'
import { fetchDeviceHealth } from './lib/api'
import { getSensorData } from './services/api'

const PAGES = ['Overview', 'Sensors', 'Compost health', 'Automation', 'Alerts & logs', 'Settings']

export default function App() {
  const [page, setPage] = useState('Overview')
  const [collapsed, setCollapsed] = useState(false)
  const [data, setData] = useState(null)
  const [health, setHealth] = useState(null)
  const [connected, setConnected] = useState(false)
  const [lastSeen, setLastSeen] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [events, setEvents] = useState([])
  const [alert, setAlert] = useState('')
  const lastSnapshot = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const [next, h] = await Promise.all([
        getSensorData(),
        fetchDeviceHealth().catch(() => null)
      ])

      setData(next)
      setHealth(h)
      setConnected(true)
      setError('')
      setLastSeen(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      )

      const observedAt = new Date()
      const sample = {
        sourceTimestamp: next.lastUpdate || null,
        time: (next.lastUpdate ? new Date(next.lastUpdate) : observedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),
        temperature: Number(next.temperature),
        humidity: Number(next.humidity),
        soilMoisture: Number(next.soilMoisture),
        gasValue: Number(next.gasValue)
      }

      setHistory(old => {
        if (sample.sourceTimestamp && old[old.length - 1]?.sourceTimestamp === sample.sourceTimestamp) return old
        return [...old, sample].slice(-36)
      })

      const message = next.alertMessage || 'No alert message'
      setAlert(message)

      const previous = lastSnapshot.current
      const eventTime = observedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const additions = []
      const sampleChanged = !previous || (next.lastUpdate && next.lastUpdate !== previous.lastUpdate)
      if (sampleChanged) additions.push({ signature: `sample:${next.lastUpdate || observedAt.toISOString()}`, time: eventTime, message: 'Sensor data updated', alarm: false })
      if (previous && previous.pumpState !== next.pumpState) additions.push({ signature: `pump:${observedAt.toISOString()}`, time: eventTime, message: `Water pump ${next.pumpState ? 'activated' : 'stopped'}`, alarm: false })
      if (previous && previous.fanState !== next.fanState) additions.push({ signature: `fan:${observedAt.toISOString()}`, time: eventTime, message: `Ventilation fan ${next.fanState ? 'activated' : 'stopped'}`, alarm: false })
      if (next.alarmState && (!previous || !previous.alarmState)) additions.push({ signature: `alert:${observedAt.toISOString()}`, time: eventTime, message, alarm: true })
      if (previous?.alarmState && !next.alarmState) additions.push({ signature: `resolved:${observedAt.toISOString()}`, time: eventTime, message: 'Device alert cleared', alarm: false })
      lastSnapshot.current = next
      if (additions.length) setEvents(old => [...old, ...additions].slice(-40))

    } catch (e) {
      setConnected(false)
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    refresh()

    const id = setInterval(refresh, 30000)

    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const pageContent = useMemo(() => {
    const common = {
      data,
      history,
      connected,
      health,
      lastSeen,
      alert,
      events,
      setPage,
      refresh
    }

    switch (page) {
      case 'Sensors':
        return <Sensors {...common} />

      case 'Compost health':
        return <CompostHealth {...common} />

      case 'Automation':
        return <Automation {...common} />

      case 'Alerts & logs':
        return <Alerts {...common} />

      case 'Settings':
        return <Settings {...common} onTest={refresh} />

      default:
        return <Overview {...common} />
    }
  }, [page, data, history, connected, health, lastSeen, alert, events, refresh])

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        setPage={setPage}
        connected={connected}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <main className={`main-area ${page === 'Overview' ? 'overview-active' : ''}`}>
        <header className="topbar">
          <div className="breadcrumb">
            <span>COMPOSTIQ</span>
            <b>/</b>
            <strong>{page}</strong>
          </div>

          <div className="topbar-right">
            <span className={`connection-label ${connected ? '' : 'disconnected'}`}>
              {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
              {connected ? 'Device online' : 'Device offline'}
            </span>

            <button
              className="icon-btn"
              title="Alerts"
              onClick={() => setPage('Alerts & logs')}
            >
              <Bell size={17} />
              {data?.alarmState && <i />}
            </button>

            <div className="avatar">B</div>
          </div>
        </header>

        <div className="content-wrap" key={page}>
          {pageContent}

          {error && (
            <div className="error-toast">
              <WifiOff size={15} />
              <span>
                {error}. Check the backend connection.
              </span>
            </div>
          )}
        </div>

        <footer className="footer">
          <span>
            <Sprout size={14} />
            COMPOSTIQ · Local monitoring dashboard
          </span>
          <span>ESP32 · React + FastAPI</span>
        </footer>
      </main>
    </div>
  )
}
