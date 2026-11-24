import { RefreshCw } from 'lucide-react'
import { Sprout } from './Botanical'
import { fmtDateTime } from '../lib/format'

const NOTE = { live: 'Live from ESP32', cloud: 'Via ThingSpeak', stale: 'Stale — last data received', offline: 'No data received', loading: 'Connecting…' }

export default function Header({ title, subtitle, lastUpdated, state, refreshing, onRefresh }) {
  const tone = state === 'live' || state === 'cloud' ? 'ok' : state === 'stale' ? 'warn' : 'bad'
  return (
    <header className="page-header">
      <Sprout size={58} />
      <div className="title-block">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="updated">
        <span className={`updated-pill`} title={NOTE[state]}>
          <i className={`dot dot-${tone}`} />
          {lastUpdated ? `Last Updated: ${fmtDateTime(lastUpdated)}` : NOTE[state]}
        </span>
        <button className={`refresh ${refreshing ? 'spin' : ''}`} onClick={onRefresh} aria-label="Refresh data" title="Refresh data"><RefreshCw size={20} /></button>
      </div>
    </header>
  )
}
