import { Activity, Bell, Cog, Home, Leaf, Settings } from 'lucide-react'
import { LeafBranch, LeafLogo } from './Botanical'

export const PAGES = [
  { key: 'overview', label: 'Overview', icon: Home },
  { key: 'sensors', label: 'Sensors', icon: Activity },
  { key: 'health', label: 'Compost Health', icon: Leaf },
  { key: 'automation', label: 'Automation', icon: Cog },
  { key: 'alerts', label: 'Alerts & Logs', icon: Bell },
  { key: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ page, setPage, alertCount }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <LeafLogo size={50} />
        <b>CompostIQ</b>
        <small>Smart Compost Monitoring</small>
      </div>
      <hr />
      <nav aria-label="Main">
        {PAGES.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`nav-item ${page === key ? 'active' : ''}`} onClick={() => setPage(key)} aria-current={page === key ? 'page' : undefined} title={label}>
            <Icon size={22} strokeWidth={1.7} />
            <span>{label}</span>
            {key === 'alerts' && alertCount > 0 && <i className="badge" aria-label={`${alertCount} active alerts`}>{alertCount}</i>}
          </button>
        ))}
      </nav>
      <LeafBranch className="side-leaf" />
      <footer><hr /><p>Greener Tomorrow<br />Together ♡</p></footer>
    </aside>
  )
}
