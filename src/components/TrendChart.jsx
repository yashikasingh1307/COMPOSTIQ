import { Line } from 'react-chartjs-2'
import { chartOptions } from '../lib/chart'
export default function TrendChart({ history, metric = 'temperature', title = 'Temperature trend', unit = '°C', color = '#527b58' }) {
  const data = { labels: history.map(x => x.time), datasets: [{ data: history.map(x => x[metric]), borderColor: color, backgroundColor: `${color}18`, fill: true }] }
  return <section className="panel chart-panel"><div className="panel-heading"><div><h3>{title}</h3><p>Live readings from your compost unit</p></div><span className="chart-unit">{unit}</span></div><div className="chart-wrap">{history.length > 1 ? <Line data={data} options={chartOptions}/> : <div className="chart-empty">Waiting for enough readings to draw a trend…</div>}</div></section>
}
