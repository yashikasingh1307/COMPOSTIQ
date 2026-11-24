import { useCallback, useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Overview from './pages/Overview'
import Sensors from './pages/Sensors'
import CompostHealth from './pages/CompostHealth'
import Automation from './pages/Automation'
import AlertsLogs from './pages/AlertsLogs'
import Settings from './pages/Settings'
import { useCompostData } from './hooks/useCompostData'

const VIEWS = {
  overview: { C: Overview, title: 'Welcome to CompostIQ', sub: 'Monitoring. Maintaining. Sustaining.' },
  sensors: { C: Sensors, title: 'Sensors', sub: 'Live readings and history from your compost unit.' },
  health: { C: CompostHealth, title: 'Compost Health', sub: 'What the sensors say about your compost.' },
  automation: { C: Automation, title: 'Automation', sub: 'Pump and ventilation, managed on the device.' },
  alerts: { C: AlertsLogs, title: 'Alerts & Logs', sub: 'Active alerts, history and activity.' },
  settings: { C: Settings, title: 'Settings', sub: 'Connections, thresholds and device details.' },
}
const fromHash = () => { const k = location.hash.replace('#/', ''); return VIEWS[k] ? k : 'overview' }

export default function App() {
  const [page, setPageState] = useState(fromHash)
  const d = useCompostData()
  const setPage = useCallback(k => { location.hash = `#/${k}`; setPageState(k) }, [])
  useEffect(() => { const f = () => setPageState(fromHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  const { C, title, sub } = VIEWS[page]
  return (
    <>
      <div className="botanical-bg" aria-hidden="true" />
      <div className={`app-shell ${page === 'overview' ? 'is-overview' : ''}`}>
        <Sidebar page={page} setPage={setPage} alertCount={d.alerts.length} />
        <main className="main">
          <Header title={title} subtitle={sub} lastUpdated={d.lastUpdated} state={d.state} refreshing={d.refreshing} onRefresh={d.refresh} />
          {d.state === 'offline' && <div className="banner" role="status">Can’t reach the device or ThingSpeak from this browser. The ESP32 keeps running its automation on its own — check Wi-Fi and the addresses in Settings.</div>}
          {d.state === 'stale' && <div className="banner warn" role="status">No new data for several minutes. Showing the last readings received; the ESP32 keeps running its automation locally.</div>}
          <div className="page" key={page}><C d={d} go={setPage} /></div>
        </main>
      </div>
    </>
  )
}
