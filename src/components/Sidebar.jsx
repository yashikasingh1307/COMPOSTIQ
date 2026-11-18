import { Sprout, LayoutDashboard, Activity, Leaf, Wind, Bell, Settings, Wifi, ChevronLeft, ChevronRight } from 'lucide-react'
const items = [
  ['Overview', LayoutDashboard], ['Sensors', Activity], ['Compost health', Leaf], ['Automation', Wind], ['Alerts & logs', Bell], ['Settings', Settings]
]
export default function Sidebar({ page, setPage, connected, collapsed, setCollapsed }) {
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
    <div className="brand"><div className="brand-mark"><Sprout size={22}/></div>{!collapsed && <div><b>COMPOSTIQ</b><small>COMPOST INTELLIGENCE</small></div>}</div>
    <div className="nav-label">WORKSPACE</div>
    <nav>{items.map(([label, Icon]) => <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => setPage(label)} title={label}><Icon size={18}/>{!collapsed && <span>{label}</span>}{page === label && !collapsed && <i/>}</button>)}</nav>
    <div className="sidebar-bottom"><div className="device-mini"><span className={`dot ${connected ? 'online' : ''}`}/>{!collapsed && <div><b>ESP32 device</b><small>{connected ? 'Connected locally' : 'Waiting for device'}</small></div>}</div><button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>}</button></div>
  </aside>
}
