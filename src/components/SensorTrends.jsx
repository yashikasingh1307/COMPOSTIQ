import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { BarChart3 } from 'lucide-react'
import GlassCard, { Empty } from './GlassCard'
import { RANGES, SERIES, buildSeries, chartOptions } from '../lib/chart'

export function RangeTabs({ range, setRange }) {
  return <div className="ranges" role="tablist" aria-label="Time range">{Object.keys(RANGES).map(r => <button key={r} role="tab" aria-selected={range === r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>)}</div>
}

export function TrendChart({ history, historyState, now, range, keys, compact = false }) {
  const minute = Math.floor(now / 60000)
  const built = useMemo(() => buildSeries(history, RANGES[range], minute * 60000, keys), [history, range, minute, keys])
  const dual = keys.some(k => SERIES[k].axis === 'y1') && keys.some(k => SERIES[k].axis === 'y')
  const options = useMemo(() => chartOptions({ dual, rangeMs: RANGES[range], compact }), [dual, range, compact])
  if (historyState === 'loading') return <Empty>Loading history from ThingSpeak…</Empty>
  if (historyState === 'error') return <Empty>History is unavailable right now (ThingSpeak could not be reached).</Empty>
  if (!built) return <Empty>No readings were uploaded in the last {range}.</Empty>
  const data = {
    labels: built.labels,
    datasets: keys.map(k => ({ label: SERIES[k].label, data: built.data[k], borderColor: SERIES[k].color, backgroundColor: SERIES[k].color, yAxisID: dual ? SERIES[k].axis : 'y', spanGaps: false, fill: false })),
  }
  return (
    <>
      <div className="chart-box"><Line data={data} options={options} ref={c => { if (c) c.$times = built.times }} /></div>
      {!compact && keys.length > 1 && <ul className="legend">{keys.map(k => <li key={k}><i style={{ background: SERIES[k].color }} />{SERIES[k].label}</li>)}</ul>}
    </>
  )
}

export default function SensorTrends({ history, historyState, now, className = '' }) {
  const [range, setRange] = useState('24h')
  const keys = useMemo(() => ['temperature', 'humidity', 'soilMoisture', 'gasValue'], [])
  return (
    <GlassCard className={`trends ${className}`} title="Sensor Trends" icon={BarChart3} action={<RangeTabs range={range} setRange={setRange} />}>
      <div className="axis-note"><span>Temp °C · Humidity %</span><span>Soil · Gas ADC</span></div>
      <TrendChart history={history} historyState={historyState} now={now} range={range} keys={keys} />
    </GlassCard>
  )
}
