import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, ChevronDown, CircleHelp, Leaf, Search, Sprout, Wifi, WifiOff } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import { Sensors, CompostHealth, Automation, Alerts, Settings } from './pages/DetailPages'
import { fetchDeviceData, fetchDeviceHealth } from './lib/api'
import { getSensorData } from "./services/thingspeak";

const PAGES=['Overview','Sensors','Compost health','Automation','Alerts & logs','Settings']
export default function App(){
 const [page,setPage]=useState('Overview'),[collapsed,setCollapsed]=useState(false)
 const [data,setData]=useState(null),[health,setHealth]=useState(null),[connected,setConnected]=useState(false),[lastSeen,setLastSeen]=useState(''),[error,setError]=useState('')
 const [history,setHistory]=useState([]),[events,setEvents]=useState([])
 const [alert,setAlert]=useState('')
 const refresh=useCallback(async()=>{
  try{
   const [next,h]=await Promise.all([getSensorData(),fetchDeviceHealth().catch(()=>null)])
   setData(next);setHealth(h);setConnected(true);setError('');setLastSeen(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}))
   const sample={time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),temperature:Number(next.temperature),humidity:Number(next.humidity),soilMoisture:Number(next.soilMoisture),gasValue:Number(next.gasValue)}
   setHistory(old=>[...old,sample].slice(-36))
   const message=next.alertMessage||'No alert message';
   setAlert(message)
   setEvents(old=>{
    const signature=`${!!next.alarmState}:${message}`
    if(old[old.length-1]?.signature===signature)return old
    return [...old,{signature,time:new Date().toLocaleTimeString(),message,alarm:!!next.alarmState}].slice(-40)
   })
  }catch(e){setConnected(false);setError(e.message)}
 },[])
 useEffect(()=>{refresh();const id=setInterval(refresh,2500);return()=>clearInterval(id)},[refresh])
 const pageContent=useMemo(()=>{
  const common={data,history,connected,health,lastSeen,alert,events,setPage,refresh}
  switch(page){case 'Sensors':return <Sensors {...common}/>;case 'Compost health':return <CompostHealth {...common}/>;case 'Automation':return <Automation {...common}/>;case 'Alerts & logs':return <Alerts {...common}/>;case 'Settings':return <Settings {...common} onTest={refresh}/>;default:return <Overview {...common}/>}
 },[page,data,history,connected,health,lastSeen,alert,events,refresh])
 return <div className="app-shell"><Sidebar page={page} setPage={setPage} connected={connected} collapsed={collapsed} setCollapsed={setCollapsed}/><main className="main-area"><header className="topbar"><div className="breadcrumb"><span>COMPOSTIQ</span><b>/</b><strong>{page}</strong></div><div className="topbar-right"><span className={`connection-label ${connected?'':'disconnected'}`}>{connected?<Wifi size={15}/>:<WifiOff size={15}/>} {connected?'Device online':'Device offline'}</span><button className="icon-btn" title="Alerts" onClick={()=>setPage('Alerts & logs')}><Bell size={17}/>{data?.alarmState&&<i/>}</button><div className="avatar">B</div></div></header><div className="content-wrap">{pageContent}{error&&<div className="error-toast"><WifiOff size={15}/><span>{error}. Check the ESP32 URL in Settings.</span></div>}</div><footer className="footer"><span><Sprout size={14}/> COMPOSTIQ · Local monitoring dashboard</span><span>ESP32 · React + Vite</span></footer></main></div>
}
